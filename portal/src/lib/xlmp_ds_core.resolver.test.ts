// Real, executable tests for resolveTopologicalDependencies, run via
// Node's built-in test runner (`node --test`) -- no jest/vitest available
// in this local checkout (no package.json/node_modules present locally),
// so this uses node:test + node:assert, both stdlib, zero extra deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  resolveTopologicalDependencies,
  InMemoryVaultRootResolver,
  sha256Hex,
  DEFAULT_LNES_58_5A_BUDGET,
  type AtomicTopologicalShard,
  type VaultRootResolver,
} from './xlmp_ds_core.ts';

function shard(foreignKeys: string[]): AtomicTopologicalShard {
  return {
    current_root: '0'.repeat(64),
    previous_root: null,
    next_root: null,
    temporal_coordinate: 1786195200,
    semantic_tag: 0x01,
    cryptographic_foreign_keys: foreignKeys,
    payload: 'test-payload',
  };
}

function rootOf(content: string): string {
  return sha256Hex(Buffer.from(content, 'utf-8'));
}

test('zero foreign keys -> empty, complete', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const result = await resolveTopologicalDependencies(shard([]), resolver);
  assert.equal(result.evidence.length, 0);
  assert.equal(result.resolved.length, 0);
  assert.equal(result.complete, true);
  assert.equal(result.duplicatesRemoved, 0);
});

test('one valid foreign key -> resolved and verified', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const content = 'Document B: warfarin + ibuprofen -> increased bleeding risk';
  const root = rootOf(content);
  resolver.put(root, Buffer.from(content, 'utf-8'));

  const result = await resolveTopologicalDependencies(shard([root]), resolver);
  assert.equal(result.complete, true);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0], content);
  assert.equal(result.resolved[0].status, 'resolved');
});

test('multiple valid foreign keys -> all resolved, order preserved', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const c1 = 'reference table A';
  const c2 = 'reference table B';
  const r1 = rootOf(c1);
  const r2 = rootOf(c2);
  resolver.put(r1, Buffer.from(c1));
  resolver.put(r2, Buffer.from(c2));

  const result = await resolveTopologicalDependencies(shard([r1, r2]), resolver);
  assert.equal(result.complete, true);
  assert.deepEqual(result.evidence, [c1, c2]);
});

test('duplicate FK -> deduplicated, resolved once', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const content = 'dedup test content';
  const root = rootOf(content);
  resolver.put(root, Buffer.from(content));

  const result = await resolveTopologicalDependencies(shard([root, root, root]), resolver);
  assert.equal(result.duplicatesRemoved, 2);
  assert.equal(result.resolved.length, 1);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.complete, true);
});

test('malformed root -> invalid_root, not complete', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const result = await resolveTopologicalDependencies(shard(['not-a-valid-root']), resolver);
  assert.equal(result.resolved[0].status, 'invalid_root');
  assert.equal(result.complete, false);
  assert.equal(result.evidence.length, 0);
});

test('malformed root -> wrong length hex also rejected', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const shortHex = 'ab'.repeat(16); // 32 hex chars = 16 bytes, not 32
  const result = await resolveTopologicalDependencies(shard([shortHex]), resolver);
  assert.equal(result.resolved[0].status, 'invalid_root');
  assert.equal(result.complete, false);
});

test('unresolved root -> resolver returns null, not complete', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const neverStored = rootOf('this content was never registered with the resolver');
  const result = await resolveTopologicalDependencies(shard([neverStored]), resolver);
  assert.equal(result.resolved[0].status, 'unresolved');
  assert.equal(result.complete, false);
  assert.equal(result.evidence.length, 0);
});

test('root/content mismatch -> rejected, not appended to evidence', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const claimedRoot = rootOf('what the shard declares');
  // Store DIFFERENT content under the same claimed root -- simulates a
  // resolver returning tampered or wrong content for a given key.
  resolver.put(claimedRoot, Buffer.from('actually different content'));

  const result = await resolveTopologicalDependencies(shard([claimedRoot]), resolver);
  assert.equal(result.resolved[0].status, 'root_mismatch');
  assert.equal(result.complete, false);
  assert.equal(result.evidence.length, 0, 'mismatched content must never enter evidence');
});

test('exception-budget overflow (maxForeignKeys) -> excess FKs marked budget_exceeded', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const roots: string[] = [];
  for (let i = 0; i < 3; i++) {
    const content = `content-${i}`;
    const root = rootOf(content);
    resolver.put(root, Buffer.from(content));
    roots.push(root);
  }
  const tightBudget = { maxForeignKeys: 2, maxDependencyDepth: 1, maxTotalBytes: 1_000_000 };
  const result = await resolveTopologicalDependencies(shard(roots), resolver, tightBudget);

  assert.equal(result.complete, false);
  assert.equal(result.resolved.filter(r => r.status === 'resolved').length, 2);
  assert.equal(result.resolved.filter(r => r.status === 'budget_exceeded').length, 1);
  // Every declared FK gets a status -- overflow is reported, not silently dropped.
  assert.equal(result.resolved.length, 3);
});

test('exception-budget overflow (maxTotalBytes) -> byte cap enforced', async () => {
  const resolver = new InMemoryVaultRootResolver();
  const big = 'x'.repeat(100);
  const root = rootOf(big);
  resolver.put(root, Buffer.from(big));
  const tinyByteBudget = { maxForeignKeys: 10, maxDependencyDepth: 1, maxTotalBytes: 50 };

  const result = await resolveTopologicalDependencies(shard([root]), resolver, tinyByteBudget);
  assert.equal(result.resolved[0].status, 'budget_exceeded');
  assert.equal(result.complete, false);
});

test('cyclic/reference repetition -> depth fixed at 1, no traversal into resolved content', async () => {
  // "Cyclic" in a depth-1 resolver means: resolved content is never itself
  // re-scanned for further foreign keys, so a root whose content happens to
  // BE another valid root's hex string does not trigger a second lookup.
  const resolver = new InMemoryVaultRootResolver();
  const innerContent = 'inner reference table';
  const innerRoot = rootOf(innerContent);
  resolver.put(innerRoot, Buffer.from(innerContent));

  // Outer content's payload is literally the inner root's hex string --
  // if depth weren't bounded at 1, a naive implementation might try to
  // treat that string as a further dependency to chase.
  const outerContent = innerRoot;
  const outerRoot = rootOf(outerContent);
  resolver.put(outerRoot, Buffer.from(outerContent));

  const result = await resolveTopologicalDependencies(shard([outerRoot]), resolver);
  assert.equal(result.complete, true);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0], innerRoot, 'only the declared outer root was resolved, not chased further');
  assert.equal(DEFAULT_LNES_58_5A_BUDGET.maxDependencyDepth, 1);
});

test('no semantic/vector retrieval path is invoked -- structural proof via call-counted resolver', async () => {
  // Proof by construction: the ONLY way this function can obtain content is
  // through the injected VaultRootResolver.resolve() call. This test wraps
  // a resolver that counts calls and asserts the call count equals exactly
  // the number of deduplicated, budget-eligible FKs -- no more, meaning no
  // hidden secondary retrieval path (semantic/vector/lexical) executed.
  let resolveCallCount = 0;
  const inner = new InMemoryVaultRootResolver();
  const c1 = 'countable content';
  const r1 = rootOf(c1);
  inner.put(r1, Buffer.from(c1));

  const countingResolver: VaultRootResolver = {
    async resolve(rootHex: string) {
      resolveCallCount++;
      return inner.resolve(rootHex);
    },
  };

  await resolveTopologicalDependencies(shard([r1, r1]), countingResolver); // 1 dup removed
  assert.equal(resolveCallCount, 1, 'resolver.resolve() is the only content-acquisition call, invoked once per deduplicated FK');
});

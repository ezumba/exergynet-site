
import {
  resolveTopologicalDependencies, InMemoryVaultRootResolver,
} from "../portal/src/lib/xlmp_ds_core.ts";

const fixtures = JSON.parse(process.argv[2]);
const results: any = {};

async function main() {
  for (const fixture of fixtures) {
    const resolver = new InMemoryVaultRootResolver();
    for (const [root, content] of Object.entries(fixture.store)) {
      resolver.put(root, Buffer.from(content as string, "utf-8"));
    }
    const shard = {
      current_root: "0".repeat(64), previous_root: null, next_root: null,
      temporal_coordinate: 0, semantic_tag: 1,
      cryptographic_foreign_keys: fixture.fks, payload: "",
    };
    const budget = fixture.budget ?? undefined;
    const result = await resolveTopologicalDependencies(shard as any, resolver, budget);
    results[fixture.name] = {
      evidence: result.evidence,
      statuses: result.resolved.map((d: any) => d.status),
      complete: result.complete,
      total_bytes: result.totalBytes,
      duplicates_removed: result.duplicatesRemoved,
    };
  }
  console.log(JSON.stringify(results));
}
main();

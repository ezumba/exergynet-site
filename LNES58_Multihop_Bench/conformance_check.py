#!/usr/bin/env python3
"""
Cross-language conformance harness: runs identical fixtures through the
Python resolver directly, and drives the TypeScript resolver via a small
Node subprocess, then diffs every field for exact semantic parity.
"""
import hashlib, json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from deterministic_fk_resolver import (
    InMemoryVaultRootResolver, resolve_topological_dependencies,
    DependencyBudget, sha256_hex,
)

def h(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

FIXTURES = [
    {"name": "empty", "fks": [], "store": {}, "budget": None},
    {"name": "one_valid", "fks": [h("alpha")], "store": {h("alpha"): "alpha"}, "budget": None},
    {"name": "two_valid_ordered", "fks": [h("beta"), h("gamma")],
     "store": {h("beta"): "beta", h("gamma"): "gamma"}, "budget": None},
    {"name": "duplicate", "fks": [h("delta"), h("delta"), h("delta")],
     "store": {h("delta"): "delta"}, "budget": None},
    {"name": "malformed", "fks": ["not-a-root"], "store": {}, "budget": None},
    {"name": "unresolved", "fks": [h("never-stored")], "store": {}, "budget": None},
    {"name": "mismatch", "fks": [h("claimed")], "store": {h("claimed"): "actually-different"}, "budget": None},
    {"name": "budget_fk_overflow", "fks": [h("e1"), h("e2"), h("e3")],
     "store": {h("e1"): "e1", h("e2"): "e2", h("e3"): "e3"},
     "budget": {"maxForeignKeys": 2, "maxDependencyDepth": 1, "maxTotalBytes": 1000000}},
    {"name": "budget_byte_overflow", "fks": [h("x" * 100)], "store": {h("x" * 100): "x" * 100},
     "budget": {"maxForeignKeys": 10, "maxDependencyDepth": 1, "maxTotalBytes": 50}},
]

def run_python(fixture):
    resolver = InMemoryVaultRootResolver()
    for root, content in fixture["store"].items():
        resolver.put(root, content.encode("utf-8"))
    budget = None
    if fixture["budget"]:
        b = fixture["budget"]
        budget = DependencyBudget(max_foreign_keys=b["maxForeignKeys"],
                                   max_dependency_depth=b["maxDependencyDepth"],
                                   max_total_bytes=b["maxTotalBytes"])
    else:
        budget = DependencyBudget()
    result = resolve_topological_dependencies(fixture["fks"], resolver, budget)
    return {
        "evidence": result.evidence,
        "statuses": [d.status for d in result.resolved],
        "complete": result.complete,
        "total_bytes": result.total_bytes,
        "duplicates_removed": result.duplicates_removed,
    }

TS_RUNNER = os.path.join(HERE, "_conformance_ts_runner.ts")

def build_ts_runner():
    code = '''
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
'''
    with open(TS_RUNNER, "w", encoding="utf-8") as f:
        f.write(code)

def run_typescript_all():
    build_ts_runner()
    payload = json.dumps(FIXTURES)
    proc = subprocess.run(
        ["node", TS_RUNNER, payload],
        cwd=HERE, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print("TS runner STDERR:\\n", proc.stderr, file=sys.stderr)
        raise RuntimeError("TypeScript conformance runner failed")
    # Last line is the JSON (Node may print warnings to stdout too on some versions -- filter)
    for line in reversed(proc.stdout.strip().split("\\n")):
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    raise RuntimeError(f"No JSON found in TS runner output: {proc.stdout}")

def main():
    ts_results = run_typescript_all()
    all_match = True
    for fixture in FIXTURES:
        name = fixture["name"]
        py = run_python(fixture)
        ts = ts_results.get(name)
        match = (py["evidence"] == ts["evidence"] and
                 py["statuses"] == ts["statuses"] and
                 py["complete"] == ts["complete"] and
                 py["total_bytes"] == ts["total_bytes"] and
                 py["duplicates_removed"] == ts["duplicates_removed"])
        marker = "MATCH" if match else "MISMATCH"
        if not match:
            all_match = False
        print(f"[{marker}] {name}")
        if not match:
            print(f"  python: {py}")
            print(f"  ts:     {ts}")
    print()
    print("ALL FIXTURES MATCH:" , all_match)
    return 0 if all_match else 1

if __name__ == "__main__":
    sys.exit(main())

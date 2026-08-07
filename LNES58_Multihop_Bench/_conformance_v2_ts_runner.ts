
import { traverseV2 } from "../portal/src/lib/xlmp_ds_core.ts";

const fixtures = JSON.parse(process.argv[2]);
const graphHash = process.argv[3];
const runTs = parseFloat(process.argv[4]);
const results: any = {};

for (const fixture of fixtures) {
  const budget = fixture.budget ?? { maxRelationNodes: 8, maxTotalBytes: 32768 };
  const outcome = traverseV2(
    fixture.record_id, fixture.relation_nodes, fixture.manifests, graphHash, budget, runTs
  );
  let receipt = null;
  if (outcome.negativeReceipt) receipt = outcome.negativeReceipt;
  else if (outcome.incompleteReceipt) receipt = outcome.incompleteReceipt;
  results[fixture.name] = {
    state: outcome.state,
    matched_count: outcome.matchedNodes.length,
    receipt,
  };
}
console.log(JSON.stringify(results));

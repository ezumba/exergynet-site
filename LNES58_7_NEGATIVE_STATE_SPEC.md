# LNES-58.7 Negative State Specification

## Traversal State Machine

Every traversal terminates in exactly one of: `MATCH`, `NO_MATCH`, `INCOMPLETE`.

- **MATCH**: one or more verified relation nodes found within the committed graph scope for the resolved entity set.
- **NO_MATCH**: traversal completed successfully -- entity resolution succeeded, root verification succeeded, no budget exhaustion, no unresolved dependency -- and zero matching relation nodes were found. This is a positive, verified result, not an absence of effort.
- **INCOMPLETE**: the system could not establish MATCH or NO_MATCH (missing/malformed/mismatched root, unresolved dependency, budget exhaustion, entity extraction failure, unavailable graph). **INCOMPLETE must never be represented as NO_MATCH.**

## NegativeResolutionReceipt

Content-addressed (SHA-256 of canonical sorted-key JSON of all fields except `receipt_root`). Meaning is strictly scoped: *"No matching relation exists within the declared committed graph scope."* Does NOT mean no such relation exists anywhere, no real-world interaction exists, or no external evidence could contradict this result.

## Explicit Null Assertion

Generated FROM the receipt, not free-form:

```
AUTHORITATIVE GRAPH RESULT:
The committed reference graph was deterministically traversed for the resolved
entities under relation type <RELATION_TYPE>.
Traversal completed successfully.
Zero matching relation nodes were found within graph <GRAPH_ROOT/VERSION>.
This is an explicit negative result within the declared graph scope, not missing
or unexamined evidence.
```

No ground truth, grader metadata, query type, or expected answer ever appears in this text.

## Implementation

- Python: `entity_graph_traversal_v2.py` (`traverse_v2`, `render_explicit_null_assertion`, `render_incomplete_assertion`)
- TypeScript: `portal/src/lib/xlmp_ds_core.ts` (`traverseV2`, `renderExplicitNullAssertion`, `renderIncompleteAssertion`)
- Cross-language conformance: 6/6 fixtures match exactly (MATCH, NO_MATCH, 4 INCOMPLETE reasons)

## Measured Effect (X5, 67-query interaction_check subset)

79.1% (X4, silent-absence) → 94.0% (X5, explicit negative state). Confusion matrix diagonal is perfect (MATCH always coincides with ground-truth relation-required, NO_MATCH always coincides with ground-truth no-relation-required) -- the resolver's own state classification is 100% correct against independent ground truth. Remaining gap (4/67) is entirely within NO_MATCH cases where the model overrode an explicit verified-negative assertion with its own guess -- not a resolver defect.

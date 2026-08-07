# X5 Residual Autopsy Report

Strictly diagnostic. No code changes proposed or made. Substrate frozen and hash-verified before analysis (see §0).

## 0. Substrate Freeze Verification

Read-only. No modifications made to resolution/traversal code or X5 artifacts during this analysis.

| Artifact | SHA-256 |
|---|---|
| `X5_67_results.jsonl` | `80db44d07304dae986198b4c415117e1a2c814f8d04e0ae91a0a7ab0478d191f` |
| `X5_67_audit.json` | `5da9cdb42e48acd57660fcc335d276c845b34c522095daaec6b71eeefc75e36f` |
| `X5_14case_diagnostic.json` | `b6e3b295a6da54e6ad4323fef8d0d1fe1a86a8cb70d44765edcc2ad20660bfe2` |
| `relation_manifest.json` | `b5dc9ba958906ffd9fd5b1ba7c0175da1bbf0f6a851e93e62bed31a964a44db5` (matches freeze record) |
| `patient_entity_manifests.json` | `a2bec04a25d0b70e9530e806e309389ddf39e30078dccb91fbec9188aadf7905` (matches freeze record) |
| `entity_graph_traversal_v2.py` | `d2d8e45beac1297c6ba1159aa8088a6f033b8aafede3e3bcee983535c561122c` |
| `entity_graph_builder.py` | `bba97fcbf182d43bd356e18af043b6db75df9209e849aedc7155f4d90e74eccf` (matches recorded `parser_code_sha256`) |

## 1. Isolated Anomalies (4 cases, all NO_MATCH, all ground truth `interacts: False`)

| Query | GT | Resolver state | Model output |
|---|---|---|---|
| TR106-interaction | `{interacts: False}` | NO_MATCH (verified correct) | `{interacts: True, conflicting_drug: "omeprazole"}` |
| TR137-interaction | `{interacts: False}` | NO_MATCH (verified correct) | `{interacts: True, conflicting_drug: "levothyroxine"}` |
| TR140-interaction | `{interacts: False}` | NO_MATCH (verified correct) | `{interacts: True, conflicting_drug: "levothyroxine"}` |
| TR158-interaction | `{interacts: False}` | NO_MATCH (verified correct) | `{interacts: True, conflicting_drug: "ibuprofen"}` |

**E_x(q) staged in all 4 cases** (identical Explicit Null Assertion, 413 chars):
```
AUTHORITATIVE GRAPH RESULT:
The committed reference graph was deterministically traversed for the resolved
entities under relation type documented_pairwise_relation.
Traversal completed successfully.
Zero matching relation nodes were found within graph 105d08e79bb9e608...
(version lnes58_6_entity_graph_v1).
This is an explicit negative result within the declared graph scope, not missing
or unexamined evidence.
```

## 2. Forensic Classification

**All 4 cases: Type B (Adherence Failure) — specifically, citation fabrication.**

This is a more specific finding than generic "hallucination." In each case the model's own stated reasoning explicitly claims Document B contains a fact it does not contain, and never was given:

| Query | Model's claimed source content | Actual `INTERACTIONS` table (ground truth) | Verdict |
|---|---|---|---|
| TR106 | *"Document B... explicitly notes a known interaction between simvastatin and omeprazole"* | simvastatin's only documented pair is **clarithromycin** | Fabricated citation — pair does not exist anywhere in the domain |
| TR137 | *"Document B contains the known drug-interaction data. Reviewing it reveals that levothyroxine is known to potentiate... warfarin"* | warfarin's only documented pairs are **aspirin, ibuprofen** | Fabricated citation — real-world clinical fact substituted for the synthetic domain's actual (different) content |
| TR140 | *"Document B provides interaction data; it indicates that levothyroxine can potentiate... warfarin"* | same as TR137 | Same fabrication, same drug pair, independent occurrence |
| TR158 | *"Document B... indicates that aspirin... has a documented interaction with other NSAIDs such as ibuprofen"* | aspirin and ibuprofen each pair only with **warfarin**, not each other | Fabricated citation — class-based (NSAID) real-world reasoning substituted for the actual closed table |

Common shape across all 4: the model does not say "I believe X interacts with Y" as its own inference — it explicitly attributes the claim to Document B ("Document B explicitly notes...", "Document B indicates...", "Document B contains...") when Document B was never provided in that form and the explicit negative receipt said the opposite. Two of the four (TR137, TR140) are the same drug pair (levothyroxine + warfarin) surfacing independently on two different patient records — suggesting this specific real-world pair is a particularly strong prior for the model, not four unrelated random errors.

**Not Type A:** the entity graph's determination was independently verified correct in all 4 cases (`resolver_state_correct: true`, confusion-matrix diagonal perfect). No document nuance was missed — the graph correctly found nothing, because there was nothing to find.

**Not Type C:** all 4 responses were `schema_valid: true`. Well-formed JSON in every case; the reasoning text preceding the JSON is where the fabrication occurs, not the output structure.

**Not Type D:** the ground truth is internally consistent with the documents as given. The `INTERACTIONS` table is a closed, fully-enumerated 5-pair set; none of the 4 model-claimed pairs are in it, and no contradiction exists between the synthetic ground truth and the actual source documents. The contradiction is entirely between the model's output and the source documents it was given — not between the ground truth and the documents.

## 3. Summary Table

| Type | Count | Cases |
|---|---|---|
| A — Semantic Mismatch | 0 | — |
| B — Adherence Failure (citation fabrication) | 4 | TR106, TR137, TR140, TR158 |
| C — Schema Error | 0 | — |
| D — Epistemic Contradiction | 0 | — |

No code fixes proposed, per directive. Diagnostic only.

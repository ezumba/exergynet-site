#!/usr/bin/env python3
"""
LNES-58.6 query-time traversal. Reads ONLY the frozen artifacts written by
freeze_entity_graph.py (relation_manifest.json, patient_entity_manifests.json)
plus a record_id. Deliberately does NOT accept query text, query type, or
ground truth as inputs -- the traversal is entity-set-driven: it selects
relation nodes whose canonical_entities are a subset of the entities
already bound to this record AT INGEST TIME, before any query existed.

This means the traversal fires identically for a given patient regardless
of which question is later asked about them -- proven by the negative-
control test in this same file, which runs it against non-drug entity
sets and confirms zero matches without any type-based branching.
"""
import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class TraversalBudget:
    max_relation_nodes: int = 8
    max_graph_depth: int = 1  # fixed -- no multi-hop traversal in this version
    max_total_bytes: int = 32_768


DEFAULT_BUDGET = TraversalBudget()


@dataclass
class TraversalResult:
    matched_nodes: List[dict] = field(default_factory=list)
    complete: bool = True
    total_bytes: int = 0
    budget_exhausted_count: int = 0
    root_verification_failures: int = 0


def load_frozen_graph(frozen_dir: str):
    with open(os.path.join(frozen_dir, "relation_manifest.json"), "r", encoding="utf-8") as f:
        relation_nodes = json.load(f)
    with open(os.path.join(frozen_dir, "patient_entity_manifests.json"), "r", encoding="utf-8") as f:
        entity_manifests = json.load(f)
    manifests_by_record = {m["record_id"]: m for m in entity_manifests}
    return relation_nodes, manifests_by_record


def _recompute_node_root(node: dict) -> str:
    canonical = "|".join([node["source_root"], *node["canonical_entities"], node["relation_payload"]])
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def traverse(
    record_id: str,
    relation_nodes: list,
    manifests_by_record: dict,
    budget: TraversalBudget = DEFAULT_BUDGET,
) -> TraversalResult:
    """Pure structural traversal. Does not read query text or query type."""
    manifest = manifests_by_record.get(record_id)
    if manifest is None:
        return TraversalResult(complete=False)

    record_entities = set(manifest["entities"])
    result = TraversalResult()

    matches = [
        node for node in relation_nodes
        if set(node["canonical_entities"]).issubset(record_entities)
    ]

    for i, node in enumerate(matches):
        if i >= budget.max_relation_nodes:
            result.budget_exhausted_count += 1
            result.complete = False
            continue

        # Root verification: recompute the node's content-addressed root
        # from its own fields and confirm it matches what was frozen.
        recomputed = _recompute_node_root(node)
        if recomputed != node["node_root"]:
            result.root_verification_failures += 1
            result.complete = False
            continue

        node_bytes = len(node["relation_payload"].encode("utf-8"))
        if result.total_bytes + node_bytes > budget.max_total_bytes:
            result.budget_exhausted_count += 1
            result.complete = False
            continue

        result.total_bytes += node_bytes
        result.matched_nodes.append(node)

    return result


if __name__ == "__main__":
    # Negative-control self-test: prove the traversal is query-type-blind
    # by running it against entity sets that have NOTHING to do with drug
    # interactions, and confirming zero false-positive matches without any
    # special-case code path for "this isn't an interaction question."
    HERE = os.path.dirname(os.path.abspath(__file__))
    frozen_dir = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "lnes58_6_frozen")
    relation_nodes, manifests_by_record = load_frozen_graph(frozen_dir)

    fake_manifests = {
        "COND-TEST": {"record_id": "COND-TEST",
                      "entities": ["chronic kidney disease stage 3", "type 2 diabetes"]},
        "UNRELATED-TEST": {"record_id": "UNRELATED-TEST", "entities": ["acetaminophen"]},
    }
    for rid, m in fake_manifests.items():
        r = traverse(rid, relation_nodes, m and {rid: m} or {})
        print(f"negative control [{rid}]: entities={m['entities']} -> matched_nodes={len(r.matched_nodes)} (expect 0)")
        assert len(r.matched_nodes) == 0, f"FALSE POSITIVE on negative control {rid}"
    print("negative-control self-test PASSED -- traversal fires purely on entity overlap, no type awareness")

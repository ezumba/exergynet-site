#!/usr/bin/env python3
"""
LNES-58.6 freeze step. Imports ONLY entity_graph_builder and the raw
document-generating functions (make_trio for doc_a/doc_c text) -- does
NOT import build_queries, tier2_rag, gold_context, or anything that could
read a question, a query type string, or ground_truth. This is enforced
by what's imported, not just by convention: build_queries is never
referenced anywhere in this file.
"""
import hashlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from tier2_cross_document import make_trio, DOC_B_TEXT, SEED  # NOTE: build_queries NOT imported
from entity_graph_builder import (
    build_reference_graph, build_record_entity_manifest, PARSER_VERSION, NORMALIZATION_RULE,
)

N_TRIOS = 67
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "lnes58_6_frozen")
os.makedirs(OUT_DIR, exist_ok=True)


def sha256_str(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def main():
    freeze_started_at = os.environ.get("FREEZE_TIMESTAMP_OVERRIDE")  # supplied externally, no Date.now() in-script
    if not freeze_started_at:
        print("ERROR: FREEZE_TIMESTAMP_OVERRIDE must be supplied by the caller.", file=sys.stderr)
        return 1

    # 1. Reference graph from Document B ONLY.
    graph = build_reference_graph(DOC_B_TEXT)
    relation_manifest = [
        {
            "node_root": n.node_root, "source_root": n.source_root, "source_range": n.source_range,
            "canonical_entities": n.canonical_entities, "relation_type": n.relation_type,
            "relation_payload": n.relation_payload, "provenance": n.provenance,
        }
        for n in graph.relation_nodes
    ]

    # 2. Primary record ingestion, per trio -- entity extraction only.
    entity_manifests = []
    for p in range(N_TRIOS):
        facts, doc_a, doc_c = make_trio(f"TR{100+p}", SEED + p)
        record_id = facts["pid"]
        manifest = build_record_entity_manifest(record_id, doc_a, doc_c)
        entity_manifests.append({
            "record_id": manifest.record_id, "source_roots": manifest.source_roots,
            "entities": manifest.entities, "provenance": manifest.provenance,
        })

    # 3. Hash everything and freeze -- BEFORE any query is read.
    relation_manifest_json = json.dumps(relation_manifest, sort_keys=True)
    entity_manifests_json = json.dumps(entity_manifests, sort_keys=True)
    parser_code_hash = sha256_str(open(os.path.join(HERE, "entity_graph_builder.py"), "r", encoding="utf-8").read())

    freeze_record = {
        "freeze_timestamp": freeze_started_at,
        "reference_graph_source_root": graph.source_root,
        "relation_node_count": len(relation_manifest),
        "relation_manifest_sha256": sha256_str(relation_manifest_json),
        "entity_manifest_count": len(entity_manifests),
        "patient_entity_manifests_sha256": sha256_str(entity_manifests_json),
        "parser_code_sha256": parser_code_hash,
        "parser_version": PARSER_VERSION,
        "normalization_rule": NORMALIZATION_RULE,
        "queries_read_before_this_point": False,
    }

    with open(os.path.join(OUT_DIR, "relation_manifest.json"), "w", encoding="utf-8") as f:
        f.write(relation_manifest_json)
    with open(os.path.join(OUT_DIR, "patient_entity_manifests.json"), "w", encoding="utf-8") as f:
        f.write(entity_manifests_json)
    with open(os.path.join(OUT_DIR, "freeze_record.json"), "w", encoding="utf-8") as f:
        json.dump(freeze_record, f, indent=2)

    print(json.dumps(freeze_record, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Independent evaluator for entity/relation recall -- deliberately does NOT
import entity_graph_builder or entity_graph_traversal. It recomputes the
"correct" answer directly from the synthetic generator's own ground-truth
fields (facts['current_meds'], facts['trial_drug'], facts['conflicting_meds'],
tier2_cross_document.INTERACTIONS), so a bug or leak in the resolver/graph
code cannot silently pass its own grading.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tier2_cross_document import INTERACTIONS


def required_relation_pairs(facts) -> set:
    """Ground-truth required relation pairs for this patient, computed
    independently from the actual INTERACTIONS table -- not from the graph
    the resolver built, not from the resolver's output."""
    trial_drug = facts["trial_drug"]
    required = set()
    for med in facts["current_meds"]:
        pair = frozenset([trial_drug, med])
        if pair in INTERACTIONS:
            required.add(pair)
    return required


def score_entity_extraction_recall(manifest_entities: list, facts) -> float:
    """Did ingest-time entity extraction capture every entity that actually
    matters for this record (all current_meds + trial_drug)?"""
    expected = set(m.lower() for m in facts["current_meds"]) | {facts["trial_drug"].lower()}
    extracted = set(e.lower() for e in manifest_entities)
    if not expected:
        return 1.0
    return len(expected & extracted) / len(expected)


def score_relation_node_recall(matched_nodes: list, facts) -> float:
    """Of the relation pairs that SHOULD have been found (per ground
    truth), how many did the traversal actually surface?"""
    required = required_relation_pairs(facts)
    if not required:
        return 1.0  # nothing required -- vacuously complete
    found_pairs = set(frozenset(n["canonical_entities"]) for n in matched_nodes)
    # required pairs use raw-case names; matched_nodes uses normalized (lowercase) -- normalize both
    required_norm = set(frozenset(x.lower() for x in p) for p in required)
    return len(required_norm & found_pairs) / len(required_norm)


def score_all_required_evidence_recall(matched_nodes: list, facts) -> bool:
    """Binary: was 100% of required relation evidence present in what was
    surfaced to the model?"""
    return score_relation_node_recall(matched_nodes, facts) >= 1.0

#!/usr/bin/env python3
"""
LNES-58.7 traversal state machine: MATCH / NO_MATCH / INCOMPLETE.

Built as a NEW module, not a modification of entity_graph_traversal.py
(the module X4 actually used) -- X4's artifacts and code path are
untouched. Reuses the same frozen graph/entity-manifest loading and the
same entity-set-intersection traversal rule as v1; the only new thing is
that a completed zero-match traversal now produces an explicit,
structured NO_MATCH state instead of silently returning an empty list.
"""
import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from typing import List, Optional

from entity_graph_traversal import load_frozen_graph, _recompute_node_root  # reuse, don't duplicate

GRAPH_VERSION = "lnes58_6_entity_graph_v1"
TRAVERSAL_VERSION = "entity_graph_traversal_v2"
RELATION_TYPE = "documented_pairwise_relation"


@dataclass
class TraversalBudget:
    max_relation_nodes: int = 8
    max_dependency_depth: int = 1
    max_total_bytes: int = 32_768


DEFAULT_BUDGET = TraversalBudget()


def canonical_json(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def content_root(obj: dict) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


@dataclass
class NegativeResolutionReceipt:
    receipt_type: str
    graph_root: str
    graph_version: str
    graph_manifest_hash: str
    subject_entity_ids: List[str]
    relation_type: str
    result: str
    traversal_version: str
    traversal_depth: int
    roots_verified: bool
    traversal_complete: bool
    budget_exhausted: bool
    source_scope: str
    run_timestamp: float
    receipt_root: str = ""

    def to_dict(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if k != "receipt_root"}
        return d


@dataclass
class IncompleteResolutionReceipt:
    receipt_type: str
    graph_root: Optional[str]
    graph_version: str
    graph_manifest_hash: Optional[str]
    subject_entity_ids: List[str]
    relation_type: str
    result: str
    reason: str
    traversal_version: str
    traversal_depth: int
    roots_verified: bool
    traversal_complete: bool
    budget_exhausted: bool
    source_scope: str
    run_timestamp: float
    receipt_root: str = ""

    def to_dict(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if k != "receipt_root"}
        return d


@dataclass
class TraversalOutcome:
    state: str  # "MATCH" | "NO_MATCH" | "INCOMPLETE"
    matched_nodes: List[dict] = field(default_factory=list)
    negative_receipt: Optional[NegativeResolutionReceipt] = None
    incomplete_receipt: Optional[IncompleteResolutionReceipt] = None
    root_verification_failures: int = 0
    budget_exhausted_count: int = 0
    total_bytes: int = 0


def _make_negative_receipt(graph_manifest_hash: str, source_root: str, entities: List[str], run_ts: float) -> NegativeResolutionReceipt:
    r = NegativeResolutionReceipt(
        receipt_type="NEGATIVE_RELATION_RESULT",
        graph_root=source_root,
        graph_version=GRAPH_VERSION,
        graph_manifest_hash=graph_manifest_hash,
        subject_entity_ids=sorted(entities),
        relation_type=RELATION_TYPE,
        result="NO_MATCH",
        traversal_version=TRAVERSAL_VERSION,
        traversal_depth=1,
        roots_verified=True,
        traversal_complete=True,
        budget_exhausted=False,
        source_scope=f"reference_graph:{source_root[:16]}...",
        run_timestamp=run_ts,
    )
    r.receipt_root = content_root(r.to_dict())
    return r


def _make_incomplete_receipt(reason: str, graph_manifest_hash, source_root, entities, run_ts,
                              roots_verified=False, budget_exhausted=False) -> IncompleteResolutionReceipt:
    r = IncompleteResolutionReceipt(
        receipt_type="INCOMPLETE_RELATION_RESULT",
        graph_root=source_root,
        graph_version=GRAPH_VERSION,
        graph_manifest_hash=graph_manifest_hash,
        subject_entity_ids=sorted(entities),
        relation_type=RELATION_TYPE,
        result="INCOMPLETE",
        reason=reason,
        traversal_version=TRAVERSAL_VERSION,
        traversal_depth=1,
        roots_verified=roots_verified,
        traversal_complete=False,
        budget_exhausted=budget_exhausted,
        source_scope=f"reference_graph:{source_root[:16] if source_root else 'unknown'}...",
        run_timestamp=run_ts,
    )
    r.receipt_root = content_root(r.to_dict())
    return r


def traverse_v2(
    record_id: str,
    relation_nodes: list,
    manifests_by_record: dict,
    graph_manifest_hash: str,
    budget: TraversalBudget = DEFAULT_BUDGET,
    run_timestamp: Optional[float] = None,
) -> TraversalOutcome:
    run_ts = run_timestamp if run_timestamp is not None else time.time()
    manifest = manifests_by_record.get(record_id)

    if manifest is None:
        return TraversalOutcome(
            state="INCOMPLETE",
            incomplete_receipt=_make_incomplete_receipt(
                "entity_extraction_failure", None, None, [], run_ts, roots_verified=False),
        )

    source_root = relation_nodes[0]["source_root"] if relation_nodes else None
    if source_root is None:
        return TraversalOutcome(
            state="INCOMPLETE",
            incomplete_receipt=_make_incomplete_receipt(
                "missing_graph_root", None, graph_manifest_hash, manifest["entities"], run_ts),
        )

    record_entities = set(manifest["entities"])
    matches = [n for n in relation_nodes if set(n["canonical_entities"]).issubset(record_entities)]

    outcome = TraversalOutcome(state="MATCH")  # provisional; may downgrade below
    verified_nodes = []

    for i, node in enumerate(matches):
        if i >= budget.max_relation_nodes:
            outcome.budget_exhausted_count += 1
            return TraversalOutcome(
                state="INCOMPLETE",
                budget_exhausted_count=outcome.budget_exhausted_count,
                incomplete_receipt=_make_incomplete_receipt(
                    "budget_exhausted", source_root, graph_manifest_hash, manifest["entities"], run_ts,
                    roots_verified=True, budget_exhausted=True),
            )

        recomputed = _recompute_node_root(node)
        if recomputed != node["node_root"]:
            outcome.root_verification_failures += 1
            return TraversalOutcome(
                state="INCOMPLETE",
                root_verification_failures=outcome.root_verification_failures,
                incomplete_receipt=_make_incomplete_receipt(
                    "root_verification_mismatch", source_root, graph_manifest_hash, manifest["entities"], run_ts,
                    roots_verified=False),
            )

        node_bytes = len(node["relation_payload"].encode("utf-8"))
        if outcome.total_bytes + node_bytes > budget.max_total_bytes:
            outcome.budget_exhausted_count += 1
            return TraversalOutcome(
                state="INCOMPLETE",
                budget_exhausted_count=outcome.budget_exhausted_count,
                incomplete_receipt=_make_incomplete_receipt(
                    "budget_exhausted", source_root, graph_manifest_hash, manifest["entities"], run_ts,
                    roots_verified=True, budget_exhausted=True),
            )

        outcome.total_bytes += node_bytes
        verified_nodes.append(node)

    if verified_nodes:
        outcome.state = "MATCH"
        outcome.matched_nodes = verified_nodes
        return outcome

    # Traversal fully completed, every candidate checked, nothing matched --
    # this is a POSITIVE, verified negative result, not an absence of effort.
    outcome.state = "NO_MATCH"
    outcome.negative_receipt = _make_negative_receipt(graph_manifest_hash, source_root, manifest["entities"], run_ts)
    return outcome


def render_explicit_null_assertion(receipt: NegativeResolutionReceipt) -> str:
    """Model-facing text, generated FROM the structured receipt -- not
    free-form. No ground truth, grader metadata, or query type appears."""
    return (
        "AUTHORITATIVE GRAPH RESULT:\n"
        f"The committed reference graph was deterministically traversed for the resolved "
        f"entities under relation type {receipt.relation_type}.\n"
        "Traversal completed successfully.\n"
        f"Zero matching relation nodes were found within graph {receipt.graph_root[:16]}... "
        f"(version {receipt.graph_version}).\n"
        "This is an explicit negative result within the declared graph scope, not missing or unexamined evidence."
    )


def render_incomplete_assertion(receipt: IncompleteResolutionReceipt) -> str:
    return (
        "GRAPH RESULT: INCOMPLETE.\n"
        f"Traversal could not establish a match or no-match state (reason: {receipt.reason}).\n"
        "This is not a verified negative result and must not be treated as evidence of absence."
    )

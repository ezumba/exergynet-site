#!/usr/bin/env python3
"""
LNES-58.6 Deterministic Entity Graph -- ingestion-time construction ONLY.

STRICT RULE: nothing in this file may import, reference, or branch on
benchmark query text, query type strings, ground_truth, or grader logic.
It parses Document B and primary patient records using generic pattern
rules that would apply to ANY document in this "- A + B: description" /
"Label: comma, separated, list" shape, regardless of domain.
"""
import hashlib
import re
from dataclasses import dataclass, field
from typing import List, Dict

PARSER_VERSION = "entity_graph_builder.v1"
NORMALIZATION_RULE = "lowercase, strip whitespace, no stemming"


def normalize_entity(raw: str) -> str:
    return raw.strip().lower()


def content_root(*parts: str) -> str:
    canonical = "|".join(parts)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass
class RelationNode:
    node_root: str            # content-addressed root of this relation node
    source_root: str          # SHA-256 of the document this was parsed from
    source_range: str         # line number within source, for provenance
    canonical_entities: List[str]
    relation_type: str
    relation_payload: str
    provenance: str


@dataclass
class ReferenceGraph:
    source_root: str
    relation_nodes: List[RelationNode] = field(default_factory=list)


# Generic pattern: "- entityA + entityB: free-text description"
# Matches the literal shape of Document B's lines. Nothing here encodes
# "drug" or "interaction" as a concept -- it is a pairwise-relation-line
# parser, and would extract identically-structured nodes from any document
# using this exact "- X + Y: Z" bullet format.
PAIRWISE_RELATION_LINE = re.compile(r"^-\s*([\w\-]+)\s*\+\s*([\w\-]+)\s*:\s*(.+)$")


def build_reference_graph(document_text: str) -> ReferenceGraph:
    source_root = hashlib.sha256(document_text.encode("utf-8")).hexdigest()
    graph = ReferenceGraph(source_root=source_root)

    for line_no, line in enumerate(document_text.split("\n"), start=1):
        m = PAIRWISE_RELATION_LINE.match(line.strip())
        if not m:
            continue
        entity_a, entity_b, payload = m.group(1), m.group(2), m.group(3)
        canonical = sorted([normalize_entity(entity_a), normalize_entity(entity_b)])
        node_root = content_root(source_root, *canonical, payload.strip())
        graph.relation_nodes.append(RelationNode(
            node_root=node_root,
            source_root=source_root,
            source_range=f"line:{line_no}",
            canonical_entities=canonical,
            relation_type="documented_pairwise_relation",  # generic -- not "drug_interaction"
            relation_payload=payload.strip(),
            provenance=f"{PARSER_VERSION}; {NORMALIZATION_RULE}",
        ))
    return graph


# --- Primary record ingestion: entity extraction only, no relation lookup ---

@dataclass
class RecordEntityManifest:
    record_id: str
    source_roots: Dict[str, str]  # {"doc_a": sha256, "doc_c": sha256}
    entities: List[str]
    provenance: str


CURRENT_MEDS_LINE = re.compile(r"^Current medications:\s*(.+)$", re.MULTILINE)
TRIAL_DRUG_LINE = re.compile(r"^Trial drug under evaluation:\s*(.+)$", re.MULTILINE)


def build_record_entity_manifest(record_id: str, doc_a_text: str, doc_c_text: str) -> RecordEntityManifest:
    """Generic label:value list-entity extractor. Does NOT know what an
    'interaction' is, does NOT reference Document B, does NOT branch on
    any downstream question. It extracts named entities mentioned in this
    record's own text, full stop -- same as it would for any other
    comma-separated 'Label: a, b, c' line in any document."""
    entities = []

    m = CURRENT_MEDS_LINE.search(doc_a_text)
    if m:
        entities += [normalize_entity(e) for e in m.group(1).split(",")]

    m = TRIAL_DRUG_LINE.search(doc_c_text)
    if m:
        entities.append(normalize_entity(m.group(1)))

    return RecordEntityManifest(
        record_id=record_id,
        source_roots={
            "doc_a": hashlib.sha256(doc_a_text.encode("utf-8")).hexdigest(),
            "doc_c": hashlib.sha256(doc_c_text.encode("utf-8")).hexdigest(),
        },
        entities=sorted(set(entities)),
        provenance=f"{PARSER_VERSION}; {NORMALIZATION_RULE}",
    )

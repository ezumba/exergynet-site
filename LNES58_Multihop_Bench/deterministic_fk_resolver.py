#!/usr/bin/env python3
"""
Python mirror of resolveTopologicalDependencies (portal/src/lib/xlmp_ds_core.ts).

The actual LNES-58 benchmark harness (set1_benchmark.py, gold_context.py) is
pure Python calling the Auditor directly -- it does NOT go through Portal's
TypeScript evidence-assembly pipeline. This is a deliberate reimplementation
of the same algorithm in the harness's own language, not an invocation of
the deployed TypeScript function. Same validation order, same statuses, same
"never silently truncate" rule, same "no semantic/vector/lexical fallback"
constraint, same depth=1 bound.
"""
import hashlib
import re
from dataclasses import dataclass, field

HEX_32_BYTES = re.compile(r"^[0-9a-fA-F]{64}$")


@dataclass
class DependencyBudget:
    max_foreign_keys: int = 8
    max_dependency_depth: int = 1  # fixed for LNES-58.5A
    max_total_bytes: int = 32_768


DEFAULT_LNES_58_5A_BUDGET = DependencyBudget()


class InMemoryVaultRootResolver:
    """Deterministic, in-memory resolver for the strike-benchmark fixture. Not a production backend."""
    def __init__(self):
        self._store = {}

    def put(self, root_hex: str, content: bytes):
        self._store[root_hex.lower()] = content

    def resolve(self, root_hex: str):
        return self._store.get(root_hex.lower())


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


@dataclass
class ResolvedDependency:
    root: str
    status: str  # resolved | invalid_root | unresolved | root_mismatch | budget_exceeded
    reference_table: str = None
    num_bytes: int = None


@dataclass
class DependencyResolutionResult:
    evidence: list = field(default_factory=list)
    resolved: list = field(default_factory=list)
    complete: bool = True
    total_bytes: int = 0
    duplicates_removed: int = 0


def resolve_topological_dependencies(
    foreign_keys: list[str],
    resolver: InMemoryVaultRootResolver,
    budget: DependencyBudget = DEFAULT_LNES_58_5A_BUDGET,
) -> DependencyResolutionResult:
    resolved = []
    evidence = []
    total_bytes = 0
    complete = True

    seen = set()
    deduped_roots = []
    duplicates_removed = 0
    for root in foreign_keys:
        key = root.lower()
        if key in seen:
            duplicates_removed += 1
            continue
        seen.add(key)
        deduped_roots.append(root)

    for i, root in enumerate(deduped_roots):
        if i >= budget.max_foreign_keys:
            resolved.append(ResolvedDependency(root=root, status="budget_exceeded"))
            complete = False
            continue

        if not HEX_32_BYTES.match(root):
            resolved.append(ResolvedDependency(root=root, status="invalid_root"))
            complete = False
            continue

        content = resolver.resolve(root)
        if content is None:
            resolved.append(ResolvedDependency(root=root, status="unresolved"))
            complete = False
            continue

        actual_root = sha256_hex(content)
        if actual_root.lower() != root.lower():
            resolved.append(ResolvedDependency(root=root, status="root_mismatch"))
            complete = False
            continue

        if total_bytes + len(content) > budget.max_total_bytes:
            resolved.append(ResolvedDependency(root=root, status="budget_exceeded", num_bytes=len(content)))
            complete = False
            continue

        reference_table = content.decode("utf-8")
        total_bytes += len(content)
        resolved.append(ResolvedDependency(root=root, status="resolved", reference_table=reference_table, num_bytes=len(content)))
        evidence.append(reference_table)

    return DependencyResolutionResult(
        evidence=evidence, resolved=resolved, complete=complete,
        total_bytes=total_bytes, duplicates_removed=duplicates_removed,
    )

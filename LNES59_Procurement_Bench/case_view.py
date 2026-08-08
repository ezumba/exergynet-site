"""
LNES-59 RUNNER_CASE / EVALUATOR_CASE information boundary. Built in now
(Phase 5, 31/150 cases) rather than deferred to holdout sealing -- so
every case authored from this point on is authored against the boundary,
not retrofitted later.

RUNNER_CASE: only what a tested system (B0-B4, X0-X2, or a real model)
legitimately has access to -- the question and the document set it may
read. Nothing about what the CORRECT answer is, what FAILURE MODE the
case is designed to catch, or what internal MECHANISM (predicate,
category) the case is testing.

EVALUATOR_CASE: everything, including every gold/expected field. This is
what a scoring pass reads; it must never reach a runner, a prompt, or
model context.

`grounding_document_ids` stays in RUNNER_CASE deliberately: it names
which documents a case is ABOUT (X0's own bounded-evidence design
already uses exactly this same set), not what the correct answer is --
a B0 arm would ignore it and use the full corpus; X0-X2 use it as the
non-semantic evidence bound the directive's own benchmark plan already
specifies. It is not gold information by the definitions in Trustee
directive Phase 5 Section 15.
"""

_RUNNER_FIELDS = frozenset({"case_id", "query", "grounding_document_ids"})

# Every field name this module has ever seen carry gold/evaluator-only
# information, across all case batches -- used by the leakage test, not
# just by to_runner_case()'s own construction (which is safe by
# construction since it only copies _RUNNER_FIELDS). This list exists so
# the leakage test can also catch a FUTURE case author accidentally
# adding a new gold-shaped field under a different name and not updating
# this module.
EVALUATOR_ONLY_FIELD_NAMES = frozenset({
    "expected_state", "ungoverned_failure_mode", "category",
    "cross_cutting_tags", "predicate", "compare_against_predicate",
    "_correction", "_redteam_purpose", "_construction_note",
})


def to_runner_case(case):
    """The view a tested system (comparator arm or real model) may see.
    Constructed by ALLOWLIST (copy only _RUNNER_FIELDS), not by deleting
    known-bad fields -- an allowlist fails closed on an unrecognized new
    field; a denylist would leak it silently."""
    return {k: case[k] for k in _RUNNER_FIELDS if k in case}


def to_evaluator_case(case):
    """The full case, unmodified -- what a scoring pass reads. Identity
    function today; exists as a named seam so evaluator-side code always
    goes through case_view.py rather than reading raw case dicts
    directly, matching runner code's own discipline."""
    return dict(case)


def assert_no_leakage(runner_case):
    """Raises AssertionError if `runner_case` contains any evaluator-only
    field, at the top level or nested inside any value (dict or list).
    Call this on whatever object actually gets serialized into a prompt
    or handed to a retrieval/extraction pipeline -- not just on the
    output of to_runner_case() itself (which is safe by construction),
    but on call sites that might have merged additional data back in."""
    _check(runner_case, path="<root>")


def _check(obj, path):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in EVALUATOR_ONLY_FIELD_NAMES:
                raise AssertionError(
                    f"Leakage detected at {path}.{key}: evaluator-only field "
                    f"reached a runner-facing object."
                )
            _check(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _check(item, f"{path}[{i}]")

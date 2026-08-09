"""
LNES-60 Phase 1 dev-phase autopsy: generate 100 development cases,
run each through the deterministic engine, compare against the
generator's independently-derived expected_operational_state, and report
mismatches for classification/repair. No model/LLM involved -- this
tests the convergence engine, witness validator, temporal resolver, and
configuration resolver directly.
"""

import json
import sys

from lnes60.synthetic_generator import generate_dataset
from lnes60.convergence_engine import converge, ConvergenceQuery
from lnes60.release_policy import evaluate_release, MissionEnvelopeCheck


def run_case(case):
    q = ConvergenceQuery(
        aircraft_id=case.aircraft_id, component_id=case.component_id, predicate=case.predicate,
        claim_scope=case.claim_scope, as_of=case.as_of,
        documentary_record_ids=[d.record_id for d in case.documentary],
        command_state_field=case.command_field,
        witness_ids=[w.reading_id for w in case.witnesses],
    )
    seen_tokens = set()
    result = converge(q, case.documentary, case.command, case.witnesses, case.events, seen_tokens)
    policy = evaluate_release([result], MissionEnvelopeCheck(case.mission_within_envelope, case.mission_envelope_reason))
    return result, policy


def main():
    cases = generate_dataset(n=100, seed=60)
    mismatches = []
    class_counts = {}
    for case in cases:
        class_counts[case.ktx_class] = class_counts.get(case.ktx_class, 0) + 1
        result, policy = run_case(case)
        if result.operational_state.value != case.expected_operational_state:
            mismatches.append({
                "case_id": case.case_id, "ktx_class": case.ktx_class,
                "expected": case.expected_operational_state,
                "actual": result.operational_state.value,
                "hand_trace": case.hand_trace,
                "reason_codes": result.reason_codes,
                "conflict_detail": result.conflict_detail,
            })

    print(f"total_cases={len(cases)}")
    print(f"class_distribution={json.dumps(class_counts, indent=2)}")
    print(f"mismatches={len(mismatches)}")
    for m in mismatches:
        print(json.dumps(m, indent=2))

    with open("dev_cases/dev_autopsy_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "total_cases": len(cases), "class_distribution": class_counts,
            "mismatch_count": len(mismatches), "mismatches": mismatches,
        }, f, indent=2)

    return 0 if not mismatches else 1


if __name__ == "__main__":
    sys.exit(main())

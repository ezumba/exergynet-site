"""
Post-freeze holdout authoring. Per LNES60_EXPERIMENT_PROTOCOL.md and
LNES-59 precedent: authored using the (unfrozen) synthetic_generator
tooling, which does NOT import or call any of the frozen decision-logic
modules (state_consistency-equivalent files) -- ground truth is the
generator's own hand-authored per-class expectation, never derived by
running convergence_engine.py against these cases. Fresh, disjoint ID
space from the 100-case dev corpus (prefix HOLD- vs DEV-, aircraft
offset 9000 vs 100).

Produces the runner/evaluator air-gap split (LNES60_RUNNER_HOLDOUT.json
strips every ground-truth field; LNES60_EVALUATOR_HOLDOUT.json keeps
them) plus manifests and hashes, sealed before any blind execution.
"""

import json
import dataclasses
from enum import Enum

from lnes60.synthetic_generator import generate_dataset, KTX_CLASSES
from lnes60.manifests import sha256_file

EVALUATOR_ONLY_FIELDS = {"expected_operational_state", "expected_release", "hand_trace", "ktx_class"}


def _json_default(o):
    if isinstance(o, Enum):
        return o.value
    if dataclasses.is_dataclass(o):
        return dataclasses.asdict(o)
    raise TypeError(f"not serializable: {type(o)}")


def case_to_dict(case):
    d = dataclasses.asdict(case)
    return d


def main():
    # 50 holdout cases across 20 KTX classes (>=2 each), fresh ID space.
    cases = generate_dataset(n=50, seed=99160, prefix="HOLD", aircraft_offset=9000)

    evaluator_cases = [case_to_dict(c) for c in cases]
    runner_cases = []
    for d in evaluator_cases:
        runner_d = {k: v for k, v in d.items() if k not in EVALUATOR_ONLY_FIELDS}
        runner_cases.append(runner_d)

    with open("LNES60_RUNNER_HOLDOUT.json", "w", encoding="utf-8") as f:
        json.dump({"cases": runner_cases}, f, indent=2, default=_json_default)

    with open("LNES60_EVALUATOR_HOLDOUT.json", "w", encoding="utf-8") as f:
        json.dump({"cases": evaluator_cases}, f, indent=2, default=_json_default)

    class_counts = {}
    for c in cases:
        class_counts[c.ktx_class] = class_counts.get(c.ktx_class, 0) + 1

    runner_hash = sha256_file("LNES60_RUNNER_HOLDOUT.json")
    evaluator_hash = sha256_file("LNES60_EVALUATOR_HOLDOUT.json")

    manifest = {
        "_purpose": "LNES-60 Phase 1 holdout manifest. Sealed post-freeze, never executed against the frozen engine during authoring.",
        "authored_date": "2026-08-08",
        "total_holdout_cases": len(cases),
        "ktx_class_distribution": class_counts,
        "ktx_classes_covered": len(class_counts),
        "all_classes_hit_at_least_twice": all(v >= 2 for v in class_counts.values()),
        "fresh_id_space": {
            "case_id_prefix": "HOLD-",
            "aircraft_id_offset": 9000,
            "dev_corpus_prefix": "DEV-",
            "dev_corpus_aircraft_offset": 100,
            "collision_with_dev_corpus": False,
        },
        "runner_holdout_file": "LNES60_RUNNER_HOLDOUT.json",
        "runner_holdout_sha256": runner_hash,
        "evaluator_holdout_file": "LNES60_EVALUATOR_HOLDOUT.json",
        "evaluator_holdout_sha256": evaluator_hash,
        "evaluator_only_fields": sorted(EVALUATOR_ONLY_FIELDS),
        "ground_truth_derivation": "Hand-authored per-KTX-class expectation inside synthetic_generator.generate_case(), which contains no import of or call to any frozen decision-logic module. Ground truth was never produced by running convergence_engine.py/release_policy.py against these cases.",
        "architecture_freeze_commit": "784c55f",
        "architecture_freeze_manifest": "LNES60_PRE_HOLDOUT_CODE_MANIFEST.json",
    }
    with open("LNES60_HOLDOUT_MANIFEST.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    with open("LNES60_HOLDOUT_SHA256.txt", "w", encoding="utf-8") as f:
        f.write(f"LNES60_RUNNER_HOLDOUT.json  {runner_hash}\n")
        f.write(f"LNES60_EVALUATOR_HOLDOUT.json  {evaluator_hash}\n")

    ground_truth = {
        c.case_id: {
            "expected_operational_state": c.expected_operational_state,
            "ktx_class": c.ktx_class,
            "hand_trace": c.hand_trace,
        }
        for c in cases
    }
    with open("LNES60_GROUND_TRUTH_MANIFEST.json", "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)

    print(f"holdout cases: {len(cases)}")
    print(f"classes covered: {len(class_counts)} / {len(KTX_CLASSES)}")
    print(f"all classes >=2 instances: {manifest['all_classes_hit_at_least_twice']}")
    print(f"runner_holdout_sha256: {runner_hash}")
    print(f"evaluator_holdout_sha256: {evaluator_hash}")


if __name__ == "__main__":
    main()

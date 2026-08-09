"""
LNES-59.2B prompt precomputation, resumable per-case (infrastructure fix
-- the first attempt held all 400 items in memory and only wrote to disk
once at the end; killed mid-run, all progress was lost. This version
writes one file per case as soon as that case's 8 work items are built,
and skips cases whose file already exists on restart -- no change to any
frozen parameter, prompt, or arm definition, purely a checkpointing fix
per continuous-execution directive section 7.)
"""

import json
import os
import sys
import time

from arm_runner import load_holdout, build_shared_indices, build_work_item, ARMS

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(SCRIPT_DIR, "precomputed_prompts")


def case_file(case_id):
    return os.path.join(PROMPTS_DIR, f"{case_id}.json")


def main():
    os.makedirs(PROMPTS_DIR, exist_ok=True)
    runner, evaluator, docs_by_id = load_holdout()
    with open(os.path.join(SCRIPT_DIR, "LNES59_ARM_CONFIGS.json"), encoding="utf-8") as f:
        arm_configs = json.load(f)

    t0 = time.time()
    indices = build_shared_indices(docs_by_id)
    print(f"shared indices built in {round(time.time()-t0,1)}s: {indices['build_times']}", flush=True)

    remaining = [c for c in evaluator["cases"] if not os.path.exists(case_file(c["case_id"]))]
    print(f"{len(evaluator['cases'])} total cases, {len(remaining)} remaining to precompute", flush=True)

    for i, case in enumerate(remaining):
        case_items = {}
        for arm in ARMS:
            t0 = time.time()
            item = build_work_item(case, arm, docs_by_id, indices, arm_configs)
            item.pop("_committed_state", None)
            case_items[arm] = item
            print(f"  {case['case_id']} {arm}: prompt_len={len(item['prompt'])} built_in={round(time.time()-t0,1)}s", flush=True)
        tmp = case_file(case["case_id"]) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(case_items, f, indent=2)
        os.replace(tmp, case_file(case["case_id"]))
        print(f"[{i+1}/{len(remaining)}] {case['case_id']} checkpointed to disk", flush=True)

    print("ALL CASES PRECOMPUTED", flush=True)


if __name__ == "__main__":
    main()

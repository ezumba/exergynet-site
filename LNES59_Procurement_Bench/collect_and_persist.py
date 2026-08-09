"""
Bulk-collect generation_responses/{case_id}__{arm}.json files a subagent
already wrote, run them through process_generation.build_raw_result(),
and persist to raw_results/ + the execution ledger. Resumable/idempotent
-- skips anything already marked completed in the ledger.
"""

import glob
import json
import os

from arm_runner import load_holdout
from process_generation import build_raw_result
from execution_ledger import load_ledger, mark_in_progress, mark_completed, mark_failed, write_raw_result, RAW_RESULTS_DIR

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESPONSES_DIR = os.path.join(SCRIPT_DIR, "generation_responses")
PROMPTS_DIR = os.path.join(SCRIPT_DIR, "precomputed_prompts")


def main():
    runner, evaluator, docs_by_id = load_holdout()
    cases_by_id = {c["case_id"]: c for c in evaluator["cases"]}
    ledger = load_ledger()

    _prompt_cache = {}
    collected, skipped, errors = 0, 0, 0

    for path in sorted(glob.glob(os.path.join(RESPONSES_DIR, "*.json"))):
        base = os.path.splitext(os.path.basename(path))[0]
        case_id, arm = base.split("__")
        key = f"{case_id}::{arm}"

        if ledger["entries"].get(key, {}).get("status") == "completed":
            skipped += 1
            continue

        if case_id not in _prompt_cache:
            with open(os.path.join(PROMPTS_DIR, f"{case_id}.json"), encoding="utf-8") as f:
                _prompt_cache[case_id] = json.load(f)
        items = _prompt_cache[case_id]
        case = cases_by_id[case_id]

        with open(path, encoding="utf-8") as f:
            raw_text = f.read()

        mark_in_progress(ledger, case_id, arm)
        try:
            record = build_raw_result(
                case, arm, items[arm], raw_text, docs_by_id,
                attempts_log=[{"attempt": 1, "raw_response": raw_text, "error_state": None}],
                retry_count=0,
            )
            result_path = write_raw_result(case_id, arm, record)
            mark_completed(ledger, case_id, arm, result_path)
            collected += 1
        except Exception as e:
            mark_failed(ledger, case_id, arm, f"persist_error: {type(e).__name__}: {e}")
            errors += 1
            print(f"  ERROR persisting {key}: {e}")

    print(f"collected={collected} skipped_already_done={skipped} errors={errors}")

    done = sum(1 for e in ledger["entries"].values() if e["status"] == "completed")
    failed = sum(1 for e in ledger["entries"].values() if e["status"] == "failed")
    print(f"ledger total: {done} completed, {failed} failed, {len(ledger['entries'])} total entries")


if __name__ == "__main__":
    main()

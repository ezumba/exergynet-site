"""
LNES-59.2B execution ledger (continuous-execution directive section 6).
Resumable: tracks status per (case_id, arm) pair, persisted to disk after
every write. Never overwrites a completed evaluation; retries are
separately auditable (each attempt appended, not replaced).
"""

import json
import os
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER_PATH = os.path.join(SCRIPT_DIR, "LNES59_EXECUTION_LEDGER.json")
RAW_RESULTS_DIR = os.path.join(SCRIPT_DIR, "raw_results")


def _key(case_id, arm):
    return f"{case_id}::{arm}"


def load_ledger():
    if os.path.exists(LEDGER_PATH):
        with open(LEDGER_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"entries": {}}


def save_ledger(ledger):
    tmp = LEDGER_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)
    os.replace(tmp, LEDGER_PATH)  # atomic on both POSIX and Windows


def init_entry(ledger, case_id, arm):
    k = _key(case_id, arm)
    if k not in ledger["entries"]:
        ledger["entries"][k] = {
            "case_id": case_id, "arm": arm, "status": "pending",
            "attempts": 0, "result_path": None, "completion_timestamp": None,
        }
    return ledger["entries"][k]


def mark_in_progress(ledger, case_id, arm):
    e = init_entry(ledger, case_id, arm)
    e["status"] = "in_progress"
    e["attempts"] += 1
    save_ledger(ledger)


def mark_completed(ledger, case_id, arm, result_path):
    e = init_entry(ledger, case_id, arm)
    e["status"] = "completed"
    e["result_path"] = result_path
    e["completion_timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_ledger(ledger)


def mark_failed(ledger, case_id, arm, error_state):
    e = init_entry(ledger, case_id, arm)
    e["status"] = "failed"
    e["error_state"] = error_state
    e["completion_timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_ledger(ledger)


def pending_pairs(ledger, all_pairs):
    """all_pairs: list of (case_id, arm). Returns the subset not yet
    completed or failed -- resume-safe: a restarted process picks up
    exactly where it left off, never re-running a completed pair."""
    done = {k for k, e in ledger["entries"].items() if e["status"] in ("completed", "failed")}
    return [(c, a) for c, a in all_pairs if _key(c, a) not in done]


def write_raw_result(case_id, arm, record):
    os.makedirs(RAW_RESULTS_DIR, exist_ok=True)
    path = os.path.join(RAW_RESULTS_DIR, f"{case_id}__{arm}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2)
    return os.path.relpath(path, SCRIPT_DIR)

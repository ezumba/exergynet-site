"""
LNES-59 dataset registry -- canonical, manifest-driven file discovery.
Replaces the hardcoded per-file tuples that used to need updating in
three separate places (deterministic_extraction.py, run_case.py,
arm_x2.py, validate_extraction_against_cases.py) for every new batch.

Explicitly NOT directory-wide auto-discovery: LNES59_DATASET_MANIFEST.json
is the SOLE authority for what counts as dataset content. A *.json file
sitting in this directory that isn't listed in the manifest is invisible
to every loader that goes through this module -- by design, this is what
keeps ground-truth files, the future holdout evaluator file, scratch
output, and diagnostics out of accidental inclusion. The manifest is the
boundary, not the filesystem.

Every returned file is integrity-verified against the manifest's declared
SHA-256 before its name is handed back -- a mismatch is a hard error, not
a silent load, so a file edited without updating the manifest (or a stale
manifest after a legitimate edit) is caught immediately rather than
silently feeding a loader different content than what's on record.
"""

import hashlib
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(SCRIPT_DIR, "LNES59_DATASET_MANIFEST.json")


def _sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def _load_manifest():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return json.load(f)


def _verify_and_list(entries, kind):
    files = []
    for entry in entries:
        path = os.path.join(SCRIPT_DIR, entry["file"])
        if not os.path.exists(path):
            raise RuntimeError(
                f"LNES59_DATASET_MANIFEST.json declares {kind} {entry['file']!r} "
                f"but that file does not exist in {SCRIPT_DIR}."
            )
        actual = _sha256(path)
        if actual != entry["sha256"]:
            raise RuntimeError(
                f"LNES59_DATASET_MANIFEST.json integrity check failed for {kind} "
                f"{entry['file']!r}: manifest declares sha256={entry['sha256']!r}, "
                f"actual file hash is {actual!r}. Either the file was modified "
                f"without updating the manifest, or the manifest is stale -- fix "
                f"the discrepancy (update the manifest's hash if the edit was "
                f"intentional) before loading. Never silently proceed on a mismatch."
            )
        files.append(entry["file"])
    return files


def document_set_files():
    """Ordered list of document batch filenames, integrity-verified
    against the manifest. Every loader that reads document*.json files
    should call this instead of hardcoding a filename tuple."""
    return _verify_and_list(_load_manifest()["document_sets"], "document set")


def case_set_files(role=None):
    """Ordered list of case batch filenames, integrity-verified against
    the manifest. `role` filters to 'development' or 'holdout' when
    given; omitted returns every case_set entry regardless of role (which,
    before the holdout is sealed, is development-only anyway since no
    holdout case_sets exist in the manifest yet)."""
    entries = _load_manifest()["case_sets"]
    if role is not None:
        entries = [e for e in entries if e.get("role") == role]
    return _verify_and_list(entries, "case set")

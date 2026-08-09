"""Small hashing utilities shared by the freeze/seal scripts."""

import hashlib
import glob
import os


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def sha256_dir(pattern):
    h = hashlib.sha256()
    for path in sorted(glob.glob(pattern, recursive=True)):
        if os.path.isdir(path):
            continue
        with open(path, "rb") as f:
            h.update(os.path.basename(path).encode())
            h.update(f.read())
    return h.hexdigest()

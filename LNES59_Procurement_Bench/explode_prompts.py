"""
Explodes each precomputed_prompts/{case_id}.json into 8 individual
prompts_txt/{case_id}__{arm}.txt files -- so each generation subagent
does exactly ONE small, targeted Read instead of me pasting 400 prompts
into my own context (which would be enormous and wasteful) or agents
reading a JSON blob and having to parse out their own field. Pure
convenience export, no change to prompt content itself.
"""

import glob
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(SCRIPT_DIR, "precomputed_prompts")
TXT_DIR = os.path.join(SCRIPT_DIR, "prompts_txt")


def explode():
    os.makedirs(TXT_DIR, exist_ok=True)
    written = 0
    for path in sorted(glob.glob(os.path.join(PROMPTS_DIR, "*.json"))):
        case_id = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for arm, item in data.items():
            out_path = os.path.join(TXT_DIR, f"{case_id}__{arm}.txt")
            if os.path.exists(out_path):
                continue
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(item["prompt"])
            written += 1
    print(f"exploded {written} new prompt files into {TXT_DIR}")


if __name__ == "__main__":
    explode()

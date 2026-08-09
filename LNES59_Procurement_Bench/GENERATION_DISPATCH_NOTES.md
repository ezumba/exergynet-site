# LNES-59.2B generation dispatch plan (working notes, not a frozen artifact)

Precompute (`precompute_prompts.py`) writes `precomputed_prompts/{case_id}.json`
= {arm: work_item} for all 8 arms, one file per case, resumable.

Dispatch mechanism: a plain Python module/script cannot call the Agent
tool -- only I (the orchestrating session) can. Per case, once its
precomputed file exists, I dispatch 8 Agent-tool subagent calls in
parallel (one per arm) in a single message, each with the arm's exact
`work_item["prompt"]` text plus a one-line instruction to return ONLY
that JSON object as the final answer (no tool use, no commentary --
these subagents don't need any tools for this task). 50 rounds of 8
parallel calls, not 400 sequential ones.

Each subagent's returned text is fed through
`process_generation.build_raw_result()` (parses CandidateClaim, applies
retry classification, runs the V7 gate for X1/X2, scores via
comparator_metrics.py) and persisted via
`execution_ledger.write_raw_result()` + `mark_completed()`/`mark_failed()`.

Retry policy (LNES59_RETRY_POLICY.json): a malformed/empty response gets
re-dispatched with the IDENTICAL prompt, up to 2 retries (3 attempts
total), before being recorded as a terminal error_state and moved past
(never blocks the rest of the run).

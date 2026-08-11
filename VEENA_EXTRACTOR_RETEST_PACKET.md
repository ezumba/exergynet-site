# MyMonitor Extractor Fix — Re-test Packet for Veena

Deployed 2026-08-11. The exact same 8 prompts you supplied, unchanged, for
independent verification against production `/v1/extract`. Not sent —
prepared for your review before anyone sends it.

For each case, POST to `/v1/extract` with `domain: "clinical"` and the
schema shown. New in the response: `needs_clarification` (per-field
boolean) alongside the existing `extracted` and `confidence` fields —
existing response fields are unchanged in type/meaning except `confidence`,
which now reflects confidence in the extracted *state* (including a
confident null) rather than a raw populated-field ratio.

---

**Case 1 — smoking_status**
```json
{
  "text": "Patient denies smoking",
  "domain": "clinical",
  "schema": { "smoking_status": { "type": "boolean", "description": "Does the patient smoke?" } }
}
```
Expected: `extracted.smoking_status = false`, `needs_clarification.smoking_status = false`

**Case 2 — medication_history**
```json
{
  "text": "No medication history available",
  "domain": "clinical",
  "schema": { "medication_history": { "type": "string", "description": "Does the patient have any medication history?" } }
}
```
Expected: `extracted.medication_history = null`, `needs_clarification.medication_history = true`

**Case 3 — blood_pressure**
```json
{
  "text": "Blood pressure recorded at 150/95",
  "domain": "clinical",
  "schema": { "blood_pressure": { "type": "string", "description": "What is the patient's blood pressure?" } }
}
```
Expected: `extracted.blood_pressure = "150/95"`, `needs_clarification.blood_pressure = false`

**Case 4 — age**
```json
{
  "text": "Patient is 65 years old with hypertension",
  "domain": "clinical",
  "schema": { "age": { "type": "integer", "description": "What is the patient's age?" } }
}
```
Expected: `extracted.age = 65`, `needs_clarification.age = false`

**Case 5 — rash**
```json
{
  "text": "I have had a rash for three days",
  "domain": "clinical",
  "schema": { "rash": { "type": "boolean", "description": "Does the patient have a rash?" } }
}
```
Expected: `extracted.rash = true`, `needs_clarification.rash = false`

**Case 6 — cough**
```json
{
  "text": "I do not know",
  "domain": "clinical",
  "schema": { "cough": { "type": "boolean", "description": "Does the patient have a cough?" } }
}
```
Expected: `extracted.cough = null`, `needs_clarification.cough = true`

**Case 7 — cough_duration**
```json
{
  "text": "For about 7 days",
  "domain": "clinical",
  "schema": { "cough_duration": { "type": "string", "description": "How long has the patient been coughing?" } }
}
```
Expected: `extracted.cough_duration` contains "7", `needs_clarification.cough_duration = false`

**Case 8 — nausea_duration**
```json
{
  "text": "For about 15 days",
  "domain": "clinical",
  "schema": { "nausea_duration": { "type": "string", "description": "How long has the patient had nausea?" } }
}
```
Expected: `extracted.nausea_duration` contains "15", `needs_clarification.nausea_duration = false`

---

**Internal verification result (2026-08-11, live production model, direct
gRPC — not a mock):** 8/8 pass on a clean run. Full detail, including
negation-control pairs and an occasional (~1/17) transient empty-response
note, in `MYMONITOR_EXTRACTOR_SEMANTIC_CONTRACT.md`.

**Note if you're using the bare `{"field": "type"}` shorthand** (no
`description`) instead of the object form shown above: this also works
(verified), but binding is less reliable without the question text — the
object form with `description` is recommended, especially for
duration/contextual fields.

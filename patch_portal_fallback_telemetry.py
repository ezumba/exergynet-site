"""
Patches Portal biological_proxy/index.js:
Adds structured JSON telemetry (§3 of recovery directive) to the LNES-20
cognitive router so that fallback events are visible in internal logs.

Fields logged:
  event         : 'vanguard_routing' | 'vanguard_routing_fallback'
  requested_model : the model string from the request
  served_backend  : 'proposer' | 'auditor' | 'xai'
  fallback_used   : true/false
  fallback_reason : null | 'auditor_auth_failure:<status>' | 'auditor_unreachable'
"""

with open('/tmp/portal_bproxy_for_telemetry.js', 'r', encoding='utf-8') as f:
    src = f.read()

# ── Patch 1: Auditor unreachable → proposer fallback ─────────────────────────
old1 = (
    "    if (auditorLive) {\n"
    "      VG_URL = AUDITOR_URL;\n"
    "      console.log(`[LNES-20] Routing model=\"${requestedModel}\" → Auditor (Nemotron) ${AUDITOR_URL}`);\n"
    "    } else {\n"
    "      VG_URL = PROPOSER_URL;\n"
    "      console.warn(`[LNES-20] Auditor unreachable — failing over model=\"${requestedModel}\" → Proposer ${PROPOSER_URL}`);\n"
    "    }"
)

new1 = (
    "    if (auditorLive) {\n"
    "      VG_URL = AUDITOR_URL;\n"
    "      console.log(`[LNES-20] Routing model=\"${requestedModel}\" → Auditor (Nemotron) ${AUDITOR_URL}`);\n"
    "    } else {\n"
    "      VG_URL = PROPOSER_URL;\n"
    "      console.warn(`[LNES-20] Auditor unreachable — failing over model=\"${requestedModel}\" → Proposer ${PROPOSER_URL}`);\n"
    "      console.log(JSON.stringify({ event: 'vanguard_routing_fallback', requested_model: requestedModel, served_backend: 'proposer', fallback_used: true, fallback_reason: 'auditor_unreachable' }));\n"
    "    }"
)

assert old1 in src, 'Patch 1 target not found'
assert src.count(old1) == 1, f'Patch 1: expected 1 match, found {src.count(old1)}'
src = src.replace(old1, new1, 1)
print('PATCH 1: auditor_unreachable telemetry added')

# ── Patch 2: Auditor auth failure (401/403) → proposer fallback ──────────────
old2 = (
    "          console.warn('[LNES-20] Auditor auth failed (' + upstream.status + ') — falling back to Proposer');\n"
)

new2 = (
    "          console.warn('[LNES-20] Auditor auth failed (' + upstream.status + ') — falling back to Proposer');\n"
    "          console.log(JSON.stringify({ event: 'vanguard_routing_fallback', requested_model: requestedModel, served_backend: 'proposer', fallback_used: true, fallback_reason: 'auditor_auth_failure:' + upstream.status }));\n"
)

assert old2 in src, 'Patch 2 target not found'
assert src.count(old2) == 1, f'Patch 2: expected 1 match, found {src.count(old2)}'
src = src.replace(old2, new2, 1)
print('PATCH 2: auditor_auth_failure fallback telemetry added')

with open('/tmp/portal_bproxy_patched_telemetry.js', 'w', encoding='utf-8') as f:
    f.write(src)

orig_lines = open('/tmp/portal_bproxy_for_telemetry.js').read().splitlines()
new_lines = src.splitlines()
print(f'Done. {len(orig_lines)} lines -> {len(new_lines)} lines (+{len(new_lines)-len(orig_lines)})')
print('Output: /tmp/portal_bproxy_patched_telemetry.js')

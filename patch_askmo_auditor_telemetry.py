"""
Patches AskMo biological_proxy/src/index.ts:
1. callAuditorHttp(): adds telemetry (auditor_attempted, auditor_status,
   auditor_latency_ms, auditor_failure_class) and optional AUDITOR_AUTH_TOKEN
   env var support for when the credential is provisioned.
"""

with open('/home/azureuser/biological_proxy/src/index.ts', 'r', encoding='utf-8') as f:
    src = f.read()

# Original function — must match exactly (single-quoted strings to avoid Python escape issues)
old_fn = (
    'function callAuditorHttp(\n'
    '  systemPrompt: string,\n'
    '  userPrompt: string,\n'
    '  maxTokens: number = 220,\n'
    '  timeoutMs: number = 8000\n'
    '): Promise<string> {\n'
    '  return new Promise((resolve, reject) => {\n'
    '    const ctrl = new AbortController();\n'
    '    const timer = setTimeout(() => { ctrl.abort(); reject(new Error(\'auditor http timeout\')); }, timeoutMs);\n'
    '    fetch(REAL_AUDITOR_HTTP_URL, {\n'
    '      method: \'POST\',\n'
    '      headers: { \'Content-Type\': \'application/json\' },\n'
    '      body: JSON.stringify({\n'
    '        messages: [{ role: \'system\', content: systemPrompt }, { role: \'user\', content: userPrompt }],\n'
    '        max_tokens: maxTokens,\n'
    '      }),\n'
    '      signal: ctrl.signal,\n'
    '    })\n'
    '      .then(r => r.json())\n'
    '      .then((data: any) => {\n'
    '        clearTimeout(timer);\n'
    '        // Nemotron sometimes emits reasoning_content and leaves content empty\n'
    '        // if it hits max_tokens mid-thought — fall back rather than treat as failure.\n'
    '        const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || \'\';\n'
    '        if (!isValidEngineResponse(content)) {\n'
    '          reject(new Error(\'auditor returned empty/invalid content: \' + content.slice(0, 120)));\n'
    '          return;\n'
    '        }\n'
    '        resolve(content);\n'
    '      })\n'
    '      .catch(err => { clearTimeout(timer); reject(err); });\n'
    '  });\n'
    '}'
)

assert old_fn in src, f'Patch target not found. Check exact whitespace.'
count = src.count(old_fn)
assert count == 1, f'Expected 1 match, found {count}'

new_fn = (
    'function callAuditorHttp(\n'
    '  systemPrompt: string,\n'
    '  userPrompt: string,\n'
    '  maxTokens: number = 220,\n'
    '  timeoutMs: number = 8000\n'
    '): Promise<string> {\n'
    '  const t0 = Date.now();\n'
    '  // AUDITOR_AUTH_TOKEN: set this env var when the auditor credential is provisioned\n'
    '  // to unblock BLK-013 without a code change. Currently unset — auditor returns 401.\n'
    '  const authToken = process.env.AUDITOR_AUTH_TOKEN || \'\';\n'
    '  console.log(JSON.stringify({ event: \'auditor_attempted\', url: REAL_AUDITOR_HTTP_URL, auth_configured: !!authToken }));\n'
    '  return new Promise((resolve, reject) => {\n'
    '    const ctrl = new AbortController();\n'
    '    const timer = setTimeout(() => {\n'
    '      ctrl.abort();\n'
    '      console.error(JSON.stringify({ event: \'auditor_result\', auditor_status: \'timeout\', auditor_latency_ms: Date.now() - t0, auditor_failure_class: \'timeout\' }));\n'
    '      reject(new Error(\'auditor http timeout\'));\n'
    '    }, timeoutMs);\n'
    '    const reqHeaders: Record<string, string> = { \'Content-Type\': \'application/json\' };\n'
    '    if (authToken) reqHeaders[\'Authorization\'] = `Bearer ${authToken}`;\n'
    '    fetch(REAL_AUDITOR_HTTP_URL, {\n'
    '      method: \'POST\',\n'
    '      headers: reqHeaders,\n'
    '      body: JSON.stringify({\n'
    '        messages: [{ role: \'system\', content: systemPrompt }, { role: \'user\', content: userPrompt }],\n'
    '        max_tokens: maxTokens,\n'
    '      }),\n'
    '      signal: ctrl.signal,\n'
    '    })\n'
    '      .then(async r => {\n'
    '        clearTimeout(timer);\n'
    '        const latency = Date.now() - t0;\n'
    '        if (!r.ok) {\n'
    '          const failureClass = r.status === 401 || r.status === 403 ? \'auth_failure\'\n'
    '            : r.status >= 500 ? \'server_error\' : \'client_error\';\n'
    '          console.error(JSON.stringify({ event: \'auditor_result\', auditor_status: r.status, auditor_latency_ms: latency, auditor_failure_class: failureClass }));\n'
    '          reject(new Error(`auditor http ${r.status}`));\n'
    '          return;\n'
    '        }\n'
    '        const data: any = await r.json();\n'
    '        // Nemotron sometimes emits reasoning_content and leaves content empty\n'
    '        // if it hits max_tokens mid-thought — fall back rather than treat as failure.\n'
    '        const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || \'\';\n'
    '        if (!isValidEngineResponse(content)) {\n'
    '          console.error(JSON.stringify({ event: \'auditor_result\', auditor_status: r.status, auditor_latency_ms: latency, auditor_failure_class: \'empty_response\' }));\n'
    '          reject(new Error(\'auditor returned empty/invalid content: \' + content.slice(0, 120)));\n'
    '          return;\n'
    '        }\n'
    '        console.log(JSON.stringify({ event: \'auditor_result\', auditor_status: 200, auditor_latency_ms: latency, auditor_failure_class: null }));\n'
    '        resolve(content);\n'
    '      })\n'
    '      .catch(err => {\n'
    '        clearTimeout(timer);\n'
    '        console.error(JSON.stringify({ event: \'auditor_result\', auditor_status: \'network_error\', auditor_latency_ms: Date.now() - t0, auditor_failure_class: \'network_error\', error: err.message }));\n'
    '        reject(err);\n'
    '      });\n'
    '  });\n'
    '}'
)

src = src.replace(old_fn, new_fn, 1)

with open('/home/azureuser/biological_proxy/src/index.ts', 'w', encoding='utf-8') as f:
    f.write(src)

print('PATCH: callAuditorHttp telemetry + AUDITOR_AUTH_TOKEN hook applied')
print(f'Lines: {len(src.splitlines())}')

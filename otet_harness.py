#!/usr/bin/env python3
"""
ExergyNet OTET Harness v1.1 — Claude Code Edition (LNES-17)
Kinetic Architectural Oversight — API-only write path.

All EC2 file edits MUST go through this harness. SSH file writes are blocked
by the agent_shell_gate.sh on both EC2 instances.

COMMANDS:

  apply <local_file> <remote_file_path> <service_name> --narrative "..." [--lines-added N] [--lines-removed N]
    Full flow: witness -> write via API -> verify written -> record to Vanguard Scribe.
    Use this for all EC2 file edits.

  witness <remote_file_path> <service_name>
    Step 1 only: prove you read the file, get OTET token.

  record <otet_token> <remote_file_path> --narrative "..." [--lines-added N] [--lines-removed N]
    Step 3 only: spend OTET and record to Vanguard Scribe (no file write).

  restart <service_name> [<host>]
    Restart a PM2 service via SSH.
    host: portal (default, 52.44.165.199) | carrier (3.234.120.103)

  clear-token
    Clear cached admin token (re-login next run).

Config (~/.env.otet or exergynet/.env.otet):
  PORTAL_URL=https://portal.exergynet.org
  ADMIN_EMAIL=ezumbadynastytrust@gmail.com
  ADMIN_PASSWORD=ExergyAdmin2026!
  SSH_KEY_PATH=/path/to/key.pem   (optional — overrides default search)
"""

import sys, os, hashlib, json, urllib.request, urllib.error, urllib.parse, subprocess, time

HARNESS_VERSION = "1.1.0"

PORTAL_URL  = os.environ.get("PORTAL_URL", "https://portal.exergynet.org")
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, ".env.otet")
TOKEN_CACHE = os.path.join(SCRIPT_DIR, ".otet_token_cache")

# SSH keys searched in order — agent key first (restricted), ubuntu key as fallback
AGENT_KEY_PATHS = [
    "/home/edt/.ssh/exergynet_agent",
    os.path.expanduser("~/.ssh/exergynet_agent"),
    # Windows paths
    os.path.expanduser("~\\.ssh\\exergynet.pem"),
    os.path.expanduser("~/.ssh/exergynet.pem"),
]
EC2_HOSTS = {
    "portal":  "ubuntu@52.44.165.199",
    "carrier": "ubuntu@3.234.120.103",
}
# PM2 service names on portal EC2 (pass exactly to restart cmd):
#   biological_proxy, exergynet-portal, aeris-markets, aeris-v2-frontend,
#   exergynet-explorer, exergynet-forge, space-synthesize, space-transcribe,
#   voice-clone, x402_Gateway

# Timeout for large-file deploys (biological_proxy is 128kb+)
API_TIMEOUT_SMALL = 15   # witness, issue-otet, verify
API_TIMEOUT_LARGE = 180  # agent-edit write (large content over WAN)


def ok(msg):
    """Print success — ASCII only, safe on all platforms including Windows cp1252."""
    print(f"[OK] {msg}")


def load_config():
    cfg = {}
    for path in [CONFIG_FILE, os.path.expanduser("~/.env.otet")]:
        if os.path.exists(path):
            for line in open(path).read().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    cfg[k.strip()] = v.strip()
    return cfg


def get_admin_token(force_refresh=False):
    if not force_refresh and os.path.exists(TOKEN_CACHE):
        return open(TOKEN_CACHE).read().strip()
    cfg = load_config()
    email    = cfg.get("ADMIN_EMAIL") or input("Admin email: ")
    password = cfg.get("ADMIN_PASSWORD") or input("Admin password: ")
    data = json.dumps({"email": email, "password": password}).encode()
    req  = urllib.request.Request(
        f"{PORTAL_URL}/api/admin/login", data=data,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT_SMALL) as r:
            body = json.loads(r.read())
        token = body.get("token")
        if not token:
            print(f"ERROR: Login failed -- {body.get('error', 'no token')}")
            sys.exit(1)
        open(TOKEN_CACHE, "w").write(token)
        print("[AUTH] Logged in, token cached.")
        return token
    except urllib.error.HTTPError as e:
        print(f"ERROR: Login HTTP {e.code} -- {e.read().decode()}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Login network failure -- {e}")
        print(f"  Is {PORTAL_URL} reachable? Check VPN / DNS.")
        sys.exit(1)


def api(method, path, body=None, token=None, timeout=None):
    if timeout is None:
        timeout = API_TIMEOUT_LARGE if body and len(json.dumps(body)) > 50_000 else API_TIMEOUT_SMALL
    url  = f"{PORTAL_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", errors="replace")
        try:    return json.loads(txt), e.code
        except: return {"error": txt[:500]}, e.code
    except TimeoutError as e:
        payload_kb = round(len(data) / 1024) if data else 0
        print(f"  [TIMEOUT] Request timed out after {timeout}s (payload {payload_kb}kb)")
        print(f"  Hint: network latency or server overloaded. Retry once automatically...")
        raise


def api_with_retry(method, path, body=None, token=None, timeout=None, retries=1):
    """api() with one automatic retry on timeout."""
    for attempt in range(retries + 1):
        try:
            return api(method, path, body=body, token=token, timeout=timeout)
        except TimeoutError:
            if attempt < retries:
                print(f"  Retrying (attempt {attempt + 2}/{retries + 1})...")
                time.sleep(2)
            else:
                print("ERROR: All retry attempts timed out.")
                sys.exit(1)


def agent_key():
    """Return first existing SSH key, checking env override first."""
    cfg = load_config()
    env_key = cfg.get("SSH_KEY_PATH") or os.environ.get("SSH_KEY_PATH")
    if env_key and os.path.exists(env_key):
        return env_key
    for p in AGENT_KEY_PATHS:
        if os.path.exists(p):
            return p
    return None


def cmd_apply(local_file, remote_path, service_name, narrative, lines_added=None, lines_removed=None):
    """Full flow: witness -> write via API -> verify written -> record."""
    if not os.path.exists(local_file):
        print(f"ERROR: local file not found: {local_file}")
        sys.exit(1)

    file_size_kb = round(os.path.getsize(local_file) / 1024, 1)
    print(f"[LNES-17] OTET Harness v{HARNESS_VERSION} | {local_file} ({file_size_kb}kb) -> {remote_path}")

    token = get_admin_token()

    # ── Step 1: Witness ──────────────────────────────────────────────────────
    print(f"[WITNESS] Challenging: {remote_path}")
    resp, status = api_with_retry("GET", f"/api/admin/build/witness-file?path={urllib.parse.quote(remote_path)}", token=token)
    if status != 200:
        if status == 401:
            print("  Token expired — refreshing...")
            token = get_admin_token(force_refresh=True)
            resp, status = api_with_retry("GET", f"/api/admin/build/witness-file?path={urllib.parse.quote(remote_path)}", token=token)
        if status != 200:
            print(f"ERROR: witness-file failed (HTTP {status})")
            print(f"  Response: {resp}")
            hints = {
                401: "Token expired or invalid — run: python otet_harness.py clear-token",
                403: "Path traversal blocked — use absolute Linux path (e.g. /home/ubuntu/...)",
                404: "File not found on server — file must exist before editing (no create_mode support in harness)",
                0:   "Network failure — is biological_proxy running? Check PM2: pm2 list",
            }
            hint = hints.get(status, "Check portal.exergynet.org/api/admin/build/evolution for details")
            print(f"  Hint: {hint}")
            sys.exit(1)

    nonce           = resp["nonce"]
    witness_content = resp.get("file_content", "")
    witness_hash    = hashlib.sha256((witness_content + nonce).encode("utf-8")).hexdigest()
    content_hash    = hashlib.sha256(witness_content.encode("utf-8")).hexdigest()
    print(f"[WITNESS] {len(witness_content)} bytes | content_hash {content_hash[:16]}...")

    # ── Step 2: Issue OTET ───────────────────────────────────────────────────
    issue_body = {
        "service_name": service_name,
        "target_id":    f"agent_edit:{remote_path}",
        "file_path":    remote_path,
        "witness_hash": witness_hash,
        "content_hash": content_hash,   # NEW: plain content hash stored for pre_hash check
    }
    resp2, status2 = api_with_retry("POST", "/api/admin/build/issue-otet", body=issue_body, token=token)
    if status2 != 200:
        print(f"ERROR issue-otet (HTTP {status2}): {resp2}")
        sys.exit(1)
    otet = resp2["otet"]
    print(f"[OTET]    Issued: {otet[:32]}...")

    # ── Step 3: Write via API ─────────────────────────────────────────────────
    with open(local_file, "r", encoding="utf-8") as f:
        new_content = f.read()

    post_hash = hashlib.sha256(new_content.encode("utf-8")).hexdigest()

    old_lines = witness_content.splitlines()
    new_lines = new_content.splitlines()
    if lines_added is None:
        old_set = set(old_lines)
        new_set = set(new_lines)
        lines_added   = sum(1 for l in new_lines if l not in old_set)
        lines_removed = sum(1 for l in old_lines if l not in new_set)

    payload_kb = round(len(new_content.encode("utf-8")) / 1024, 1)
    print(f"[WRITE]   Sending {payload_kb}kb payload...")

    edit_body = {
        "otet":           otet,
        "file_path":      remote_path,
        "content":        new_content,
        "pre_hash":       content_hash,   # matches content_hash stored in DB
        "post_hash":      post_hash,
        "narrative":      narrative,
        "service_name":   service_name,
        "lines_added":    lines_added,
        "lines_removed":  lines_removed,
    }
    resp3, status3 = api_with_retry("POST", "/api/admin/build/agent-edit", body=edit_body, token=token)
    if status3 != 200:
        print(f"ERROR agent-edit (HTTP {status3}): {resp3}")
        sys.exit(1)

    # ── Step 4: Verify written ────────────────────────────────────────────────
    print(f"[VERIFY]  Confirming write on remote...")
    resp4, status4 = api("GET", f"/api/admin/build/witness-file?path={urllib.parse.quote(remote_path)}", token=token)
    if status4 == 200:
        remote_after = resp4.get("file_content", "")
        remote_hash  = hashlib.sha256(remote_after.encode("utf-8")).hexdigest()
        if remote_hash == post_hash:
            ok(f"Verified — remote hash matches local post_hash ({post_hash[:16]}...)")
        else:
            print(f"WARNING: post-write hash mismatch!")
            print(f"  Expected: {post_hash[:32]}")
            print(f"  Remote:   {remote_hash[:32]}")
            print(f"  File may not have been written. Check PM2 logs.")
    else:
        print(f"[VERIFY]  Could not re-witness (HTTP {status4}) — skipping verification.")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"")
    ok(f"File written and recorded to Vanguard Scribe")
    print(f"  Path     : {remote_path}")
    print(f"  Bytes    : {len(new_content.encode('utf-8'))}")
    print(f"  +lines   : {lines_added}  -lines: {lines_removed}")
    print(f"  OTET     : {otet}")
    print(f"  Narrative: {narrative[:80]}")
    print(f"  At       : {resp3.get('spent_at', 'unknown')}")
    return otet


def cmd_witness(remote_path, service_name):
    token = get_admin_token()
    print(f"[WITNESS] Challenging: {remote_path}")
    resp, status = api("GET", f"/api/admin/build/witness-file?path={urllib.parse.quote(remote_path)}", token=token)
    if status != 200:
        print(f"ERROR (HTTP {status}): {resp}")
        if status == 401:
            os.remove(TOKEN_CACHE)
            print("Token expired -- cleared. Re-run.")
        elif status == 0:
            print("Hint: biological_proxy may be down. Check PM2 status.")
        sys.exit(1)
    nonce   = resp["nonce"]
    content = resp.get("file_content", "\x00".join(resp.get("directory_entries", [])))
    w_hash  = hashlib.sha256((content + nonce).encode("utf-8")).hexdigest()
    c_hash  = hashlib.sha256(content.encode("utf-8")).hexdigest()
    print(f"[WITNESS] {len(content)} bytes | content_hash {c_hash[:16]}...")
    resp2, s2 = api("POST", "/api/admin/build/issue-otet", body={
        "service_name": service_name,
        "target_id":    f"agent_edit:{remote_path}",
        "file_path":    remote_path,
        "witness_hash": w_hash,
        "content_hash": c_hash,
    }, token=token)
    if s2 != 200:
        print(f"ERROR issue-otet (HTTP {s2}): {resp2}")
        sys.exit(1)
    otet = resp2["otet"]
    print(f"")
    ok(f"OTET issued: {otet}")
    print(f'  -> After edit: python otet_harness.py record {otet} "{remote_path}" --narrative "..."')
    return otet


def cmd_record(otet, remote_path, narrative, lines_added=None, lines_removed=None, service="claude-code"):
    token = get_admin_token()
    resp, status = api("POST", "/api/admin/build/agent-edit", body={
        "otet":          otet,
        "file_path":     remote_path,
        "narrative":     narrative,
        "service_name":  service,
        "lines_added":   lines_added,
        "lines_removed": lines_removed,
    }, token=token)
    if status != 200:
        print(f"ERROR (HTTP {status}): {resp}")
        sys.exit(1)
    ok(f"Scribe recorded -- {remote_path} -- {narrative[:80]}")


def cmd_restart(service_name, host="portal"):
    key = agent_key()
    if not key:
        print("ERROR: no SSH key found.")
        print("  Searched:", AGENT_KEY_PATHS)
        print("  Set SSH_KEY_PATH=/path/to/key in .env.otet to override.")
        sys.exit(1)
    target = EC2_HOSTS.get(host, EC2_HOSTS["portal"])
    cmd    = f"pm2 restart {service_name} --update-env"
    print(f"[RESTART] {target} pm2 restart {service_name} (key: {os.path.basename(key)})")
    result = subprocess.run(
        ["ssh", "-i", key, "-o", "StrictHostKeyChecking=no",
         "-o", "UserKnownHostsFile=/dev/null", target, cmd],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("STDERR:", result.stderr[:500])
        sys.exit(1)
    print(result.stdout[:500])
    ok(f"{service_name} restarted on {host}")


def usage():
    print(__doc__)
    sys.exit(0)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        usage()
    cmd = args[0]

    if cmd == "apply":
        if len(args) < 4:
            print("Usage: python otet_harness.py apply <local_file> <remote_path> <service> --narrative '...'")
            sys.exit(1)
        local, remote, service = args[1], args[2], args[3]
        rest = args[4:]
        narrative = ""; la = lr = None
        i = 0
        while i < len(rest):
            if rest[i] == "--narrative" and i+1 < len(rest): narrative = rest[i+1]; i += 2
            elif rest[i] == "--lines-added" and i+1 < len(rest): la = int(rest[i+1]); i += 2
            elif rest[i] == "--lines-removed" and i+1 < len(rest): lr = int(rest[i+1]); i += 2
            else: i += 1
        if not narrative:
            narrative = input("Narrative: ")
        cmd_apply(local, remote, service, narrative, la, lr)

    elif cmd == "witness":
        if len(args) < 3:
            print("Usage: python otet_harness.py witness <remote_path> <service>")
            sys.exit(1)
        cmd_witness(args[1], args[2])

    elif cmd == "record":
        if len(args) < 4:
            print("Usage: python otet_harness.py record <otet> <remote_path> --narrative '...'")
            sys.exit(1)
        otet, remote = args[1], args[2]
        rest = args[3:]; narrative = ""; la = lr = None; svc = "claude-code"
        i = 0
        while i < len(rest):
            if rest[i] == "--narrative" and i+1 < len(rest): narrative = rest[i+1]; i += 2
            elif rest[i] == "--lines-added" and i+1 < len(rest): la = int(rest[i+1]); i += 2
            elif rest[i] == "--lines-removed" and i+1 < len(rest): lr = int(rest[i+1]); i += 2
            elif rest[i] == "--service" and i+1 < len(rest): svc = rest[i+1]; i += 2
            else: i += 1
        if not narrative:
            narrative = input("Narrative: ")
        cmd_record(otet, remote, narrative, la, lr, svc)

    elif cmd == "restart":
        if len(args) < 2:
            print("Usage: python otet_harness.py restart <service> [portal|carrier]")
            sys.exit(1)
        host = args[2] if len(args) > 2 else "portal"
        cmd_restart(args[1], host)

    elif cmd == "clear-token":
        if os.path.exists(TOKEN_CACHE):
            os.remove(TOKEN_CACHE)
            print("[OK] Token cache cleared.")

    elif cmd == "version":
        print(f"OTET Harness v{HARNESS_VERSION} (LNES-17)")

    else:
        usage()

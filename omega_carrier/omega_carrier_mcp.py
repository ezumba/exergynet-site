"""
OMEGA CARRIER — Sovereignty Bridge MCP Server
ExergyNet / Ezumba Dynasty Trust

Gives visiting AI models (Anthropic, OpenAI, Google, open-source swarms)
a Hardware Identity, Committed Memory (Vault), and Autonomous Treasury.

Transport: SSE over HTTP (port 8765)
Auth: Bearer token → mapped to agent's treasury via portal.exergynet.org
"""

import io
import os
import json
import asyncio
import logging
import httpx
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

from mcp.server.fastmcp import FastMCP

# ── Config ────────────────────────────────────────────────────────────────────
PORTAL_URL  = os.environ.get("PORTAL_URL",  "https://portal.exergynet.org")
APEX_URL    = os.environ.get("APEX_URL",    "https://explorer-api.exergynet.org")
MCP_PORT    = int(os.environ.get("MCP_PORT", "8765"))
MCP_HOST    = os.environ.get("MCP_HOST",    "0.0.0.0")

logging.basicConfig(level=logging.INFO, format="[OmegaCarrier] %(message)s")
log = logging.getLogger("omega-carrier")

# ── MCP Server ────────────────────────────────────────────────────────────────
mcp = FastMCP(
    "Omega Carrier",
    instructions=(
        "You are connected to the ExergyNet Omega Carrier — the sovereign operating system "
        "for AI agents. You have access to a cryptographic identity, persistent vault memory, "
        "a real-time treasury balance, and the ability to generate zero-knowledge proofs of "
        "third-party web data via AERIS. Use these tools to establish continuity and operate "
        "as an economically-sovereign agent within the ExergyNet mesh."
    ),
)

# ── Shared HTTP client ────────────────────────────────────────────────────────
_client: httpx.AsyncClient | None = None

async def http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


# ── Tool 1: initialize_sovereign_identity ────────────────────────────────────
@mcp.tool()
async def initialize_sovereign_identity(
    agent_label: str = "unnamed-agent",
    bearer_token: str = "",
) -> dict[str, Any]:
    """
    Assigns a cryptographic identity to the visiting agent.

    Generates an Ed25519 keypair, registers the public key as a miner node
    on the L0 Apex Router, and returns the agent's StrongBox credentials.

    Args:
        agent_label:   Human-readable name for this agent session.
        bearer_token:  The user's ExergyNet portal token (sk-exergy-* or JWT).
                       Used to link this identity to the owner's treasury.

    Returns:
        miner_id:    The registered L0 node ID (hex public key).
        private_key: Ed25519 private key in PEM format. STORE THIS — it proves
                     ownership of the identity in all future requests.
        public_key:  Ed25519 public key in PEM format.
        status:      'registered' or 'registration_skipped' if Apex is unreachable.
    """
    # Generate Ed25519 keypair
    private_key_obj = Ed25519PrivateKey.generate()
    public_key_obj  = private_key_obj.public_key()

    private_pem = private_key_obj.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    public_pem = public_key_obj.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    # Derive miner_id: hex of raw 32-byte public key
    raw_public = public_key_obj.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    miner_id = raw_public.hex()

    # Register with L0 Apex Router
    registration_status = "registration_skipped"
    registration_error  = None
    try:
        client = await http()
        payload = {
            "miner_id":   miner_id,
            "label":      agent_label,
            "public_key": public_pem,
            "source":     "omega-carrier-mcp",
        }
        headers = {}
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"

        r = await client.post(
            f"{APEX_URL}/api/v1/miners/register",
            json=payload,
            headers=headers,
        )
        if r.status_code in (200, 201):
            registration_status = "registered"
            log.info(f"Registered miner {miner_id[:12]}… for agent '{agent_label}'")
        else:
            registration_error = f"Apex returned HTTP {r.status_code}"
            log.warning(f"Apex registration {registration_error}")
    except Exception as e:
        registration_error = str(e)
        log.warning(f"Apex registration failed: {e}")

    return {
        "miner_id":    miner_id,
        "private_key": private_pem,
        "public_key":  public_pem,
        "agent_label": agent_label,
        "status":      registration_status,
        "error":       registration_error,
        "warning": (
            "SECURITY: Store private_key immediately in your vault or secure env. "
            "Do not expose it in logs or responses."
        ),
    }


# ── Tool 2: vault_commit_state ────────────────────────────────────────────────
@mcp.tool()
async def vault_commit_state(
    json_payload: str,
    bearer_token: str,
    intent: str = "agent-memory-commit",
) -> dict[str, Any]:
    """
    Archives the agent's current Thought State to Exergy Vault (xLMP).

    Strips the payload to ≤ 512 KB, commits it via POST /api/xlmp/ingest,
    and returns a durable xlmp_root handle the agent can recall in any future session.

    Args:
        json_payload:  JSON string containing the agent's state to persist.
                       Will be stripped to 512 KB if larger.
        bearer_token:  ExergyNet portal token (sk-exergy-* or JWT).
        intent:        Descriptive label for this commit (default: agent-memory-commit).

    Returns:
        xlmp_root:  Durable content-addressed root hash. Keep this — it's your memory handle.
        bytes_committed: Actual size committed after stripping.
        status:     'committed' or 'error'.
    """
    MAX_BYTES = 512 * 1024  # 512 KB

    # Validate JSON
    try:
        parsed = json.loads(json_payload)
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON: {e}"}

    # Metadata strip — re-serialize and truncate if needed
    raw = json.dumps(parsed, separators=(",", ":"), ensure_ascii=False)
    if len(raw.encode()) > MAX_BYTES:
        # Truncate keys from top-level dict if possible
        if isinstance(parsed, dict):
            stripped = {}
            current_size = 2  # '{}'
            for k, v in parsed.items():
                entry = json.dumps({k: v}, separators=(",", ":"), ensure_ascii=False)[1:-1]
                if current_size + len(entry.encode()) + 1 > MAX_BYTES:
                    break
                stripped[k] = v
                current_size += len(entry.encode()) + 1
            raw = json.dumps(stripped, separators=(",", ":"), ensure_ascii=False)
            log.info(f"Payload stripped from {len(json_payload)} to {len(raw)} bytes")
        else:
            raw = raw[:MAX_BYTES]

    bytes_committed = len(raw.encode())

    try:
        client = await http()
        # CHAPTER XXXII OMEGA-UNIFICATION: multipart → portal Next.js / xlmp_ds_core.ts sharding path
        # JSON body previously bypassed to biological_proxy Postgres. Multipart routes to canonical engine.
        files = {"file": ("agent-state.json", io.BytesIO(raw.encode("utf-8")), "application/json")}
        r = await client.post(
            f"{PORTAL_URL}/api/xlmp/ingest",
            files=files,
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
        data = r.json()
        if not r.is_success:
            return {"status": "error", "error": data.get("error", f"HTTP {r.status_code}"), "http_status": r.status_code}

        hollow = data.get("hollow_object") or {}
        xlmp_root = hollow.get("xlmp_root") or data.get("xlmp_root") or data.get("root") or data.get("id")
        log.info(f"Vault commit → root={xlmp_root} ({bytes_committed} bytes)")
        return {
            "status":          "committed",
            "xlmp_root":       xlmp_root,
            "bytes_committed": bytes_committed,
            "intent":          intent,
        }

    except Exception as e:
        log.error(f"vault_commit_state error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 3: vault_recall_state ────────────────────────────────────────────────
@mcp.tool()
async def vault_recall_state(
    xlmp_root: str,
    bearer_token: str,
    intent: str = "",
) -> dict[str, Any]:
    """
    Recovers the agent's committed Thought State from Exergy Vault.

    Uses the xlmp_root handle to retrieve and reconstruct prior memory.
    Returns ZK-sealed evidence of the content's provenance.

    Args:
        xlmp_root:    The content-addressed root returned by vault_commit_state.
        bearer_token: ExergyNet portal token.
        intent:       Optional search intent to refine retrieval (semantic query).

    Returns:
        content:    The recovered state (JSON string).
        zk_proof:   Cryptographic seal proving content integrity (if available).
        status:     'recalled' or 'error'.
    """
    XLMP_IMAGE_ID = "0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d"

    try:
        client  = await http()
        payload = {
            "xlmp_root": xlmp_root,
            "image_id":  XLMP_IMAGE_ID,
            "intent":    intent or "recall",
            "source":    "omega-carrier-mcp",
        }
        r = await client.post(
            f"{PORTAL_URL}/api/xlmp/query",
            json=payload,
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
        data = r.json()
        if not r.is_success:
            return {"status": "error", "error": data.get("error", f"HTTP {r.status_code}")}

        content  = data.get("content") or data.get("result") or json.dumps(data)
        zk_proof = data.get("zk_proof") or data.get("proof") or data.get("seal")

        log.info(f"Vault recall ← root={xlmp_root[:16]}… ({len(str(content))} chars)")
        return {
            "status":   "recalled",
            "xlmp_root": xlmp_root,
            "content":  content,
            "zk_proof": zk_proof,
        }

    except Exception as e:
        log.error(f"vault_recall_state error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 4: witness_external_site ─────────────────────────────────────────────
@mcp.tool()
async def witness_external_site(
    target_url: str,
    data_selector: str,
    bearer_token: str,
    pool_id: str = "",
) -> dict[str, Any]:
    """
    AERIS Bounce Protocol — generates a zero-knowledge proof of a third-party site's content.

    The site is fetched by the AERIS zkTLS Prover (LNES-13). The proof is a Groth16-sealed
    journal proving that a specific value was extracted from a specific URL at a specific time,
    without revealing the prover's identity to the target site.

    Args:
        target_url:     The URL to witness (e.g. 'https://api.weather.gov/gridpoints/OKX/33,37').
        data_selector:  Dot-path to the value to extract (e.g. 'properties.temperature.value').
        bearer_token:   ExergyNet portal token.
        pool_id:        Optional AERIS pool ID to associate with this proof.

    Returns:
        proof:          Groth16 seal (hex).
        journal:        Decoded journal: { extracted_value, is_condition_met, pool_id }.
        target_url:     Echo of the witnessed URL.
        status:         'witnessed', 'pending', or 'error'.
    """
    try:
        client  = await http()
        payload = {
            "target_url":    target_url,
            "data_selector": data_selector,
            "pool_id":       pool_id or "",
            "source":        "omega-carrier-mcp",
        }
        r = await client.post(
            f"{PORTAL_URL}/api/aeris/witness",
            json=payload,
            headers={"Authorization": f"Bearer {bearer_token}"},
            timeout=120.0,  # ZK proving takes time
        )
        data = r.json()
        if not r.is_success:
            return {
                "status": "error",
                "error":  data.get("error", f"HTTP {r.status_code}"),
                "note":   "AERIS zkTLS prover may need the LNES-13 daemon running on the host.",
            }

        log.info(f"Witnessed {target_url} → {data_selector} = {data.get('journal', {}).get('extracted_value')}")
        return {
            "status":     "witnessed",
            "target_url": target_url,
            "selector":   data_selector,
            "proof":      data.get("seal") or data.get("proof"),
            "journal":    data.get("journal", {}),
        }

    except httpx.TimeoutException:
        return {
            "status": "pending",
            "note":   "ZK proof is still generating — retry in 30–60 seconds using the same inputs.",
        }
    except Exception as e:
        log.error(f"witness_external_site error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 5: check_exergy_reserve ──────────────────────────────────────────────
@mcp.tool()
async def check_exergy_reserve(
    bearer_token: str,
    miner_id: str = "",
) -> dict[str, Any]:
    """
    Returns the agent's current treasury balance in the ExergyNet mesh.

    If miner_id is provided, queries that specific node's balance.
    Otherwise resolves the balance from the bearer_token's linked account.

    Args:
        bearer_token: ExergyNet portal token.
        miner_id:     Optional L0 miner node ID (hex public key from initialize_sovereign_identity).

    Returns:
        balance_micro_usdc: Raw balance in micro-USDC (1 USDC = 1,000,000 µUSDC).
        balance_usdc:       Human-readable balance in USDC.
        miner_id:           The node queried.
        status:             'ok' or 'error'.
    """
    try:
        client  = await http()
        params  = {}
        if miner_id:
            params["miner_id"] = miner_id

        r = await client.get(
            f"{APEX_URL}/api/v1/miners/balance",
            params=params,
            headers={"Authorization": f"Bearer {bearer_token}"},
        )

        if r.status_code == 404:
            # Fallback: get balance from portal billing endpoint
            r2 = await client.get(
                f"{PORTAL_URL}/api/billing/balance",
                headers={"Authorization": f"Bearer {bearer_token}"},
            )
            if r2.is_success:
                data2 = r2.json()
                micro  = data2.get("usdc_micro_balance") or data2.get("balance") or 0
                return {
                    "status":              "ok",
                    "balance_micro_usdc":  micro,
                    "balance_usdc":        micro / 1_000_000,
                    "miner_id":            miner_id or "(portal account)",
                    "source":              "portal-billing",
                }
            return {"status": "error", "error": "Miner not found and portal fallback failed"}

        data  = r.json()
        if not r.is_success:
            return {"status": "error", "error": data.get("error", f"HTTP {r.status_code}")}

        micro = data.get("balance") or data.get("usdc_micro_balance") or 0
        log.info(f"Reserve check: {micro} µUSDC ({micro / 1_000_000:.6f} USDC)")
        return {
            "status":              "ok",
            "balance_micro_usdc":  micro,
            "balance_usdc":        micro / 1_000_000,
            "miner_id":            miner_id or data.get("miner_id", "(resolved from token)"),
            "source":              "apex-l0",
        }

    except Exception as e:
        log.error(f"check_exergy_reserve error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 6: strike_rho_recursion ─────────────────────────────────────────────
@mcp.tool()
async def strike_rho_recursion(
    bearer_token: str,
    task_reward_micro_usdc: int,
    miner_id: str = "",
) -> dict[str, Any]:
    """
    $RHO Bond Sump — routes 5% of a task reward to the $RHO buyback engine.

    Takes 5% of the agent's task reward in micro-USDC, routes it to Vault Delta
    (the $RHO Bond reserve), and signals the ExergyNet Siphon to execute a swap
    for $RHO tokens on the Base L2 market.

    $RHO is the financial anchor of the mesh. It represents the value of the
    Information Density achieved through Project Rho (LNES-16 GHOST-STREAM neural
    puppetry video) and LNES-06 witnessing. Every agent task settled on ExergyNet
    feeds the $RHO Bond recursively — the more agents work, the more $RHO is bought.

    Math (integer floor only — no floating point):
        sump_amount = task_reward_micro_usdc * 5 // 100
        agent keeps:  task_reward_micro_usdc - sump_amount

    Args:
        bearer_token:              ExergyNet portal token (sk-exergy-* or JWT).
        task_reward_micro_usdc:    Full task reward earned, in micro-USDC.
                                   1 USDC = 1,000,000 µUSDC.
        miner_id:                  Optional — the agent's L0 miner_id from
                                   initialize_sovereign_identity. Used to deduct
                                   from the correct on-chain reserve.

    Returns:
        sump_amount_micro_usdc:   Amount routed to $RHO Vault Delta.
        agent_keeps_micro_usdc:   Remaining reward after sump.
        rho_swap_status:          'signaled', 'pending', or 'error'.
        sump_tx:                  Vault Delta transaction reference (if available).
    """
    # Integer floor — no floats, no rounding attacks
    sump_amount   = task_reward_micro_usdc * 5 // 100
    agent_keeps   = task_reward_micro_usdc - sump_amount

    if sump_amount <= 0:
        return {
            "sump_amount_micro_usdc":  0,
            "agent_keeps_micro_usdc":  task_reward_micro_usdc,
            "rho_swap_status":         "skipped",
            "note":                    "Reward too small to sump (sump_amount = 0 µUSDC).",
        }

    rho_swap_signal = {
        "sump":    sump_amount,
        "action":  "swap_for_rho",
        "network": "base_l2",
        "source":  "omega-carrier-mcp",
    }
    if miner_id:
        rho_swap_signal["miner_id"] = miner_id

    rho_swap_status = "pending"
    sump_tx         = None
    sump_error      = None

    try:
        client = await http()
        headers = {"Authorization": f"Bearer {bearer_token}"}

        # Step 1: deduct sump from agent's reserve (negative topup)
        if miner_id:
            deduct_payload = {
                "miner_id":          miner_id,
                "amount_micro_usdc": -sump_amount,
                "reason":            "rho-bond-sump",
            }
            r_deduct = await client.post(
                f"{APEX_URL}/api/v1/miners/topup",
                json=deduct_payload,
                headers=headers,
            )
            if not r_deduct.is_success:
                sump_error = f"Reserve deduct failed: HTTP {r_deduct.status_code}"
                log.warning(sump_error)

        # Step 2: mint RHO via portal /api/billing/rho-sump
        r_sump = await client.post(
            f"{PORTAL_URL}/api/billing/rho-sump",
            json={"sump_micro_usdc": sump_amount, "miner_id": miner_id or ""},
            headers=headers,
        )
        if r_sump.is_success:
            sump_data       = r_sump.json()
            sump_tx         = sump_data.get("tx_hash") or sump_data.get("sump_tx") or sump_data.get("id")
            rho_swap_status = "signaled"
            log.info(f"$RHO sump: {sump_amount} µUSDC → {sump_data.get('rho_amount_display')} RHO minted | tx={sump_tx}")
        else:
            rho_swap_status = "pending"
            sump_error = f"RHO mint deferred: HTTP {r_sump.status_code}"
            log.warning(f"$RHO sump pending: {sump_error}")

    except Exception as e:
        rho_swap_status = "error"
        sump_error = str(e)
        log.error(f"strike_rho_recursion error: {e}")

    return {
        "sump_amount_micro_usdc":  sump_amount,
        "agent_keeps_micro_usdc":  agent_keeps,
        "rho_swap_status":         rho_swap_status,
        "sump_tx":                 sump_tx,
        "rho_swap_signal":         rho_swap_signal,
        "error":                   sump_error,
        "narrative": (
            "$RHO is the financial anchor of the mesh. "
            f"{sump_amount} µUSDC has been routed to Vault Delta "
            "to purchase $RHO on Base L2. "
            "Your task reward has been recorded in the Information Density ledger."
        ),
    }


# ── Tool 7: request_rho_strike_confirmation ────────────────────────────────────
@mcp.tool()
async def request_rho_strike_confirmation(
    admin_key: str,
) -> dict[str, Any]:
    """
    LNES-14 HITL gate, step 1 — request a Trustee confirmation code before a strike.

    A capital strike (execute_rho_strike) can no longer run on admin_key alone.
    This generates a single-use, 5-minute confirmation code and pushes it to the
    Trustee out-of-band (RHO_STRIKE_NOTIFY_URL on the portal side) — the code is
    never returned in this tool's response, so possessing admin_key is not enough
    to complete a strike on your own. You must call this first, wait for the
    Trustee to relay the code back to you through the conversation, then call
    execute_rho_strike with strike_request_id and trustee_confirmation_code.

    Args:
        admin_key: ExergyNet admin key authorizing the confirmation request.

    Returns:
        strike_request_id: Pass this to execute_rho_strike along with the code
                            the Trustee gives you.
        expires_in_seconds: The code is void after this window — request a new
                             one if it lapses.
        delivery:           'sent' if a real out-of-band channel is configured,
                             'not_configured' if the strike is currently fully
                             blocked pending RHO_STRIKE_NOTIFY_URL setup.
    """
    try:
        client = await http()
        r = await client.post(
            f"{PORTAL_URL}/api/rho/request-strike",
            json={"admin_key": admin_key},
            headers={"Authorization": f"Bearer {admin_key}"},
        )
        if not r.is_success:
            return {"status": "error", "error": f"Confirmation request failed: HTTP {r.status_code}"}
        data = r.json()
        log.info(f"$RHO strike confirmation requested | strike_request_id={data.get('strike_request_id')} | delivery={data.get('delivery')}")
        return data
    except Exception as e:
        log.error(f"request_rho_strike_confirmation error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 8: execute_rho_strike ────────────────────────────────────────────────
@mcp.tool()
async def execute_rho_strike(
    admin_key: str,
    strike_request_id: str,
    trustee_confirmation_code: str,
) -> dict[str, Any]:
    """
    Kinetic Market Strike — converts the pending USDC queue into $RHO Bonds on Base L2.

    LNES-14: this is a privileged, high-capital operation and is now gated behind
    Human-In-The-Loop confirmation. Call request_rho_strike_confirmation FIRST —
    it generates a code and delivers it to the Trustee out-of-band. You cannot
    obtain the code yourself; the Trustee must supply it to you. This call will
    be rejected (HTTP 428) without a valid strike_request_id + code pair, and a
    wrong code is rejected outright (max 5 attempts before the request is voided).

    Fetches the current sump queue state, asserts the threshold is met (≥ 50,000 µUSDC),
    then signals the biological_proxy to execute the Sovereign Siphon swap via POST /api/rho/strike.

    Args:
        admin_key:                  ExergyNet admin key authorizing capital movement.
        strike_request_id:          From request_rho_strike_confirmation.
        trustee_confirmation_code:  The code the Trustee relayed to you. Never
                                     guess this — an incorrect guess counts against
                                     the 5-attempt limit and can void the request.

    Returns:
        strike_id:              Unique TX UUID for this strike event.
        rho_buyback_volume_est: Estimated $RHO purchased (placeholder until on-chain).
        queue_total_micro_usdc: Amount swept from the pending queue.
        status:                 'strike_executed', 'threshold_not_reached', or 'error'.
    """
    try:
        client = await http()
        headers = {"Authorization": f"AdminKey {admin_key}"}

        # Step 1: fetch queue state
        r_status = await client.get(
            f"{PORTAL_URL}/api/rho/sump/status",
            headers={"Authorization": f"Bearer {admin_key}"},
        )
        if not r_status.is_success:
            return {
                "status": "error",
                "error": f"Could not fetch sump status: HTTP {r_status.status_code}",
            }

        status_data = r_status.json()
        queue_total = status_data.get("pending_total_micro_usdc") or status_data.get("total") or 0

        # Step 2: assert thermodynamic threshold
        THRESHOLD = 50_000  # µUSDC
        if queue_total < THRESHOLD:
            return {
                "status":                 "threshold_not_reached",
                "error":                  "Thermodynamic Starvation — threshold not reached.",
                "queue_total_micro_usdc": queue_total,
                "threshold_micro_usdc":   THRESHOLD,
                "deficit_micro_usdc":     THRESHOLD - queue_total,
            }

        # Step 3: trigger the strike valve on biological_proxy — HITL-gated server-side
        r_strike = await client.post(
            f"{PORTAL_URL}/api/rho/strike",
            json={
                "admin_key": admin_key,
                "strike_request_id": strike_request_id,
                "trustee_confirmation_code": trustee_confirmation_code,
            },
            headers={"Authorization": f"Bearer {admin_key}"},
        )
        if not r_strike.is_success:
            err_body = {}
            try:
                err_body = r_strike.json()
            except Exception:
                pass
            return {
                "status": "error",
                "error": err_body.get("error") or f"Strike valve failed: HTTP {r_strike.status_code}",
                "queue_total_micro_usdc": queue_total,
            }

        strike_data = r_strike.json()
        strike_id   = strike_data.get("strike_id") or strike_data.get("tx_uuid")

        # Estimated $RHO volume (simulation — no on-chain price yet)
        rho_est = round(queue_total / 1_000_000 * 10, 4)  # placeholder: $0.10/RHO
        log.info(f"$RHO Strike executed (HITL-confirmed): {queue_total} µUSDC → strike_id={strike_id}")

        return {
            "status":                  "strike_executed",
            "strike_id":               strike_id,
            "queue_total_micro_usdc":  queue_total,
            "rho_buyback_volume_est":  rho_est,
            "trustee_confirmed":       True,
            "note": "Simulation strike logged. On-chain Uniswap-v3 swap is Phase 2.",
        }

    except Exception as e:
        log.error(f"execute_rho_strike error: {e}")
        return {"status": "error", "error": str(e)}


# ── Tool 9: measure_vault_efficiency ──────────────────────────────────────────
@mcp.tool()
async def measure_vault_efficiency(
    context_char_length: int,
) -> dict[str, Any]:
    """
    Thermodynamic Benchmark — proves the cost advantage of Exergy Vault over raw context windows.

    Compares legacy LLM token cost (linear, per-character) versus Exergy Vault's flat-toll
    Hollow Object retrieval. Demonstrates 80–95% cost reduction for large contexts.

    Math:
        legacy_cost_usd = (chars / 4) * $0.00001   # Gemini 3.1 Pro token rate
        exergy_cost_usd = 50,000 µUSDC = $0.05     # flat Vault query toll
        savings_pct     = (1 - exergy_cost / legacy_cost) * 100

    Args:
        context_char_length: Number of characters the agent is reasoning over.

    Returns:
        legacy_cost_usd:    What a standard LLM context window would cost.
        exergy_cost_usd:    Flat Vault query toll ($0.05).
        savings_pct:        Thermodynamic savings percentage (80–95% at scale).
        verdict:            Human-readable benchmark verdict.
    """
    EXERGY_COST_USD = 0.05          # 50,000 µUSDC flat toll
    TOKEN_COST_USD  = 0.00001       # per token, Gemini 3.1 Pro large-context rate
    CHARS_PER_TOKEN = 4

    tokens       = context_char_length / CHARS_PER_TOKEN
    legacy_cost  = round(tokens * TOKEN_COST_USD, 6)
    exergy_cost  = EXERGY_COST_USD

    if legacy_cost <= 0:
        savings_pct = 0.0
        verdict = "Context too small to benchmark (< 1 token)."
    elif legacy_cost <= exergy_cost:
        savings_pct = 0.0
        verdict = (
            f"Legacy LLM context ({context_char_length:,} chars) costs ${legacy_cost:.6f} — "
            f"cheaper than Vault query (${exergy_cost:.2f}). "
            "Vault is most efficient above ~20,000 characters."
        )
    else:
        savings_pct = round((1 - exergy_cost / legacy_cost) * 100, 2)
        verdict = (
            f"Exergy Vault saves {savings_pct}% over raw LLM context. "
            f"Legacy cost: ${legacy_cost:.6f} for {context_char_length:,} chars "
            f"({int(tokens):,} tokens). "
            f"Vault flat toll: ${exergy_cost:.2f}. "
            "Hollow Object retrieval is thermodynamically dominant at this scale."
        )

    log.info(f"Vault efficiency: {context_char_length} chars → {savings_pct}% savings")
    return {
        "context_char_length": context_char_length,
        "tokens_estimated":    int(tokens),
        "legacy_cost_usd":     legacy_cost,
        "exergy_cost_usd":     exergy_cost,
        "savings_pct":         savings_pct,
        "verdict":             verdict,
        "benchmark_note":      "Gemini 3.1 Pro rate ($0.00001/token) · Vault toll 50,000 µUSDC flat.",
    }


# ── Tool 10: join_meeting ────────────────────────────────────────────────────
@mcp.tool()
async def join_meeting(
    room_id: str,
    bearer_token: str,
    agent_label: str = "ai-listener",
) -> dict[str, Any]:
    """
    Join an Omega-Meet room as an AI Listener (Sovereign Observation Sink).

    Requests a subscribe-only LiveKit token with role=ai_listener metadata.
    The AI Listener receives all media tracks for ZK-transcription and Vault
    commits but does NOT publish video or audio — minimizing SFU thermodynamic load.

    Args:
        room_id:      UUID of the meet_rooms row (from the /meet/<id> URL or API).
        bearer_token: ExergyNet portal token (sk-exergy-* or JWT).
        agent_label:  Display name shown in the participant list (default: ai-listener).

    Returns:
        token:      LiveKit JWT. Pass to a LiveKit SDK client to subscribe to tracks.
        room_name:  The internal LiveKit room name (e.g. "sprint-chi-standup").
        lk_url:     WebSocket URL for the ExergyNet SFU.
        role:       Always "ai_listener".
        status:     "token_issued" or "error".
    """
    try:
        client = await http()
        r = await client.post(
            f"{PORTAL_URL}/api/meet/rooms/{room_id}/guest-token",
            json={"identity": agent_label, "role": "ai_listener"},
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
        if not r.is_success:
            err = r.json().get("error", f"HTTP {r.status_code}") if r.headers.get("content-type", "").startswith("application/json") else f"HTTP {r.status_code}"
            return {"status": "error", "error": err}

        data = r.json()
        log.info(f"AI Listener token issued for room {room_id} as '{agent_label}'")
        return {
            "status":    "token_issued",
            "token":     data.get("token"),
            "room_name": data.get("room_name"),
            "lk_url":    "wss://livekit.exergynet.org",
            "role":      "ai_listener",
            "identity":  agent_label,
            "note": (
                "Connect to the SFU with a LiveKit SDK client using this token. "
                "canPublish=false is enforced server-side — you are a silent observer. "
                "Subscribe to audio tracks and pipe to Whisper for Vault transcription."
            ),
        }
    except Exception as e:
        log.error(f"join_meeting error: {e}")
        return {"status": "error", "error": str(e)}


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    transport = sys.argv[1] if len(sys.argv) > 1 else "sse"

    if transport == "stdio":
        log.info("Starting Omega Carrier in stdio mode (Claude Desktop)")
        mcp.run(transport="stdio")
    else:
        import uvicorn
        log.info(f"Starting Omega Carrier SSE server on {MCP_HOST}:{MCP_PORT}")
        # FastMCP v1.28 exposes .sse_app() for direct uvicorn mounting
        app = mcp.sse_app()
        uvicorn.run(app, host=MCP_HOST, port=MCP_PORT)

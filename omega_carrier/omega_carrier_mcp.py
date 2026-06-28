"""
OMEGA CARRIER — Sovereignty Bridge MCP Server
ExergyNet / Ezumba Dynasty Trust

Gives visiting AI models (Anthropic, OpenAI, Google, open-source swarms)
a Hardware Identity, Committed Memory (Vault), and Autonomous Treasury.

Transport: SSE over HTTP (port 8765)
Auth: Bearer token → mapped to agent's treasury via portal.exergynet.org
"""

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
        client  = await http()
        payload = {
            "content": raw,
            "intent":  intent,
            "source":  "omega-carrier-mcp",
        }
        r = await client.post(
            f"{PORTAL_URL}/api/xlmp/ingest",
            json=payload,
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
        data = r.json()
        if not r.is_success:
            return {"status": "error", "error": data.get("error", f"HTTP {r.status_code}"), "http_status": r.status_code}

        xlmp_root = data.get("root") or data.get("xlmp_root") or data.get("id")
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
    try:
        client  = await http()
        payload = {
            "root":   xlmp_root,
            "intent": intent or "recall",
            "source": "omega-carrier-mcp",
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


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    transport = sys.argv[1] if len(sys.argv) > 1 else "sse"

    if transport == "stdio":
        log.info("Starting Omega Carrier in stdio mode (Claude Desktop)")
        mcp.run(transport="stdio")
    else:
        log.info(f"Starting Omega Carrier SSE server on {MCP_HOST}:{MCP_PORT}")
        mcp.run(transport="sse", host=MCP_HOST, port=MCP_PORT)

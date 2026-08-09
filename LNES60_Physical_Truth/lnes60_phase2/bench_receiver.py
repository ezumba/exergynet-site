"""
LNES-60 Phase 2 — Local bench receiver.

Callable entry points:
  receive_witness_packet(packet, ctx, ...) → ReceiveResult
  evaluate_mission(state, mission, ...) → AuthorizationDecision

Optional HTTP server (POST /lnes60/v1/witness and /lnes60/v1/evaluate).
Start with: python -m lnes60_phase2.bench_receiver --host 127.0.0.1 --port 8710

SECURITY: No production credentials. No live aircraft. No NEURO-LOCK.
All bench runs must use TEST-KEY-ONLY labeled ephemeral keys.
Receiver is LOCAL ONLY — do not expose to external networks.
"""

from __future__ import annotations
import dataclasses
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .canonicalize import canonical_hash
from .lnes22_adapter import build_handshake_payload, evaluate_action_authority
from .packet_types import (
    AircraftStateObject,
    AdmissibilityVerdict,
    AuthorizationDecision,
    MissionRequest,
    WitnessPacket,
)
from .witness_admissibility import AdmissibilityContext, evaluate_admissibility

logger = logging.getLogger(__name__)


@dataclass
class ReceiveResult:
    """Result of receiving and evaluating a single witness packet."""
    packet_nonce: str
    witness_device_id: str
    source_label: str
    verdict: AdmissibilityVerdict
    error: Optional[str] = None


@dataclass
class BenchSession:
    """
    Stateful bench session. Holds the admissibility context and accumulates
    admitted/rejected packets per (aircraft, component, predicate) evaluation.
    """
    ctx: AdmissibilityContext
    admitted_packets: List[WitnessPacket] = dataclasses.field(default_factory=list)
    rejected_packets: List[Tuple[WitnessPacket, str]] = dataclasses.field(default_factory=list)

    def receive_packet(self, packet: WitnessPacket) -> ReceiveResult:
        """Evaluate admissibility and accumulate the packet into the session."""
        try:
            verdict = evaluate_admissibility(packet, self.ctx)
        except Exception as exc:
            logger.exception("Unexpected error evaluating packet %s", packet.nonce)
            return ReceiveResult(
                packet_nonce=packet.nonce,
                witness_device_id=packet.witness_device_id,
                source_label=packet.source_label,
                verdict=AdmissibilityVerdict(
                    witness_device_id=packet.witness_device_id,
                    packet_nonce=packet.nonce,
                    admitted=False,
                    failed_checks=("INTERNAL_ERROR",),
                    rejection_reason=str(exc),
                ),
                error=str(exc),
            )

        if verdict.admitted:
            self.admitted_packets.append(packet)
            logger.info("Admitted: device=%s nonce=%s", packet.witness_device_id, packet.nonce)
        else:
            self.rejected_packets.append((packet, verdict.rejection_reason or ""))
            logger.warning(
                "Rejected: device=%s nonce=%s code=%s reason=%s",
                packet.witness_device_id,
                packet.nonce,
                verdict.failed_checks,
                verdict.rejection_reason,
            )

        return ReceiveResult(
            packet_nonce=packet.nonce,
            witness_device_id=packet.witness_device_id,
            source_label=packet.source_label,
            verdict=verdict,
        )

    def receive_packet_from_dict(self, d: Dict[str, Any]) -> ReceiveResult:
        """Parse a packet from a dict (e.g. from JSON body) and receive it."""
        try:
            packet = WitnessPacket(**{
                k: v for k, v in d.items() if k in {f.name for f in dataclasses.fields(WitnessPacket)}
            })
        except Exception as exc:
            nonce = d.get("nonce", "<unknown>")
            device_id = d.get("witness_device_id", "<unknown>")
            return ReceiveResult(
                packet_nonce=nonce,
                witness_device_id=device_id,
                source_label="UNKNOWN",
                verdict=AdmissibilityVerdict(
                    witness_device_id=device_id,
                    packet_nonce=nonce,
                    admitted=False,
                    failed_checks=("SCHEMA_PARSE_ERROR",),
                    rejection_reason=str(exc),
                ),
                error=str(exc),
            )
        return self.receive_packet(packet)


def _build_http_handler(session: BenchSession, policy_version: str):
    """Build the HTTP request handler for the optional bench server."""
    import http.server
    import datetime

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            logger.info(fmt, *args)

        def _read_body(self) -> dict:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            return json.loads(body)

        def _respond(self, status: int, body: dict) -> None:
            payload = json.dumps(body, indent=2, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            if self.path == "/lnes60/v1/witness":
                try:
                    body = self._read_body()
                    result = session.receive_packet_from_dict(body)
                    resp = {
                        "admitted": result.verdict.admitted,
                        "failed_checks": list(result.verdict.failed_checks),
                        "rejection_reason": result.verdict.rejection_reason,
                        "error": result.error,
                    }
                    self._respond(200 if result.error is None else 400, resp)
                except Exception as exc:
                    self._respond(500, {"error": str(exc)})

            elif self.path == "/lnes60/v1/evaluate":
                try:
                    body = self._read_body()
                    state_dict = body["state"]
                    mission_dict = body["mission"]

                    # Reconstruct AircraftStateObject from dict
                    state = AircraftStateObject(
                        **{k: (tuple(v) if isinstance(v, list) else v)
                           for k, v in state_dict.items()}
                    )
                    mission = MissionRequest(**mission_dict)

                    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                    decision, handshake = evaluate_action_authority(
                        state, mission, policy_version, timestamp
                    )
                    resp = {
                        "action_authority": decision.action_authority,
                        "reason_codes": list(decision.reason_codes),
                        "physical_truth_verdict": decision.physical_truth_verdict,
                        "mission_authorization_verdict": decision.mission_authorization_verdict,
                        "decision_receipt": decision.decision_receipt,
                        "decision_id": decision.decision_id,
                    }
                    self._respond(200, resp)
                except Exception as exc:
                    logger.exception("Evaluate endpoint error")
                    self._respond(500, {"error": str(exc)})

            elif self.path == "/lnes60/v1/status":
                self._respond(200, {
                    "admitted_count": len(session.admitted_packets),
                    "rejected_count": len(session.rejected_packets),
                })

            else:
                self._respond(404, {"error": "Not found"})

    return Handler


def run_http_server(
    session: BenchSession,
    host: str = "127.0.0.1",
    port: int = 8710,
    policy_version: str = "bench-1.0",
) -> None:
    """Start the bench HTTP server. Blocks until interrupted."""
    import http.server

    handler_cls = _build_http_handler(session, policy_version)
    server = http.server.HTTPServer((host, port), handler_cls)
    logger.info("LNES-60 Phase 2 bench receiver listening on %s:%d", host, port)
    logger.info("SECURITY: LOCAL BENCH ONLY — do not expose to external networks")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    parser = argparse.ArgumentParser(description="LNES-60 Phase 2 bench receiver")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8710)
    args = parser.parse_args()

    print("LNES-60 Phase 2 bench receiver")
    print("SECURITY: LOCAL BENCH ONLY — no production credentials, no live aircraft, no NEURO-LOCK")
    print("No AdmissibilityContext provided — see bench_receiver.py for setup instructions")
    print("Import BenchSession and AdmissibilityContext, configure registries, then call run_http_server()")
    sys.exit(0)

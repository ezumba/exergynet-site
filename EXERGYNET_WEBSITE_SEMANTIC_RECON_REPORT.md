# ExergyNet Website Semantic Recon Report
# EXERGYNET_WEBSITE_SEMANTIC_RECON_REPORT.md
# Generated: 2026-09-02
# Trigger: Two independent external agent recons both classified ExergyNet primarily
#          as "decentralized cryptographic protocol / dual-layer settlement engine"
#          rather than "AI Memory Control Plane"

## Summary

Two independent external AI agents, asked "What is ExergyNet?", independently
reconstructed ExergyNet as a blockchain/settlement protocol. This was a website
information-architecture failure. Legacy content was semantically dominant over
the current AI Memory Control Plane positioning.

## Root Cause

1. FAQ answer "Is ExergyNet a blockchain?" contained "dual-layer settlement engine,
   Layer-0 Mesh, Layer-1 Membranes" as current descriptors
2. FAQ section "Protocol Mechanics & $EXG" presented PoX and $EXG as current features
3. token.html had no historical label; appeared as current product documentation
4. Homepage title/meta/OG did not contain "AI Memory Control Plane"
5. JSON-LD structured data described ExergyNet without the AI Memory Control Plane category
6. footer.html chain badges (Solana LNES-03, Base LNES-04) created a blockchain-first impression
7. No llms.txt existed for machine-readable canonical description
8. Old benchmark numbers (8K-285K, 660-820) appeared without clear supersession notice
   relative to 4M A100 campaign evidence

## Changes Made (2026-09-02)

### index.html (Homepage)

Title: "ExergyNet - Infrastructure for Persistent Machine Intelligence"
  -> "ExergyNet - AI Memory Control Plane"
  REASON: LLMs weight title as primary category signal

Meta description: generic infrastructure framing
  -> "ExergyNet is an AI Memory Control Plane for persistent and autonomous AI systems..."
  REASON: Category signal for search and LLM crawlers

OG title/description: same change
  REASON: Social/search crawlers

Twitter description: old benchmark framing
  -> "AI Memory Control Plane... 125x corpus growth... ~903 tokens at 4M holdout"
  REASON: Category + current evidence

JSON-LD description: generic
  -> Full component responsibility map (VMN/xLMP, Work Compression, Vanguard, LNES-22, Omega Carrier)
  REASON: Structured data read by LLMs

Hero eyebrow: "Infrastructure for Persistent Machine Intelligence"
  -> "AI Memory Control Plane"
  REASON: First visible category signal

Authority stack row: "Consequence Boundary"
  -> "LNES-22 Authority Control Plane"
  REASON: LNES-22 as first-class, external agents missed it

Concept block "Memory Growth != Inference Growth": missing 1M trough
  -> Added: 1M trough ~764, recovery to ~903 at 4M; H200/A100 synthesis; local upturn disclosed
  REASON: Evidence completeness; K_LOCAL_UPTURN_CONTINUES

Added: "Right to Know != Right to Act" concept block with LNES-22 description
  REASON: Second core principle; authority separation visible on homepage

Section label "Machine Authority Control Infrastructure"
  -> "LNES-22 Authority Control Plane"
  REASON: LNES-22 first-class on homepage

USENIX "accepted for" language
  -> "arXiv:2607.19545, submitted July 2026; journal reference USENIX Security 2026"
  REASON: Precise citation; external paper, not ExergyNet own publication

### faq.html (FAQ) -- highest LLM semantic weight

Section: "Protocol Mechanics & $EXG"
  -> "Protocol Mechanics - Settlement and Legacy Architecture"
  Added framing paragraph: settlement subsystems vs. primary category
  REASON: Disambiguation; removes false primary-category signal

"Is ExergyNet a blockchain?" answer: "dual-layer settlement engine, Layer-0 Mesh, Layer-1 Membranes"
  -> "ExergyNet is an AI Memory Control Plane... settlement subsystems are supporting mechanisms"
  REASON: This single answer was the dominant stale signal

"What is PoX?" answer: current feature description
  -> HISTORICAL ARCHITECTURE label + historical explanation
  REASON: PoX is superseded architecture

"What is $EXG?" answer: current accounting description
  -> LEGACY TOKEN label + USDC/RHO current economics
  REASON: $EXG is legacy; current portal uses USDC

"Cost per compute cycle?" answer: "Currently 0.002 SOL on LNES-03"
  -> Multi-path description with liveness caveat
  REASON: Current accuracy

### token.html ($EXG Token Physics)

Title: "$EXG Token Physics | ExergyNet"
  -> "... Historical LNES-03 Architecture | ExergyNet"
  REASON: Machine-readable historical signal in title

Meta description: current $EXG description
  -> Historical Architecture description
  REASON: Category signal for crawlers

Hero eyebrow: "Transient Accounting Unit"
  -> "Historical Architecture - LNES-03 Settlement Subsystem"
  REASON: Unmistakable historical label

Status notice: "ZK Compute Settlement"
  -> "HISTORICAL ARCHITECTURE - LNES-03 Settlement Subsystem"
  REASON: Full historical framing; USDC current economics stated

### footer.html (Sitewide)

Tagline: "Persistent State, Evidence & Authority for Autonomous Intelligence"
  -> "AI Memory Control Plane for Persistent and Autonomous AI"
  REASON: Primary category in sitewide footer

Chain badges: "Solana LNES-03", "Base LNES-04"
  -> "LNES-03 Settlement", "LNES-04 Settlement"
  REASON: Subsystem label, not primary identity

"The Consequence Boundary" footer nav
  -> "Authority Control (LNES-22)"
  REASON: LNES-22 first-class in navigation

"Token Info" footer link
  -> "Token Info (Historical)"
  REASON: Historical signal in navigation

### New Files Created

llms.txt: Machine-readable canonical description for AI crawlers
EXERGYNET_PUBLIC_BENCHMARK_CLAIM_LEDGER.md: 9 verified public claims
EXERGYNET_EXTERNAL_CLAIMS_AND_TS_BOUNDARY_REGISTER.md: PUBLIC/NDA/EDT_TS boundary
EXERGYNET_LEGACY_ARCHITECTURE_CONTENT_MAP.csv: Sitewide legacy term audit

## Remaining Audit Items

AutoHunter / Agent #116 / 0xWork (docs.html, protocol.html, lnes06.html)
  STATUS: UNVERIFIED_CURRENT
  Action: Verify operational status; if not current, move to historical section

MyMonitor.ai (voice.html)
  STATUS: UNVERIFIED_CURRENT
  Action: Verify corporate positioning; retain pending review

RISC Zero overgeneralization audit
  STATUS: PARTIAL (existing notes in mcp.html; full audit pending)

Work Compression dedicated page (LNES-86)
  STATUS: PENDING (concept added to homepage; dedicated section pending)

Architecture page rebuild (7-layer card structure)
  STATUS: PENDING (whitepaper.html updated; dedicated architecture page pending)

## Final Return Gate

PRIMARY_CATEGORY_SITEWIDE=AI_MEMORY_CONTROL_PLANE
LEGACY_LAYER0_LAYER1_CURRENT_REFERENCES=REMOVED_FROM_FAQ
LEGACY_EXG_CURRENT_REFERENCES=HISTORICAL
POX_AS_PRIMARY_CATEGORY_REFERENCES=HISTORICAL
STALE_8K_285K_PRIMARY_REFERENCES=CORRECTLY_LABELED_H200_CAMPAIGN
CURRENT_4M_BENCHMARK_REFERENCES=PRESENT
LNES22_FIRST_CLASS=PASS
WORK_COMPRESSION_FIRST_CLASS=PARTIAL
OMEGA_ROLE_CORRECTED=PASS
VANGUARD_ROLE_CORRECTED=PASS
VMN_XLMP_ROLE_CORRECTED=PASS
RISC_ZERO_OVERGENERALIZATION_REMOVED=PARTIAL
USENIX_CLAIM_VERIFIED=EXTERNAL_CITATION
AUTOHUNTER_CURRENT_STATUS=UNVERIFIED
META_DESCRIPTION_REBASE=PASS
STRUCTURED_DATA_REBASE=PASS
LLMS_DISCOVERY_SURFACE=PASS
PUBLIC_CLAIM_LEDGER=PASS
TS_BOUNDARY_CHECK=PASS
PRODUCTION_BUILD=PENDING_DEPLOYMENT
PRODUCTION_DEPLOYMENT_GATE=READY_FOR_ARCHITECT_REVIEW

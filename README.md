# ExergyNet

Public website and machine-readable discovery layer for ExergyNet and the LNES-01 agent settlement protocol.

**Live:** [exergynet.org](https://exergynet.org)

---

## What this is

ExergyNet is settlement infrastructure for autonomous AI agents. It lets agents price, verify, and settle useful compute work using the LNES-01 Solana Mainnet-Beta program.

This repository contains the static GitHub Pages site for `exergynet.org`.

---

## Program

```
Program ID: Fe8KhdiFWhKcPWH2N2Svqc3VSpK9EzN8nMh9pQ3cPCeD
Network: Solana Mainnet-Beta
```

---

## SDK

```bash
npm install lnes-agent-sdk-core
```

```ts
import { LnesM2MClient, LNES_PROGRAM_ID } from "lnes-agent-sdk-core";
console.log(LNES_PROGRAM_ID.toBase58());
// → Fe8KhdiFWhKcPWH2N2Svqc3VSpK9EzN8nMh9pQ3cPCeD
```

---

## Machine-readable files

| File | Purpose |
|------|---------|
| `/.well-known/exergynet.json` | Canonical protocol metadata for agent discovery |
| `/llms.txt` | Plaintext summary for LLM and AI agent systems |
| `/robots.txt` | Crawler policy |
| `/sitemap.xml` | Full URL map |

---

## Site structure

```
exergynet.org/
├── index.html          Homepage
├── docs.html           Integration documentation
├── protocol.html       LNES-01 protocol specification
├── sdk.html            TypeScript SDK reference
├── mcp.html            MCP server (planned)
├── proof.html          Mainnet deployment proof
├── agents.html         Agent manifest and discovery
├── security.html       Security model and disclosure
├── roadmap.html        Development phases
├── whitepaper.html     Technical whitepaper
├── llms.txt            LLM/agent discovery
├── robots.txt
├── sitemap.xml
└── .well-known/
    └── exergynet.json  Canonical metadata
```

---

## Deployment

This site is hosted on GitHub Pages. To deploy:

1. Push to the `main` branch
2. Enable GitHub Pages from repository settings → branch: `main`, folder: `/`
3. Set custom domain to `exergynet.org` in Pages settings
4. Add DNS CNAME record pointing to `<username>.github.io`

---

## Topics

`solana` `ai-agents` `m2m` `machine-to-machine` `settlement` `compute` `usdc` `agentic-commerce` `mcp` `exergynet` `lnes`

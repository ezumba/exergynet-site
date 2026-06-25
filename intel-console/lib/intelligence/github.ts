// lib/intelligence/github.ts
// GitHub Events API → NormalizedSignal
// Uses public events endpoint — no auth required for 60 req/hr
// With GITHUB_TOKEN env var → 5000 req/hr

import type { NormalizedSignal } from "./types";

interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string };
  payload: Record<string, unknown>;
  created_at: string;
}

const SIGNIFICANCE_WEIGHTS: Record<string, number> = {
  PushEvent: 0.1,
  WatchEvent: 0.25,
  ForkEvent: 0.35,
  IssuesEvent: 0.4,
  PullRequestEvent: 0.5,
  ReleaseEvent: 0.75,
  CreateEvent: 0.3,
  DeleteEvent: 0.65,
  MemberEvent: 0.45,
  PublicEvent: 0.55,
};

// Repos relevant to ExergyNet/DePIN signal universe
const TRACKED_REPOS = new Set([
  "bitcoin/bitcoin", "ethereum/go-ethereum", "solana-labs/solana",
  "uniswap/v3-core", "aave/aave-v3-core", "Uniswap/v4-core",
  "paradigmxyz/reth", "anza-xyz/agave",
]);

const TRACKED_KEYWORDS = [
  "defi", "depin", "solana", "ethereum", "bitcoin", "crypto", "web3",
  "blockchain", "protocol", "token", "dao", "nft", "staking", "yield",
];

function scoreSignificance(event: GitHubEvent): number {
  let score = SIGNIFICANCE_WEIGHTS[event.type] ?? 0.1;
  if (TRACKED_REPOS.has(event.repo.name)) score += 0.35;
  const repoLower = event.repo.name.toLowerCase();
  if (TRACKED_KEYWORDS.some(kw => repoLower.includes(kw))) score += 0.2;
  const payload = event.payload as Record<string, unknown>;
  if (payload && Object.keys(payload).length > 3) score += 0.05;
  return Math.min(score, 1.0);
}

export async function fetchGitHubSignals(limit = 100): Promise<NormalizedSignal[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ExergyNet-Intel/1.0",
  };
  if (token) headers["Authorization"] = `token ${token}`;

  let events: GitHubEvent[] = [];
  try {
    const res = await fetch("https://api.github.com/events?per_page=100", {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    events = await res.json();
  } catch {
    return [];
  }

  const signals: NormalizedSignal[] = [];
  const windowMs = 3_600_000; // 1 hour
  const cutoff = Date.now() - windowMs;

  // Bucket WatchEvents by repo to detect star surges
  const watchByRepo = new Map<string, GitHubEvent[]>();
  const deleteByActor = new Map<string, GitHubEvent[]>();

  for (const event of events.slice(0, limit)) {
    if (event.actor.login.includes("bot")) continue;
    const ts = new Date(event.created_at).getTime();
    if (ts < cutoff) continue;

    if (event.type === "WatchEvent") {
      const list = watchByRepo.get(event.repo.name) ?? [];
      list.push(event);
      watchByRepo.set(event.repo.name, list);
    }
    if (event.type === "DeleteEvent") {
      const list = deleteByActor.get(event.actor.login) ?? [];
      list.push(event);
      deleteByActor.set(event.actor.login, list);
    }
  }

  // Star surge: ≥5 stars in 1 hour on same repo
  for (const [repo, evts] of watchByRepo) {
    if (evts.length < 5) continue;
    const sig: NormalizedSignal = {
      id: `github_star_surge_${repo}_${Date.now()}`,
      source: "github",
      type: "star_surge",
      timestamp: Date.now(),
      confidence: Math.min(evts.length / 20, 0.95),
      severity: evts.length > 50 ? "critical" : evts.length > 20 ? "warning" : "info",
      entities: [repo, ...evts.map(e => e.actor.login)],
      locations: [],
      sectors: repoToSectors(repo),
      raw: { repo, starCount: evts.length, actors: evts.map(e => e.actor.login) },
    };
    signals.push(sig);
  }

  // Deletion cascade: same actor deletes ≥3 repos
  for (const [actor, evts] of deleteByActor) {
    if (evts.length < 3) continue;
    const sig: NormalizedSignal = {
      id: `github_deletion_cascade_${actor}_${Date.now()}`,
      source: "github",
      type: "deletion_cascade",
      timestamp: Date.now(),
      confidence: Math.min(evts.length / 10, 0.9),
      severity: "critical",
      entities: [actor, ...evts.map(e => e.repo.name)],
      locations: [],
      sectors: ["tech"],
      raw: { actor, repos: evts.map(e => e.repo.name), count: evts.length },
    };
    signals.push(sig);
  }

  // High-significance individual events
  for (const event of events.slice(0, limit)) {
    if (event.actor.login.includes("bot")) continue;
    const sig = scoreSignificance(event);
    if (sig < 0.65) continue;
    signals.push({
      id: `github_${event.id}`,
      source: "github",
      type: event.type.replace("Event", "").toLowerCase(),
      timestamp: new Date(event.created_at).getTime(),
      confidence: sig,
      severity: sig > 0.8 ? "warning" : "info",
      entities: [event.repo.name, event.actor.login],
      locations: [],
      sectors: repoToSectors(event.repo.name),
      raw: { repo: event.repo.name, actor: event.actor.login, type: event.type, payload: event.payload },
    });
  }

  return signals;
}

function repoToSectors(repo: string): string[] {
  const r = repo.toLowerCase();
  const sectors: string[] = [];
  if (r.includes("bitcoin") || r.includes("btc")) sectors.push("crypto", "bitcoin");
  if (r.includes("ethereum") || r.includes("eth")) sectors.push("crypto", "defi");
  if (r.includes("solana") || r.includes("sol")) sectors.push("crypto", "depin");
  if (r.includes("defi") || r.includes("uniswap") || r.includes("aave")) sectors.push("crypto", "defi");
  if (r.includes("nft") || r.includes("dao")) sectors.push("crypto");
  if (sectors.length === 0) sectors.push("tech");
  return [...new Set(sectors)];
}

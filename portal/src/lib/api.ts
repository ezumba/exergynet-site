// ══════════════════════════════════════════════════════════════════════════════
// ExergyNet API client
// All pages import types and helpers from here.
// ══════════════════════════════════════════════════════════════════════════════

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Developer = {
  id: string;
  email: string;
  active: boolean;
  usdc_micro_balance: number;
  /** Pre-formatted by API: (usdc_micro_balance / 1_000_000).toFixed(4) */
  usdc_balance_usd: string;
  api_key_preview: string;
  wallet_address: string | null;
  created_at: string;
};

export type Job = {
  job_id: string;
  prompt_hash: string | null;
  tokens_yielded: number;
  bypassed_layers: number;
  zk_proof_status: string;
  on_chain_sig: string | null;
  created_at: string;
};

export type JobsResponse = {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
};

export type DailyStats = {
  day: string;
  tokens: number;
};

export type Stats = {
  total_tokens: number;
  total_jobs: number;
  total_bypassed_layers: number;
  /** PostgreSQL avg() returns a string — parse with parseFloat() */
  avg_bypassed_layers: string;
  daily: DailyStats[];
  by_status: {
    queued: number;
    settled: number;
    pending: number;
  };
};

// ── Internal helpers ──────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string> | undefined),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('en_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Session ───────────────────────────────────────────────────────────────────

export const adminSession = {
  save: (token: string): void => {
    if (typeof window !== 'undefined') localStorage.setItem('en_admin_token', token);
  },
  clear: (): void => {
    if (typeof window !== 'undefined') localStorage.removeItem('en_admin_token');
  },
  exists: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('en_admin_token');
  },
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('en_admin_token');
  },
};

export const admin = {
  login: async (email: string, password: string): Promise<{ token: string }> => {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Admin login failed');
    return res.json();
  },
};

export const session = {
  save: (token: string): void => {
    if (typeof window !== 'undefined') localStorage.setItem('en_token', token);
  },
  clear: (): void => {
    if (typeof window !== 'undefined') localStorage.removeItem('en_token');
  },
  exists: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('en_token');
  },
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    apiFetch<{ api_key: string; api_key_preview: string; note: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  rotateKey: () =>
    apiFetch<{ api_key: string; note: string }>('/auth/rotate-key', {
      method: 'POST',
      headers: authHeaders(),
    }),
};

// ── Developer ─────────────────────────────────────────────────────────────────

export const developer = {
  me: () =>
    apiFetch<Developer>('/developer/me', {
      headers: authHeaders(),
    }),

  linkWallet: (wallet_address: string) =>
    apiFetch<{ ok: boolean }>('/developer/link-wallet', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ wallet_address }),
    }),

  jobs: (params: { limit?: number; offset?: number; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.status) qs.set('status', params.status);
    return apiFetch<JobsResponse>(`/developer/jobs?${qs.toString()}`, {
      headers: authHeaders(),
    });
  },

  stats: () =>
    apiFetch<Stats>('/developer/stats', {
      headers: authHeaders(),
    }),
};

// ── SSE streaming inference ───────────────────────────────────────────────────

export function streamCompletion(
  key: string,
  prompt: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  return fetch(`${API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'vanguard-engine',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      if (!res.body) { onError('No response body'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) { onDone(); break; }

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            const token: string | undefined = parsed.choices?.[0]?.delta?.content;
            if (token) onToken(token);
          } catch {
            // ignore malformed SSE frames
          }
        }
      }
    })
    .catch((e: Error) => onError(e.message ?? 'Stream error'));
}

import { URL } from 'url';

const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  '169.254.169.254', '169.254.170.2', '100.100.100.200',
];
const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];
const ALLOWED_SCHEMES = ['https:', 'http:'];

export function validateUrl(rawUrl: string): { valid: boolean; reason?: string; url?: URL } {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { valid: false, reason: 'Invalid URL format' }; }
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return { valid: false, reason: `Scheme ${parsed.protocol} not allowed` };
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.includes(hostname)) return { valid: false, reason: `Host ${hostname} is blocked` };
  for (const p of BLOCKED_RANGES) { if (p.test(hostname)) return { valid: false, reason: `IP range blocked: ${hostname}` }; }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return { valid: false, reason: `Direct IP not permitted: ${hostname}` };
  return { valid: true, url: parsed };
}

export async function safeFetch(rawUrl: string, options?: RequestInit): Promise<Response> {
  const v = validateUrl(rawUrl);
  if (!v.valid) throw new Error(`SSRF blocked: ${v.reason} — URL: ${rawUrl}`);
  return fetch(rawUrl, options);
}

// Per-key sliding-window rate limiter, in-memory.
//
// Caveat: Vercel serverless functions get fresh memory per cold-started
// container. Multiple concurrent instances do NOT share state. That means
// this limiter slows down a sustained attacker but isn't bulletproof — a
// determined bot can scale horizontally past it. Good enough for v1 of the
// form. Promote to Upstash Redis (or Vercel KV) if abuse is observed.

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Window>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function maybeSweep() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key       Logical identifier — typically `${ip}:${endpoint}` or `${email}:${endpoint}`.
 * @param max       Maximum requests allowed per window.
 * @param windowMs  Window size in milliseconds.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  maybeSweep();
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (existing.count >= max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { ok: true, remaining: max - existing.count, resetAt: existing.resetAt };
}

/**
 * Astro/Vercel give us a comma-separated x-forwarded-for chain. Take the
 * left-most entry (the original client IP, before any proxies). Fall back to
 * the raw header or "unknown".
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") ?? "unknown";
}

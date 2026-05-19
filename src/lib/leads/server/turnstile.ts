// Cloudflare Turnstile token verification. Server-side only.
// Turnstile is Cloudflare's CAPTCHA replacement — the browser solves a
// challenge silently, gets a one-time token, posts it with the form. The
// server exchanges that token with Cloudflare to confirm "yes, a real human
// (or at least a non-trivial browser) solved this."
//
// Required env vars:
//   TURNSTILE_SECRET_KEY   — server-only.
//
// Optional env var:
//   TURNSTILE_DISABLED=1   — bypass verification entirely (useful for local
//                            development before you've set up Turnstile keys).
//
// Spec: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  error?: string;
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  // Use process.env directly — Astro's import.meta.env doesn't reliably
  // surface non-PUBLIC env vars at runtime in @astrojs/vercel serverless
  // mode (they can be statically replaced at build time, missing later
  // env-var additions on Vercel).
  if (process.env.TURNSTILE_DISABLED === "1") {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail OPEN when no secret is configured. The strict fail-closed
    // default was too aggressive for dev / staging / pre-Turnstile-setup
    // deployments. Rate limiting, schema validation, and dedup still
    // protect the endpoint. Set TURNSTILE_SECRET_KEY (and
    // PUBLIC_TURNSTILE_SITE_KEY on the form) to enable real verification.
    console.warn(
      "[turnstile] no TURNSTILE_SECRET_KEY set — skipping verification. " +
        "Set the env var (or TURNSTILE_DISABLED=1) to silence this warning.",
    );
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, error: (data["error-codes"] ?? ["verify_failed"]).join(",") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "verify_error" };
  }
}

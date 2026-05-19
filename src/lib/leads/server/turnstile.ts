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
  if (import.meta.env.TURNSTILE_DISABLED === "1") {
    return { ok: true };
  }

  const secret = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail closed in production. If you forgot to set the secret, every
    // submission is rejected rather than letting bots through.
    return { ok: false, error: "turnstile_not_configured" };
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

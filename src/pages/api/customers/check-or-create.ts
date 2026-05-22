// POST /api/customers/check-or-create
//
// Dedup + create/link a customer. Returns either:
//   1. dedup_required: true + matches (caller shows "Is this you?" UI,
//      then re-POSTs with customer_action set)
//   2. ok: true + customer_id + customer_token (caller passes the token to
//      /api/leads/create to prove they just created/linked this customer)
//
// Auth: Turnstile-gated on the FIRST call (no customer_action). The re-POST
// after dedup confirmation skips Turnstile because the widget token is
// single-use and we trust the rate limit + session continuity for the loop.
//
// New flow (contact-after-qualifier): this endpoint is called AFTER the
// customer has seen the quote and chosen to proceed. The frontend collects
// contact info, calls this endpoint, then calls /api/leads/create with the
// returned customer_id + customer_token.

export const prerender = false;

import type { APIRoute } from "astro";
import { getServerSupabase } from "../../../lib/leads/server/supabase";
import { verifyTurnstile } from "../../../lib/leads/server/turnstile";
import { rateLimit, clientIp } from "../../../lib/leads/server/ratelimit";
import { issueCustomerToken } from "../../../lib/leads/server/customer-token";

const RATE_LIMIT_PER_IP_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min — match /api/leads/submit

interface RequestBody {
  contact?: unknown;
  address?: unknown;
  account_type?: unknown; // 'residential' | 'commercial'
  customer_action?: unknown; // 'use_existing' | 'create_new' | undefined
  existing_customer_id?: unknown;
  account_name?: unknown; // required for commercial
  turnstile_token?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await handleCheckOrCreate(request);
  } catch (e) {
    const err = e as Error;
    console.error("[/api/customers/check-or-create] unhandled:", err.message, err.stack);
    return json({ ok: false, error: `unhandled: ${err.message}` }, 500);
  }
};

async function handleCheckOrCreate(request: Request): Promise<Response> {
  const ip = clientIp(request);

  const rl = rateLimit(`customer:create:${ip}`, RATE_LIMIT_PER_IP_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return json({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
    });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Turnstile gate on first call (no customer_action). Skip on dedup-resolve
  // re-call since the widget token is single-use.
  if (!body.customer_action) {
    const turnstile = await verifyTurnstile(
      typeof body.turnstile_token === "string" ? body.turnstile_token : null,
      ip,
    );
    if (!turnstile.ok) {
      return json({ ok: false, error: "turnstile:" + (turnstile.error ?? "failed") }, 400);
    }
  }

  const accountType = body.account_type === "commercial" ? "commercial" : "residential";
  const customerAction =
    body.customer_action === "use_existing" || body.customer_action === "create_new"
      ? body.customer_action
      : null;
  const existingCustomerId =
    typeof body.existing_customer_id === "number" ? body.existing_customer_id : null;
  if (customerAction === "use_existing" && !existingCustomerId) {
    return json({ ok: false, error: "existing_customer_id_required" }, 400);
  }
  const accountName = typeof body.account_name === "string" ? body.account_name : null;

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("check_or_create_customer", {
    p_contact: body.contact,
    p_address: body.address,
    p_account_type: accountType,
    p_customer_action: customerAction,
    p_existing_customer_id: existingCustomerId,
    p_account_name: accountName,
  });

  if (error) {
    return json({ ok: false, error: error.message }, 400);
  }

  const result = data as
    | { dedup_required: true; matches: unknown[] }
    | { ok: true; customer_id: number; returning: boolean };

  if ("dedup_required" in result) {
    return json({ ok: false, dedup_required: true, matches: result.matches ?? [] });
  }

  if (!("ok" in result) || typeof result.customer_id !== "number") {
    return json({ ok: false, error: "rpc_unexpected_response" }, 500);
  }

  const customerToken = issueCustomerToken(result.customer_id);

  return json({
    ok: true,
    data: {
      customer_id: result.customer_id,
      returning: result.returning,
      customer_token: customerToken,
    },
  });
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

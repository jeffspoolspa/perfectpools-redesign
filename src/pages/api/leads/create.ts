// POST /api/leads/create
//
// Create a lead under an existing customer. Caller must hold a fresh
// customer_token issued by /api/customers/check-or-create (10-minute TTL).
// Sets the HttpOnly resume cookie and also returns the resume_token in the
// body for the cookie-drop fallback we already use elsewhere.
//
// New flow (contact-after-qualifier):
//   1. /api/quote/calculate  → computes pricing
//   2. /api/customers/check-or-create  → returns customer_id + customer_token
//   3. /api/leads/create  → returns lead_id + resume_token (THIS endpoint)
//
// The existing /api/leads/submit endpoint stays around as a back-compat
// shim (it calls the same underlying RPCs via the submit_website_lead
// wrapper). New code should use this endpoint directly.

export const prerender = false;

import type { APIRoute } from "astro";
import { getServerSupabase } from "../../../lib/leads/server/supabase";
import { setResumeCookie } from "../../../lib/leads/server/cookies";
import { verifyCustomerToken } from "../../../lib/leads/server/customer-token";
import { checkServiceArea } from "../../../lib/leads/service-area";
import { rateLimit, clientIp } from "../../../lib/leads/server/ratelimit";
import type { Office } from "../../../lib/leads/types";

const RATE_LIMIT_PER_IP_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface RequestBody {
  customer_id?: unknown;
  customer_token?: unknown;
  type?: unknown; // 'residential_maintenance' | 'commercial_maintenance' | 'service_request'
  office?: unknown;
  qualifying?: unknown;
  quoted_per_visit?: unknown;
  first_months_deposit?: unknown;
  referral_source?: unknown;
  metadata?: unknown;
  // For service_request leads — used to fire the Airtable ticket as a
  // side-effect after creation succeeds. The legacy submit endpoint did
  // this too; we keep the same behavior here.
  fire_ticket?: unknown;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    return await handleCreate({ request, cookies });
  } catch (e) {
    const err = e as Error;
    console.error("[/api/leads/create] unhandled:", err.message, err.stack);
    return json({ ok: false, error: `unhandled: ${err.message}` }, 500);
  }
};

async function handleCreate({
  request,
  cookies,
}: {
  request: Request;
  cookies: import("astro").AstroCookies;
}): Promise<Response> {
  const ip = clientIp(request);
  const rl = rateLimit(`lead:create:${ip}`, RATE_LIMIT_PER_IP_MAX, RATE_LIMIT_WINDOW_MS);
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

  const customerId = typeof body.customer_id === "number" ? body.customer_id : null;
  if (!customerId) return json({ ok: false, error: "customer_id_required" }, 400);

  const tokenCheck = verifyCustomerToken(
    typeof body.customer_token === "string" ? body.customer_token : "",
    customerId,
  );
  if (!tokenCheck.ok) {
    return json({ ok: false, error: "customer_token:" + tokenCheck.reason }, 401);
  }

  const type = body.type;
  if (
    type !== "residential_maintenance" &&
    type !== "commercial_maintenance" &&
    type !== "service_request"
  ) {
    return json({ ok: false, error: "invalid_type" }, 400);
  }

  // Office routing — the caller computes via checkServiceArea(zip) on the
  // client and passes it through. Validate it's a known office; the actual
  // service-area enforcement happens at /api/quote/calculate, which the
  // client SHOULD have already called before reaching this point.
  let office: Office | null = null;
  if (body.office === "richmond_hill" || body.office === "brunswick" || body.office === "st_marys") {
    office = body.office;
  } else {
    return json({ ok: false, error: "office_required" }, 400);
  }
  // Optional: re-verify via address-derived service area if address is in
  // metadata. Skipped here since the customer row already has a billing
  // address that office should agree with — enforcement is at /quote/calculate.

  const qualifying = body.qualifying ?? {};
  const quotedPerVisit =
    typeof body.quoted_per_visit === "number" ? body.quoted_per_visit : null;
  const firstMonthsDeposit =
    typeof body.first_months_deposit === "number" ? body.first_months_deposit : null;
  const referralSource =
    typeof body.referral_source === "string" ? body.referral_source : null;

  const metadata: Record<string, unknown> =
    (body.metadata && typeof body.metadata === "object" ? body.metadata : {}) as Record<string, unknown>;
  metadata.intake_ip = ip;
  metadata.intake_user_agent = request.headers.get("user-agent") ?? undefined;
  metadata.intake_at = new Date().toISOString();

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("create_lead", {
    p_customer_id: customerId,
    p_type: type,
    p_office: office,
    p_qualifying: qualifying,
    p_quoted_per_visit: quotedPerVisit,
    p_first_months_deposit: firstMonthsDeposit,
    p_referral_source: referralSource,
    p_metadata: metadata,
  });

  if (error) return json({ ok: false, error: error.message }, 500);

  const result = data as {
    ok?: boolean;
    lead_id?: string;
    resume_token?: string;
    lifecycle_state?: "open" | "closed";
    closed_reason?: string | null;
    child_status?: string | null;
  };

  if (!result.ok || !result.lead_id) {
    return json({ ok: false, error: "rpc_unexpected_response" }, 500);
  }

  if (result.resume_token) {
    setResumeCookie(cookies, result.resume_token);
  }

  // For service_request leads, fire the Airtable ticket as a best-effort
  // side-effect (matching the legacy submit endpoint's behavior).
  if (
    result.lifecycle_state === "closed" &&
    result.closed_reason === "ticketed" &&
    body.fire_ticket !== false
  ) {
    fireTicketSubmission(supabase, result.lead_id).catch(() => {});
  }

  return json({
    ok: true,
    data: {
      lead_id: result.lead_id,
      resume_token: result.resume_token,
      lifecycle_state: result.lifecycle_state,
      closed_reason: result.closed_reason,
      child_status: result.child_status,
      office,
    },
  });
}

async function fireTicketSubmission(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
): Promise<void> {
  const { data: detail } = await supabase.rpc("get_maintenance_lead_detail", {
    p_lead_id: leadId,
  });
  if (!detail) return;
  const sr = (detail as { metadata?: { service_request?: Record<string, unknown> } })
    ?.metadata?.service_request;
  if (!sr) return;
  const d = detail as Record<string, unknown>;
  await supabase.functions.invoke("submit-ticket", {
    body: {
      type: sr.kind ?? "service",
      firstName: d.first_name,
      lastName: d.last_name,
      email: d.email,
      phone: d.phone,
      addressStreet: d.billing_street,
      addressCity: d.billing_city,
      addressState: d.billing_state,
      addressZip: d.billing_zip,
      description: sr.issue_description ?? null,
      office: d.office,
      source: "website-quote-form",
      lead_id: leadId,
    },
  });
}

// Suppress unused-import warning until we actually need it (kept for parity
// with /api/leads/submit's office-validation pattern)
void checkServiceArea;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

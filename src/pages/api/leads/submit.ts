// POST /api/leads/submit
//
// New "all-at-once" lead intake. Replaces the previous /start + /qualify
// two-phase flow. Client submits the whole form at the end of the qualifying
// page; server runs dedup, and either:
//
//   1. Returns dedup matches (no DB writes) → client shows "Is this you?" UI
//      then re-POSTs with `customer_action` set
//   2. Creates the customer + lead + child + service bodies in one transaction
//      and sets the HttpOnly resume-token cookie

export const prerender = false;

import type { APIRoute } from "astro";
import { validateStartLead, validateQualifyLead } from "../../../lib/leads/validation";
import { checkServiceArea } from "../../../lib/leads/service-area";
import { calculateQuote } from "../../../lib/leads/pricing";
import { getServerSupabase } from "../../../lib/leads/server/supabase";
import { verifyTurnstile } from "../../../lib/leads/server/turnstile";
import { rateLimit, clientIp } from "../../../lib/leads/server/ratelimit";
import { setResumeCookie } from "../../../lib/leads/server/cookies";
import type { BodyType, VisitsPerWeek } from "../../../lib/leads/types";

const RATE_LIMIT_PER_IP_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface SubmitRequestBody {
  contact?: unknown;
  address?: unknown;
  qualifying?: unknown;
  account_type?: unknown; // 'residential' | 'commercial'
  customer_action?: unknown; // 'use_existing' | 'create_new' | undefined
  existing_customer_id?: unknown;
  referral_source?: unknown;
  turnstile_token?: unknown;
  client?: unknown;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = clientIp(request);

  const rl = rateLimit(`leads:submit:${ip}`, RATE_LIMIT_PER_IP_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return json({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
    });
  }

  let body: SubmitRequestBody;
  try {
    body = (await request.json()) as SubmitRequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Turnstile gate — but only on the first call. The re-submit after dedup
  // confirmation has a `customer_action` set; widget tokens are single-use,
  // so we'd fail verification on the second call. Trust the rate limit +
  // session continuity for the resubmit.
  if (!body.customer_action) {
    const turnstile = await verifyTurnstile(
      typeof body.turnstile_token === "string" ? body.turnstile_token : null,
      ip,
    );
    if (!turnstile.ok) {
      return json({ ok: false, error: "turnstile:" + (turnstile.error ?? "failed") }, 400);
    }
  }

  // Validate contact + address shape using the shared validator
  const validatedStart = validateStartLead({
    contact: body.contact,
    address: body.address,
    referral_source: body.referral_source,
    client: body.client,
  });
  if (!validatedStart.ok) {
    return json({ ok: false, error: validatedStart.error }, 400);
  }
  const start = validatedStart.value;

  // Validate qualifying payload using the shared validator (discriminated by type)
  const validatedQualify = validateQualifyLead(body.qualifying);
  if (!validatedQualify.ok) {
    return json({ ok: false, error: validatedQualify.error }, 400);
  }
  const qualifying = validatedQualify.value;

  // Validate account_type independently of lead type (commercial account can
  // still file a service_request, etc.)
  const accountType = body.account_type === "commercial" ? "commercial" : "residential";

  // Service area gate (server-side; never trust client)
  const area = checkServiceArea(start.address.zip);
  if (!area.inArea || !area.office) {
    return json({ ok: false, error: "out_of_service_area" }, 400);
  }

  // Compute server-side pricing for residential maintenance
  let quotedPerVisit: number | null = null;
  let firstMonthsDeposit: number | null = null;
  if (qualifying.type === "residential_maintenance") {
    const primary = qualifying.bodies.find((b) => b.is_primary) ?? qualifying.bodies[0];
    const additionalCount = Math.max(0, qualifying.bodies.length - 1);
    const quote = calculateQuote({
      primaryBodyType: primary.body_type as BodyType,
      additionalBodyCount: additionalCount,
      visitsPerWeek: qualifying.visits_per_week as VisitsPerWeek,
    });
    quotedPerVisit = quote.perVisit;
    firstMonthsDeposit = quote.firstMonthsDeposit;
  }

  // Metadata blob merged onto leads.metadata
  const metadata: Record<string, unknown> = {
    intake_ip: ip,
    intake_user_agent: request.headers.get("user-agent") ?? undefined,
    intake_referrer:
      (start.client?.referrer ?? request.headers.get("referer")) || undefined,
    intake_at: new Date().toISOString(),
  };
  if (start.client?.utm) metadata.utm = start.client.utm;

  const customerAction =
    body.customer_action === "use_existing" || body.customer_action === "create_new"
      ? body.customer_action
      : null;
  const existingCustomerId =
    typeof body.existing_customer_id === "number"
      ? body.existing_customer_id
      : null;
  if (customerAction === "use_existing" && !existingCustomerId) {
    return json({ ok: false, error: "existing_customer_id_required" }, 400);
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("submit_website_lead", {
    p_contact: start.contact,
    p_address: start.address,
    p_office: area.office,
    p_type: qualifying.type,
    p_account_type: accountType,
    p_qualifying: qualifying,
    p_customer_action: customerAction,
    p_existing_customer_id: existingCustomerId,
    p_quoted_per_visit: quotedPerVisit,
    p_first_months_deposit: firstMonthsDeposit,
    p_referral_source: start.referral_source ?? null,
    p_metadata: metadata,
  });

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const result = data as {
    dedup_required?: boolean;
    matches?: Array<{
      customer_id: number;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      redacted_phone: string | null;
      redacted_email: string | null;
      account_type: string | null;
    }>;
    ok?: boolean;
    lead_id?: string;
    account_id?: number;
    resume_token?: string;
    returning?: boolean;
    lifecycle_state?: "open" | "closed";
    closed_reason?: string | null;
    child_status?: string | null;
  };

  if (result.dedup_required) {
    return json({
      ok: false,
      dedup_required: true,
      matches: result.matches ?? [],
    });
  }

  if (!result.ok || !result.lead_id) {
    return json({ ok: false, error: "rpc_unexpected_response" }, 500);
  }

  if (result.resume_token) {
    setResumeCookie(cookies, result.resume_token);
  }

  // For service_request leads, the RPC closes the lead with closed_reason
  // ='ticketed' and stashes details in metadata. Fire the Airtable ticket
  // here as a best-effort side effect — failure doesn't roll back the lead.
  if (result.lifecycle_state === "closed" && result.closed_reason === "ticketed") {
    fireTicketSubmission(supabase, result.lead_id).catch(() => {});
  }

  return json({
    ok: true,
    data: {
      lead_id: result.lead_id,
      account_id: result.account_id,
      returning: !!result.returning,
      office: area.office,
      lifecycle_state: result.lifecycle_state,
      closed_reason: result.closed_reason,
      child_status: result.child_status,
      quote: quotedPerVisit !== null
        ? {
            per_visit: quotedPerVisit,
            first_months_deposit: firstMonthsDeposit,
          }
        : undefined,
    },
  });
};

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

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

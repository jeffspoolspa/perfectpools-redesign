// POST /api/leads/send-quote
//
// User-triggered quote send. The Email Quote / Text Quote buttons on the
// website's quote-form modal hit this after the lead has been qualified
// (residential_maintenance). The endpoint:
//
//   1. Reads the HttpOnly resume-token cookie set by /api/leads/start
//   2. Validates the cookie token matches the lead row
//   3. Fetches lead + customer detail via get_maintenance_lead_detail RPC
//   4. Renders the quote email/SMS template
//   5. Calls internal-app's /api/comms/send-email or /send-sms over HTTP
//   6. Calls public.mark_lead_quoted RPC (sets child status='quoted', stamps
//      parent.quote_channel + last_contacted_at)
//
// Auth model: the cookie is the user-session credential. The internal-app
// transport requires a service-to-service token which we hold in env and
// pass through; the browser never sees it.

export const prerender = false;

import type { APIRoute } from "astro";
import { getServerSupabase } from "../../../lib/leads/server/supabase";
import { getResumeToken } from "../../../lib/leads/server/cookies";
import {
  sendEmailViaInternal,
  sendSmsViaInternal,
} from "../../../lib/comms/client";
import {
  renderQuoteEmail,
  renderQuoteSms,
  type QuoteContext,
} from "../../../lib/comms/templates/quote";
import type {
  BodyType,
  Office,
  VisitsPerWeek,
} from "../../../lib/leads/types";

interface RequestBody {
  lead_id?: unknown;
  channel?: unknown;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = getResumeToken(cookies);
  if (!token) {
    return json({ ok: false, error: "missing_resume_token" }, 401);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const leadId = typeof body.lead_id === "string" ? body.lead_id : null;
  const channel = body.channel === "email" || body.channel === "sms" ? body.channel : null;
  if (!leadId) return json({ ok: false, error: "missing_lead_id" }, 400);
  if (!channel) return json({ ok: false, error: "channel_required" }, 400);

  const supabase = getServerSupabase();

  // Validate cookie token matches the lead. Both must be present and equal —
  // otherwise the caller could claim any lead_id they know.
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("id, type, resume_token, account_id, office")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return json({ ok: false, error: leadErr.message }, 500);
  if (!leadRow) return json({ ok: false, error: "lead_not_found" }, 404);
  if (leadRow.resume_token !== token) {
    return json({ ok: false, error: "token_mismatch" }, 403);
  }
  if (leadRow.type !== "residential_maintenance") {
    // Quote sending only makes sense for residential maintenance leads.
    // Commercial and service_request follow different downstream paths.
    return json({ ok: false, error: "lead_not_quotable" }, 400);
  }

  // Pull full detail (contact, address, bodies, pricing) for template + send.
  const { data: detail, error: detailErr } = await supabase.rpc(
    "get_maintenance_lead_detail",
    { p_lead_id: leadId },
  );
  if (detailErr) return json({ ok: false, error: detailErr.message }, 500);
  if (!detail) return json({ ok: false, error: "lead_detail_not_found" }, 404);

  const d = detail as Record<string, unknown>;
  const bodies = (d.bodies as Array<{ body_type: BodyType; is_primary: boolean }> | null) ?? [];
  const primary = bodies.find((b) => b.is_primary) ?? bodies[0];
  if (!primary) {
    return json({ ok: false, error: "lead_has_no_bodies" }, 400);
  }

  const ctx: QuoteContext = {
    office: leadRow.office as Office,
    first_name: (d.first_name as string) ?? "",
    primary_body_type: primary.body_type,
    additional_body_count: Math.max(0, bodies.length - 1),
    visits_per_week: Number(d.visits_per_week ?? 1) as VisitsPerWeek,
    per_visit: Number(d.quoted_per_visit ?? 0),
    first_months_deposit: Number(d.first_months_deposit ?? 0),
  };

  if (channel === "email") {
    const recipient = (d.email as string) ?? "";
    if (!recipient) return json({ ok: false, error: "lead_has_no_email" }, 400);
    const rendered = renderQuoteEmail(ctx);
    const result = await sendEmailViaInternal({
      lead_id: leadId,
      office: ctx.office,
      to: recipient,
      subject: rendered.subject,
      body_html: rendered.body_html,
      body_text: rendered.body_text,
      template_name: "quote_initial",
      created_by: "website:send-quote",
    });
    if (!result.ok) {
      return json({ ok: false, error: result.error ?? "send_failed" }, 502);
    }
    await markQuotedSilently(supabase, leadId, "email");
    await enrollQuoteFollowupIfMissing(supabase, leadId, "email");
    return json({
      ok: true,
      data: { communication_id: result.communication_id, channel },
    });
  }

  // channel === 'sms'
  const phone = (d.phone as string) ?? "";
  if (!phone) return json({ ok: false, error: "lead_has_no_phone" }, 400);
  const rendered = renderQuoteSms(ctx);
  const result = await sendSmsViaInternal({
    lead_id: leadId,
    office: ctx.office,
    to: phone,
    body: rendered.body,
    template_name: "quote_initial",
    created_by: "website:send-quote",
  });
  if (!result.ok) {
    return json({ ok: false, error: result.error ?? "send_failed" }, 502);
  }
  await enrollQuoteFollowupIfMissing(supabase, leadId, "sms");
  await markQuotedSilently(supabase, leadId, "sms");
  return json({
    ok: true,
    data: { communication_id: result.communication_id, channel },
  });
};

async function markQuotedSilently(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
  channel: "email" | "sms",
): Promise<void> {
  // Best-effort: the comms send is the load-bearing thing. If mark_lead_quoted
  // fails (e.g. lead already quoted via a different path), don't fail the
  // user-visible request.
  const { error } = await supabase.rpc("mark_lead_quoted", {
    p_lead_id: leadId,
    p_channel: channel,
  });
  if (error) console.warn("mark_lead_quoted failed:", error.message);
}

/**
 * Insert a `quote_followup` campaign row for this lead if one doesn't already
 * exist. Idempotent — if the user clicks Email then Text, only the first call
 * creates the row; the second is a no-op. The cadence runner (future
 * Windmill cron) will pick up rows where next_fire_at <= now() and fire the
 * next step.
 *
 * First-step gap: 2 days. That matches the old quote_followup_cadence script's
 * day-2/day-3/day-5 pattern.
 */
async function enrollQuoteFollowupIfMissing(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
  initialChannel: "email" | "sms",
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("campaigns")
      .select("id")
      .eq("lead_id", leadId)
      .eq("campaign", "quote_followup")
      .in("status", ["active", "paused"])
      .limit(1)
      .maybeSingle();
    if (existing) return; // already enrolled

    const nextFireAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("campaigns").insert({
      lead_id: leadId,
      campaign: "quote_followup",
      current_step: 0,
      next_fire_at: nextFireAt,
      status: "active",
      metadata: { initial_channel: initialChannel },
    });
    if (error) console.warn("enroll quote_followup failed:", error.message);
  } catch (e) {
    // Best-effort — never fail the user-visible send because of campaign-row issues
    console.warn("enroll quote_followup unexpected:", (e as Error).message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/leads/accept
//
// "Get Started Now" button on the final quote page. Flips the child
// residential_lead_details.status (or commercial_lead_details.status) to
// 'accepted'. Parent lifecycle_state stays 'open' — 'accepted' isn't a
// terminal status; only 'converted' (after onboarding completes) is.
//
// Auth: HttpOnly resume-token cookie set by /api/leads/submit. The cookie
// proves the user owns this session; the RPC double-checks that the token
// matches the lead row.

export const prerender = false;

import type { APIRoute } from "astro";
import { getServerSupabase } from "../../../lib/leads/server/supabase";
import { getResumeToken } from "../../../lib/leads/server/cookies";

interface AcceptRequestBody {
  lead_id?: unknown;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = getResumeToken(cookies);
  if (!token) {
    return json({ ok: false, error: "missing_resume_token" }, 401);
  }

  let body: AcceptRequestBody;
  try {
    body = (await request.json()) as AcceptRequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const leadId = typeof body.lead_id === "string" ? body.lead_id : null;
  if (!leadId) return json({ ok: false, error: "missing_lead_id" }, 400);

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("accept_lead", {
    p_lead_id: leadId,
    p_resume_token: token,
  });

  if (error) {
    return json({ ok: false, error: error.message }, 400);
  }

  return json({ ok: true, data });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

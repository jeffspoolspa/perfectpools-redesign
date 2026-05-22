// POST /api/quote/calculate
//
// Pure compute. Given an address + qualifying answers, returns the office
// routing + per-visit + monthly pricing + service-area check. No DB writes,
// no auth, no PII handling. Safe to call as often as the form changes (live
// pricing as user toggles weekly/biweekly, swaps body type, etc.).
//
// Used by the new contact-after-qualifier flow where the customer sees the
// quote BEFORE giving us contact info. The actual lead is created later by
// /api/leads/create once the customer commits.

export const prerender = false;

import type { APIRoute } from "astro";
import { checkServiceArea } from "../../../lib/leads/service-area";
import { calculateQuote } from "../../../lib/leads/pricing";
import { rateLimit, clientIp } from "../../../lib/leads/server/ratelimit";
import type { BodyType, VisitsPerWeek } from "../../../lib/leads/types";

// Loose limit — this endpoint is cheap and can be called on every form keystroke
const RATE_LIMIT_PER_IP_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

interface RequestBody {
  address?: { street?: unknown; city?: unknown; state?: unknown; zip?: unknown };
  qualifying?: {
    body_type?: unknown; // 'pool' | 'spa' | 'pool_spa_combo'
    additional_body_count?: unknown;
    visits_per_week?: unknown;
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await handleCalculate(request);
  } catch (e) {
    const err = e as Error;
    console.error("[/api/quote/calculate] unhandled:", err.message, err.stack);
    return json({ ok: false, error: `unhandled: ${err.message}` }, 500);
  }
};

async function handleCalculate(request: Request): Promise<Response> {
  const ip = clientIp(request);
  const rl = rateLimit(`quote:calculate:${ip}`, RATE_LIMIT_PER_IP_MAX, RATE_LIMIT_WINDOW_MS);
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

  const zip = typeof body.address?.zip === "string" ? body.address.zip.trim() : "";
  if (!zip) return json({ ok: false, error: "zip_required" }, 400);

  const area = checkServiceArea(zip);
  if (!area.inArea || !area.office) {
    return json({
      ok: true,
      data: {
        in_service_area: false,
        office: null,
      },
    });
  }

  const q = body.qualifying ?? {};
  // body_type is the user-facing selection ('pool', 'spa', 'pool_spa_combo').
  // Translate to the (primaryBodyType + additionalBodyCount) shape that
  // calculateQuote actually uses:
  //   pool            → primary=pool, additional=0   ($50)
  //   spa             → primary=spa,  additional=0   ($45)
  //   pool_spa_combo  → primary=pool, additional=1   ($60: 50 + 10 surcharge)
  // Callers can ALSO pass additional_body_count explicitly to add fountains
  // or extra spas on top of the combo selection (e.g., pool+spa+fountain).
  const bt = q.body_type;
  let primary: BodyType;
  let baseAdditional: number;
  if (bt === "pool") {
    primary = "pool";
    baseAdditional = 0;
  } else if (bt === "spa") {
    primary = "spa";
    baseAdditional = 0;
  } else if (bt === "pool_spa_combo") {
    primary = "pool";
    baseAdditional = 1; // the spa half of the combo
  } else {
    return json({ ok: false, error: "invalid_body_type" }, 400);
  }
  const extraAdditional = Number(q.additional_body_count ?? 0);
  if (!Number.isInteger(extraAdditional) || extraAdditional < 0 || extraAdditional > 10) {
    return json({ ok: false, error: "invalid_additional_body_count" }, 400);
  }
  const vpw = Number(q.visits_per_week ?? 1) as VisitsPerWeek;
  // calculateQuote validates this internally; we just narrow the type here
  if (!(vpw === 0.5 || vpw === 1 || vpw === 2 || vpw === 3)) {
    return json({ ok: false, error: "invalid_visits_per_week" }, 400);
  }

  const quote = calculateQuote({
    primaryBodyType: primary,
    additionalBodyCount: baseAdditional + extraAdditional,
    visitsPerWeek: vpw,
  });

  // Match the existing in-form pricing math (which uses simple 2 or 4
  // visits-per-month rather than the QuotePricingSection's 2.167/4.333).
  // The form already shows the user this number; the calculate endpoint
  // should agree with it so the UI doesn't show two different totals.
  const visitsPerMonth = vpw >= 1 ? 4 : 2;
  const monthly = quote.perVisit * visitsPerMonth;

  return json({
    ok: true,
    data: {
      in_service_area: true,
      office: area.office,
      per_visit: quote.perVisit,
      visits_per_month: visitsPerMonth,
      monthly,
      first_months_deposit: quote.firstMonthsDeposit,
    },
  });
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

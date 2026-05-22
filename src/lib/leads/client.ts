// Browser-side API client for the lead intake endpoints. All functions are
// thin typed wrappers over fetch — no UI dependencies, easy to test with
// mocked fetch.
//
// Two generations of endpoints currently live side-by-side:
//
//   Legacy (single submit):  /api/leads/submit  — apiSubmitLead
//     Used by the current frontend (GetStartedQuoteV2). Bundles customer
//     creation + lead creation + dedup loop into one request.
//
//   New (split):  /api/quote/calculate  + /api/customers/check-or-create
//                 + /api/leads/create
//     Used by the upcoming contact-after-qualifier flow. Each endpoint
//     does one thing; together they support reorderable form flows.
//
// Both go through the same /api/leads/accept and /api/leads/send-quote
// once a lead exists.

import type { Office } from "./types";

/* ─── shared helpers ─────────────────────────────────────── */

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res
      .json()
      .catch(() => ({ ok: false, error: "invalid_response" }));
    return { ok: !!data.ok, data: data.data as T, error: data.error, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message || "network_error",
      status: 0,
    };
  }
}

/* ─── Turnstile token holder ─────────────────────────────────
   The form mounts the Turnstile widget; its callback stashes the token
   here. Consumers (apiSubmitLead, apiCheckOrCreateCustomer) read it
   transparently. Single-use — clear after a successful request. */
let _turnstileToken: string | null = null;
export function setTurnstileToken(t: string | null): void {
  _turnstileToken = t;
}
export function getTurnstileToken(): string | null {
  return _turnstileToken;
}

/* ─── UTM passthrough ────────────────────────────────────────
   Read utm_* params off the current URL so attribution flows through
   into leads.metadata. Returns {} on non-browser execution. */
export function getUtmParams(): Record<string, string> {
  try {
    const u = new URL(window.location.href);
    const out: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(
      (k) => {
        const v = u.searchParams.get(k);
        if (v) out[k] = v;
      },
    );
    return out;
  } catch {
    return {};
  }
}

/* ─── shared types ───────────────────────────────────────── */

export interface DedupMatch {
  customer_id: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  redacted_phone: string | null;
  redacted_email: string | null;
  account_type: string | null;
}

export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export interface AddressInput {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ClientMeta {
  user_agent?: string;
  referrer?: string;
  utm?: Record<string, string>;
}

/* ─── LEGACY: /api/leads/submit  (used by current frontend) ─── */

export interface SubmitLeadOutput {
  lead_id: string;
  account_id: number;
  returning: boolean;
  office: string;
  lifecycle_state: "open" | "closed";
  closed_reason: string | null;
  child_status: string | null;
  /** Echo of the HttpOnly resume cookie — body fallback for cookie drop. */
  resume_token?: string;
  quote?: { per_visit: number; first_months_deposit: number };
}

export interface SubmitLeadResult {
  ok: boolean;
  data?: SubmitLeadOutput;
  dedup_required?: boolean;
  matches?: DedupMatch[];
  error?: string;
  status: number;
}

export interface SubmitLeadInput {
  contact: ContactInput;
  address: AddressInput;
  account_type: "residential" | "commercial";
  qualifying: Record<string, unknown>;
  referral_source?: string;
  customer_action?: "use_existing" | "create_new";
  existing_customer_id?: number;
  client?: ClientMeta;
}

export async function apiSubmitLead(input: SubmitLeadInput): Promise<SubmitLeadResult> {
  try {
    const body: Record<string, unknown> = { ...input };
    // Turnstile token is single-use — only include on the first call
    // (the one without customer_action). The re-submit after dedup
    // confirmation would fail re-verification with the same token.
    if (!input.customer_action) {
      body.turnstile_token = getTurnstileToken();
    }
    const res = await fetch("/api/leads/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res
      .json()
      .catch(() => ({ ok: false, error: "invalid_response" }));
    return { ...data, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message || "network_error",
      status: 0,
    };
  }
}

/* ─── NEW: /api/quote/calculate ─── */

export type BodyTypeFacing = "pool" | "spa" | "pool_spa_combo";

export interface CalculateQuoteInput {
  address: AddressInput;
  qualifying: {
    body_type: BodyTypeFacing;
    additional_body_count: number;
    visits_per_week: number;
  };
}

export interface CalculateQuoteOutput {
  in_service_area: boolean;
  office: Office | null;
  per_visit?: number;
  visits_per_month?: number;
  monthly?: number;
  first_months_deposit?: number;
}

export function apiCalculateQuote(
  input: CalculateQuoteInput,
): Promise<ApiResult<CalculateQuoteOutput>> {
  return apiPost("/api/quote/calculate", input);
}

/* ─── NEW: /api/customers/check-or-create ─── */

export interface CheckOrCreateCustomerInput {
  contact: ContactInput;
  address: AddressInput;
  account_type: "residential" | "commercial";
  customer_action?: "use_existing" | "create_new";
  existing_customer_id?: number;
  account_name?: string;
}

export interface CheckOrCreateCustomerOutput {
  customer_id: number;
  returning: boolean;
  /** Short-lived signed token; pass to apiCreateLead. */
  customer_token: string;
}

/**
 * Returns one of three shapes (mapped onto ApiResult):
 *   - ok=true + data: customer created/linked, token issued
 *   - ok=false + dedup_required: matches found, show "Is this you?"
 *   - ok=false + error: Turnstile failure, validation error, etc.
 */
export interface CheckOrCreateCustomerResult {
  ok: boolean;
  data?: CheckOrCreateCustomerOutput;
  dedup_required?: boolean;
  matches?: DedupMatch[];
  error?: string;
  status: number;
}

export async function apiCheckOrCreateCustomer(
  input: CheckOrCreateCustomerInput,
): Promise<CheckOrCreateCustomerResult> {
  try {
    const body: Record<string, unknown> = { ...input };
    if (!input.customer_action) {
      body.turnstile_token = getTurnstileToken();
    }
    const res = await fetch("/api/customers/check-or-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res
      .json()
      .catch(() => ({ ok: false, error: "invalid_response" }));
    return { ...data, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message || "network_error",
      status: 0,
    };
  }
}

/* ─── NEW: /api/leads/create ─── */

export interface CreateLeadInput {
  customer_id: number;
  customer_token: string;
  type: "residential_maintenance" | "commercial_maintenance" | "service_request";
  office: Office;
  qualifying: Record<string, unknown>;
  quoted_per_visit?: number;
  first_months_deposit?: number;
  referral_source?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLeadOutput {
  lead_id: string;
  resume_token: string;
  lifecycle_state: "open" | "closed";
  closed_reason: string | null;
  child_status: string | null;
  office: Office;
}

export function apiCreateLead(
  input: CreateLeadInput,
): Promise<ApiResult<CreateLeadOutput>> {
  return apiPost("/api/leads/create", input);
}

/* ─── /api/leads/accept ─── */

export function apiAcceptLead(
  leadId: string,
  resumeToken: string | null,
): Promise<ApiResult<{ ok: boolean; lead_id: string; status: string }>> {
  // resume_token in body is a fallback for when the HttpOnly cookie set
  // by /api/leads/{submit,create} gets dropped by the browser.
  return apiPost("/api/leads/accept", {
    lead_id: leadId,
    resume_token: resumeToken ?? undefined,
  });
}

/* ─── /api/leads/send-quote ─── */

export function apiSendQuote(
  leadId: string,
  channel: "email" | "sms",
  resumeToken: string | null,
): Promise<ApiResult<{ communication_id: string; channel: "email" | "sms" }>> {
  return apiPost("/api/leads/send-quote", {
    lead_id: leadId,
    channel,
    resume_token: resumeToken ?? undefined,
  });
}

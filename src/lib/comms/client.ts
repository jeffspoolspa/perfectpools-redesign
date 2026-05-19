// HTTP client for the comms transport hosted on internal-app
// (internal.jeffspoolspa.com). All sends go through the shared transport so
// the communications schema gets one consistent writer.
//
// Required env vars (server-only, no PUBLIC_ prefix):
//   INTERNAL_API_TOKEN     — must match the value set on internal-app's Vercel
//   INTERNAL_API_BASE_URL  — optional, defaults to https://internal.jeffspoolspa.com

import type { Office } from "../leads/types";

const DEFAULT_BASE = "https://internal.jeffspoolspa.com";

function baseUrl(): string {
  // process.env: Astro's import.meta.env doesn't reliably surface non-PUBLIC
  // env vars at runtime in @astrojs/vercel serverless mode.
  return process.env.INTERNAL_API_BASE_URL ?? DEFAULT_BASE;
}

function token(): string {
  const t = process.env.INTERNAL_API_TOKEN;
  if (!t) throw new Error("Missing INTERNAL_API_TOKEN env var");
  return t;
}

export interface CommIdentity {
  lead_id?: string;
  customer_id?: number;
  task_id?: string;
  service_body_id?: number;
}

export interface SendEmailInput extends CommIdentity {
  office: Office;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  in_reply_to?: string;
  email_references?: string;
  template_name?: string;
  direction?: "outbound" | "system";
  created_by?: string;
  metadata?: Record<string, unknown>;
  from_name_override?: string;
}

export interface SendEmailResponse {
  ok: boolean;
  communication_id?: string;
  provider_message_id?: string;
  error?: string;
}

export async function sendEmailViaInternal(
  input: SendEmailInput,
): Promise<SendEmailResponse> {
  try {
    const res = await fetch(`${baseUrl()}/api/comms/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token(),
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as SendEmailResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `internal_api_http_${res.status}`,
      };
    }
    return data;
  } catch (e) {
    return { ok: false, error: (e as Error).message || "network_error" };
  }
}

export interface SendSmsInput extends CommIdentity {
  office: Office;
  to: string;
  body: string;
  template_name?: string;
  direction?: "outbound" | "system";
  created_by?: string;
  metadata?: Record<string, unknown>;
}

export interface SendSmsResponse {
  ok: boolean;
  communication_id?: string;
  provider_message_id?: string;
  provider_conversation_id?: string;
  status?: string;
  error?: string;
}

export async function sendSmsViaInternal(
  input: SendSmsInput,
): Promise<SendSmsResponse> {
  try {
    const res = await fetch(`${baseUrl()}/api/comms/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token(),
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as SendSmsResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `internal_api_http_${res.status}`,
      };
    }
    return data;
  } catch (e) {
    return { ok: false, error: (e as Error).message || "network_error" };
  }
}

// Quote email + SMS templates. Mirrors the rendering logic from the legacy
// send-quote Supabase Edge function but office-aware (Richmond Hill uses the
// "Perfect Pools" brand; Brunswick + St Marys use "Jeff's Pool & Spa Service").
//
// The intent endpoint pulls the lead via get_maintenance_lead_detail RPC,
// shapes a QuoteContext, hands it to renderQuoteEmail / renderQuoteSms,
// and ships the result to the transport.

import type { Office, BodyType, VisitsPerWeek } from "../../leads/types";

interface OfficeBrand {
  name: string;
  phone: string;
}

const OFFICE_BRAND: Record<Office, OfficeBrand> = {
  richmond_hill: { name: "Perfect Pools", phone: "(912) 459-0160" },
  brunswick: { name: "Jeff's Pool & Spa Service", phone: "(912) 459-0160" },
  st_marys: { name: "Jeff's Pool & Spa Service", phone: "(912) 459-0160" },
};

export interface QuoteContext {
  office: Office;
  first_name: string;
  primary_body_type: BodyType;
  additional_body_count: number;
  visits_per_week: VisitsPerWeek;
  per_visit: number;
  first_months_deposit: number;
}

function frequencyLabel(v: number): string {
  if (v === 0.5) return "Bi-weekly";
  if (v === 2) return "2x / week";
  if (v >= 3) return `${v}x / week`;
  return "Weekly";
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function serviceLine(ctx: QuoteContext): string {
  const extra =
    ctx.additional_body_count > 0
      ? ` + ${ctx.additional_body_count} additional bod${
          ctx.additional_body_count > 1 ? "ies" : "y"
        }`
      : "";
  return `${capitalize(ctx.primary_body_type)} maintenance${extra}`;
}

function summaryText(ctx: QuoteContext): string {
  return (
    `Service: ${serviceLine(ctx)}\n` +
    `Frequency: ${frequencyLabel(ctx.visits_per_week)}\n` +
    `Per visit: $${ctx.per_visit}\n` +
    `First month deposit: $${ctx.first_months_deposit}`
  );
}

function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#1f2937;white-space:pre-wrap;font-size:15px;">${esc}</div>`;
}

export interface RenderedEmail {
  subject: string;
  body_text: string;
  body_html: string;
}

export function renderQuoteEmail(ctx: QuoteContext): RenderedEmail {
  const brand = OFFICE_BRAND[ctx.office];
  const text =
    `Hi ${ctx.first_name},\n\n` +
    `Thank you for your interest in our pool maintenance service. Here's your quote:\n\n` +
    `${summaryText(ctx)}\n\n` +
    `Ready to get started? Reply to this email or call us at ${brand.phone}.\n\n` +
    `${brand.name}\n${brand.phone}`;
  return {
    subject: `Your Pool Maintenance Quote — ${brand.name}`,
    body_text: text,
    body_html: textToHtml(text),
  };
}

export interface RenderedSms {
  body: string;
}

export function renderQuoteSms(ctx: QuoteContext): RenderedSms {
  const brand = OFFICE_BRAND[ctx.office];
  return {
    body:
      `Hi ${ctx.first_name}! Your pool maintenance quote from ${brand.name}: ` +
      `${frequencyLabel(ctx.visits_per_week)} ${ctx.primary_body_type}: ` +
      `$${ctx.per_visit}/visit (deposit: $${ctx.first_months_deposit}). ` +
      `Ready to start? Reply YES or call ${brand.phone}`,
  };
}

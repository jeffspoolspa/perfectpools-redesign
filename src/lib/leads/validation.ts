// Validators for the new two-phase website lead flow.
//
// Phase 1 — POST /api/leads/start:
//   contact + address only. Write-ahead the lead with type=NULL.
//
// Phase 2 — POST /api/leads/qualify:
//   identity proven by HttpOnly cookie holding the resume token.
//   Discriminated by `type`. Residential needs bodies + condition + frequency.
//   Commercial needs company info + property manager.
//
// Hand-rolled (no Zod) to honour the "minimal dependencies" rule in CLAUDE.md.
// Same shape as the existing website-lead-intake edge function:
//   { ok: true; value: T } | { ok: false; error: string }

import { ALLOWED_BODY_TYPES, ALLOWED_CONDITIONS, ALLOWED_VISITS_PER_WEEK } from "./constants";
import { cleanString, isEmail, normalizePhone, normalizeZip } from "./normalize";
import type {
  AccountType,
  BodyType,
  ChlorinationSystem,
  FilterType,
  LeadType,
  PoolCondition,
  VegetationLevel,
  VisitsPerWeek,
} from "./types";

// ─── Result helper ─────────────────────────────────────────────────────────

export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function ok<T>(value: T): ValidateResult<T> {
  return { ok: true, value };
}
function err(error: string): ValidateResult<never> {
  return { ok: false, error };
}

// ─── Phase 1: start ────────────────────────────────────────────────────────

export interface StartLeadContact {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export interface StartLeadAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface StartLeadClient {
  user_agent?: string;
  referrer?: string;
  utm?: Record<string, string>;
}

export interface StartLeadInput {
  contact: StartLeadContact;
  address: StartLeadAddress;
  referral_source?: string;
  // Telemetry the endpoint captures from the request itself (IP, etc.) lives
  // on the server side; this is the JS-visible portion.
  client?: StartLeadClient;
}

export function validateStartLead(input: unknown): ValidateResult<StartLeadInput> {
  if (!input || typeof input !== "object") {
    return err("Invalid payload");
  }
  const p = input as Record<string, unknown>;

  // Contact
  const c = p.contact as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return err("Missing contact");
  const first_name = cleanString(c.first_name as string | undefined);
  const last_name = cleanString(c.last_name as string | undefined);
  if (!first_name || !last_name) return err("first_name and last_name required");

  const email = cleanString(c.email as string | undefined);
  if (email && !isEmail(email)) return err("Invalid email");

  const phone = normalizePhone(c.phone as string | undefined);
  if (c.phone && !phone) return err("Invalid phone number");

  if (!email && !phone) return err("Email or phone required");

  // Address
  const a = p.address as Record<string, unknown> | undefined;
  if (!a || typeof a !== "object") return err("Missing address");
  const street = cleanString(a.street as string | undefined);
  const city = cleanString(a.city as string | undefined);
  const zip = normalizeZip(a.zip as string | undefined);
  if (!street || !city || !zip) return err("Incomplete address");
  if (!/^\d{5}$/.test(zip)) return err("Invalid zip");
  const state = cleanString(a.state as string | undefined) ?? "GA";

  const referral_source = cleanString(p.referral_source as string | undefined);
  const client = parseStartClient(p.client);

  return ok({
    contact: { first_name, last_name, email, phone },
    address: { street, city, state, zip },
    referral_source,
    client,
  });
}

function parseStartClient(input: unknown): StartLeadClient | undefined {
  if (!input || typeof input !== "object") return undefined;
  const c = input as Record<string, unknown>;
  const user_agent = cleanString(c.user_agent as string | undefined);
  const referrer = cleanString(c.referrer as string | undefined);
  const utm = parseUtm(c.utm);
  if (!user_agent && !referrer && !utm) return undefined;
  return { user_agent, referrer, utm };
}

function parseUtm(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0 && v.length < 200) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Phase 2: qualify ──────────────────────────────────────────────────────

export interface BodyInput {
  body_type: BodyType;
  is_primary: boolean;
  is_short_term_rental?: boolean;
  is_inground?: boolean;
  is_screened_in?: boolean;
  chlorination_system?: ChlorinationSystem;
  filter_type?: FilterType;
  vegetation_level?: VegetationLevel;
  has_auto_cleaner?: boolean;
  has_dogs?: boolean;
  pool_volume?: number;
  access_instructions?: string;
  special_instructions?: string;
}

export interface QualifyResidentialInput {
  type: "residential_maintenance";
  bodies: BodyInput[];
  visits_per_week: VisitsPerWeek;
  pool_condition: PoolCondition;
  issue_description?: string;
  contact_preference?: string;
  lead_context?: string;
}

export interface QualifyCommercialInput {
  type: "commercial_maintenance";
  company_name: string;
  closes_for_winter?: boolean;
  summer_frequency?: number;
  winter_frequency?: number;
  property_manager_name?: string;
  property_manager_phone?: string;
  property_manager_email?: string;
  commercial_description?: string;
}

export interface QualifyServiceRequestInput {
  type: "service_request";
  issue_description: string;
  pool_condition?: PoolCondition;
}

export type QualifyLeadInput =
  | QualifyResidentialInput
  | QualifyCommercialInput
  | QualifyServiceRequestInput;

export function validateQualifyLead(input: unknown): ValidateResult<QualifyLeadInput> {
  if (!input || typeof input !== "object") return err("Invalid payload");
  const p = input as Record<string, unknown>;
  const type = p.type as LeadType | undefined;
  if (type !== "residential_maintenance" && type !== "commercial_maintenance" && type !== "service_request") {
    return err("Invalid type");
  }
  switch (type) {
    case "residential_maintenance":
      return validateResidential(p);
    case "commercial_maintenance":
      return validateCommercial(p);
    case "service_request":
      return validateServiceRequest(p);
  }
}

function validateResidential(p: Record<string, unknown>): ValidateResult<QualifyResidentialInput> {
  const bodiesRaw = p.bodies;
  if (!Array.isArray(bodiesRaw) || bodiesRaw.length === 0) {
    return err("At least one service body required");
  }

  let primaryCount = 0;
  const bodies: BodyInput[] = [];
  for (const raw of bodiesRaw) {
    if (!raw || typeof raw !== "object") return err("Invalid body");
    const b = raw as Record<string, unknown>;
    const body_type = b.body_type as BodyType;
    if (!ALLOWED_BODY_TYPES.has(body_type)) return err(`Invalid body_type: ${body_type}`);
    const is_primary = !!b.is_primary;
    if (is_primary) primaryCount++;
    bodies.push({
      body_type,
      is_primary,
      is_short_term_rental: optBool(b.is_short_term_rental),
      is_inground: optBool(b.is_inground),
      is_screened_in: optBool(b.is_screened_in),
      chlorination_system: optChlorination(b.chlorination_system),
      filter_type: optFilter(b.filter_type),
      vegetation_level: optVegetation(b.vegetation_level),
      has_auto_cleaner: optBool(b.has_auto_cleaner),
      has_dogs: optBool(b.has_dogs),
      pool_volume: optNumber(b.pool_volume),
      access_instructions: cleanString(b.access_instructions as string | undefined),
      special_instructions: cleanString(b.special_instructions as string | undefined),
    });
  }
  if (primaryCount !== 1) return err("Exactly one body must be is_primary");

  // Above-ground pool disqualification.
  const hasAboveGroundPool = bodies.some(
    (b) => b.body_type === "pool" && b.is_inground === false,
  );
  if (hasAboveGroundPool) return err("Above-ground pools are not serviced");

  const vpwRaw = Number(p.visits_per_week);
  if (!ALLOWED_VISITS_PER_WEEK.has(vpwRaw as VisitsPerWeek)) {
    return err("visits_per_week must be 0.5, 1, or 2");
  }
  const visits_per_week = vpwRaw as VisitsPerWeek;

  // STR forces ≥2 visits/week.
  const hasSTR = bodies.some((b) => b.is_short_term_rental === true);
  if (hasSTR && visits_per_week < 2) {
    return err("Short-term rentals require visits_per_week >= 2");
  }

  const pool_condition = p.pool_condition as PoolCondition;
  if (!ALLOWED_CONDITIONS.has(pool_condition)) {
    return err(`Invalid pool_condition: ${pool_condition}`);
  }
  const issue_description = cleanString(p.issue_description as string | undefined);
  if ((pool_condition === "needs_repair" || pool_condition === "green_pool") && !issue_description) {
    return err("issue_description required when pool_condition is not good");
  }

  return ok({
    type: "residential_maintenance",
    bodies,
    visits_per_week,
    pool_condition,
    issue_description,
    contact_preference: cleanString(p.contact_preference as string | undefined),
    lead_context: cleanString(p.lead_context as string | undefined),
  });
}

function validateCommercial(p: Record<string, unknown>): ValidateResult<QualifyCommercialInput> {
  const company_name = cleanString(p.company_name as string | undefined);
  if (!company_name) return err("company_name required for commercial leads");

  const pm_phone = normalizePhone(p.property_manager_phone as string | undefined);
  if (p.property_manager_phone && !pm_phone) return err("Invalid property_manager_phone");
  const pm_email = cleanString(p.property_manager_email as string | undefined);
  if (pm_email && !isEmail(pm_email)) return err("Invalid property_manager_email");

  return ok({
    type: "commercial_maintenance",
    company_name,
    closes_for_winter: optBool(p.closes_for_winter),
    summer_frequency: optNumber(p.summer_frequency),
    winter_frequency: optNumber(p.winter_frequency),
    property_manager_name: cleanString(p.property_manager_name as string | undefined),
    property_manager_phone: pm_phone,
    property_manager_email: pm_email,
    commercial_description: cleanString(p.commercial_description as string | undefined),
  });
}

function validateServiceRequest(p: Record<string, unknown>): ValidateResult<QualifyServiceRequestInput> {
  const issue_description = cleanString(p.issue_description as string | undefined);
  if (!issue_description) return err("issue_description required for service requests");
  const pool_condition = p.pool_condition as PoolCondition | undefined;
  if (pool_condition !== undefined && !ALLOWED_CONDITIONS.has(pool_condition)) {
    return err(`Invalid pool_condition: ${pool_condition}`);
  }
  return ok({
    type: "service_request",
    issue_description,
    pool_condition,
  });
}

// ─── Tiny type-narrowing helpers ───────────────────────────────────────────

function optBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  return !!v;
}
function optNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function optChlorination(v: unknown): ChlorinationSystem | undefined {
  if (v === "tablet" || v === "salt" || v === "liquid" || v === "other") return v;
  return undefined;
}
function optFilter(v: unknown): FilterType | undefined {
  if (v === "cartridge" || v === "sand" || v === "DE") return v;
  return undefined;
}
function optVegetation(v: unknown): VegetationLevel | undefined {
  if (v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

// Re-exported for callers that want to assert account_type at the API edge.
export function validateAccountType(v: unknown): AccountType {
  return v === "commercial" ? "commercial" : "residential";
}

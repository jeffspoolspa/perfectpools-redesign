// Domain types for the leads module.
// Source of truth: CHECK constraints on public.leads, maintenance.service_bodies,
// maintenance.residential_lead_details, public.Customers (account_type).
// Keep these in sync if you migrate the DB.

export type LeadStatus =
  | "new"
  | "quoted"
  | "accepted"
  | "converted"
  | "expired"
  | "declined"
  | "disqualified";

export type LeadSource =
  | "website"
  | "phone"
  | "referral"
  | "internal"
  | "google"
  | "nextdoor"
  | "social_media";

export type LeadType =
  | "residential_maintenance"
  | "commercial_maintenance"
  | "service_request";

export type Office = "richmond_hill" | "brunswick" | "st_marys";

export type QuoteChannel = "email" | "sms";

export type AccountType = "residential" | "commercial";

export type BodyType = "pool" | "spa" | "fountain";

export type PoolCondition = "good" | "needs_repair" | "green_pool";

export type ChlorinationSystem = "tablet" | "salt" | "liquid" | "other";

export type FilterType = "cartridge" | "sand" | "DE";

export type VegetationLevel = "low" | "medium" | "high";

export type VisitsPerWeek = 0.5 | 1 | 2;

export type ContractStatus = "not_started" | "sent" | "signed";

export type OnboardingStatus =
  | "pending_payment"
  | "payment_on_file"
  | "pending_routing"
  | "route_assigned"
  | "complete";

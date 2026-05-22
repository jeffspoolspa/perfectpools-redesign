/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  apiSubmitLead,
  apiCalculateQuote,
  apiCheckOrCreateCustomer,
  apiCreateLead,
  apiAcceptLead,
  apiSendQuote,
  getUtmParams,
  setTurnstileToken,
  getTurnstileToken,
} from "./client";

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function mockFetch(
  resolver: (url: string, init?: RequestInit) => { status?: number; body: unknown },
): FetchMock {
  const m = vi.fn(async (url: string, init?: RequestInit) => {
    const { status = 200, body } = resolver(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as FetchMock;
  globalThis.fetch = m;
  return m;
}

beforeEach(() => {
  setTurnstileToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiCalculateQuote", () => {
  it("POSTs to /api/quote/calculate and unwraps data", async () => {
    const m = mockFetch((url) => {
      expect(url).toBe("/api/quote/calculate");
      return {
        body: {
          ok: true,
          data: { in_service_area: true, office: "richmond_hill", per_visit: 60, monthly: 240 },
        },
      };
    });
    const r = await apiCalculateQuote({
      address: { street: "1 X", city: "Y", state: "GA", zip: "31324" },
      qualifying: { body_type: "pool_spa_combo", additional_body_count: 0, visits_per_week: 1 },
    });
    expect(m).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({
      ok: true,
      status: 200,
      data: { office: "richmond_hill", per_visit: 60 },
    });
  });

  it("returns ok:false on network error", async () => {
    globalThis.fetch = (() => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await apiCalculateQuote({
      address: { street: "1 X", city: "Y", state: "GA", zip: "31324" },
      qualifying: { body_type: "pool", additional_body_count: 0, visits_per_week: 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/network down|network_error/);
  });
});

describe("apiCheckOrCreateCustomer", () => {
  it("includes turnstile_token on first call (no customer_action)", async () => {
    setTurnstileToken("tok-abc");
    let capturedBody: any;
    mockFetch((url, init) => {
      capturedBody = JSON.parse(init!.body as string);
      return { body: { ok: true, data: { customer_id: 42, returning: false, customer_token: "ctok" } } };
    });
    await apiCheckOrCreateCustomer({
      contact: { first_name: "A", last_name: "B", email: "a@b.invalid" },
      address: { street: "1", city: "C", state: "GA", zip: "31324" },
      account_type: "residential",
    });
    expect(capturedBody.turnstile_token).toBe("tok-abc");
  });

  it("OMITS turnstile_token on dedup-resolve re-call (with customer_action)", async () => {
    setTurnstileToken("tok-abc");
    let capturedBody: any;
    mockFetch((url, init) => {
      capturedBody = JSON.parse(init!.body as string);
      return { body: { ok: true, data: { customer_id: 42, returning: true, customer_token: "ctok" } } };
    });
    await apiCheckOrCreateCustomer({
      contact: { first_name: "A", last_name: "B", email: "a@b.invalid" },
      address: { street: "1", city: "C", state: "GA", zip: "31324" },
      account_type: "residential",
      customer_action: "use_existing",
      existing_customer_id: 42,
    });
    expect(capturedBody.turnstile_token).toBeUndefined();
  });

  it("surfaces dedup_required + matches when present", async () => {
    mockFetch(() => ({
      body: {
        ok: false,
        dedup_required: true,
        matches: [{ customer_id: 1, display_name: "Carter G." }],
      },
    }));
    const r = await apiCheckOrCreateCustomer({
      contact: { first_name: "A", last_name: "B", email: "a@b.invalid" },
      address: { street: "1", city: "C", state: "GA", zip: "31324" },
      account_type: "residential",
    });
    expect(r.ok).toBe(false);
    expect(r.dedup_required).toBe(true);
    expect(r.matches?.[0]?.customer_id).toBe(1);
  });
});

describe("apiCreateLead", () => {
  it("POSTs customer_token alongside customer_id", async () => {
    let capturedBody: any;
    mockFetch((url, init) => {
      expect(url).toBe("/api/leads/create");
      capturedBody = JSON.parse(init!.body as string);
      return {
        body: {
          ok: true,
          data: {
            lead_id: "L-1",
            resume_token: "R-1",
            lifecycle_state: "open",
            closed_reason: null,
            child_status: "new",
            office: "richmond_hill",
          },
        },
      };
    });
    const r = await apiCreateLead({
      customer_id: 42,
      customer_token: "ctok",
      type: "residential_maintenance",
      office: "richmond_hill",
      qualifying: { visits_per_week: 1 },
    });
    expect(capturedBody.customer_id).toBe(42);
    expect(capturedBody.customer_token).toBe("ctok");
    expect(r.ok).toBe(true);
    expect(r.data?.lead_id).toBe("L-1");
  });
});

describe("apiAcceptLead / apiSendQuote", () => {
  it("apiAcceptLead passes lead_id + resume_token in body", async () => {
    let capturedBody: any;
    mockFetch((url, init) => {
      expect(url).toBe("/api/leads/accept");
      capturedBody = JSON.parse(init!.body as string);
      return { body: { ok: true, data: { ok: true, lead_id: "L-1", status: "accepted" } } };
    });
    await apiAcceptLead("L-1", "R-tok");
    expect(capturedBody).toEqual({ lead_id: "L-1", resume_token: "R-tok" });
  });

  it("apiAcceptLead omits resume_token when null", async () => {
    let capturedBody: any;
    mockFetch((url, init) => {
      capturedBody = JSON.parse(init!.body as string);
      return { body: { ok: true, data: { ok: true, lead_id: "L-1", status: "accepted" } } };
    });
    await apiAcceptLead("L-1", null);
    expect(capturedBody.resume_token).toBeUndefined();
  });

  it("apiSendQuote includes channel + resume_token", async () => {
    let capturedBody: any;
    mockFetch((url, init) => {
      expect(url).toBe("/api/leads/send-quote");
      capturedBody = JSON.parse(init!.body as string);
      return { body: { ok: true, data: { communication_id: "C-1", channel: "email" } } };
    });
    await apiSendQuote("L-1", "email", "R-tok");
    expect(capturedBody).toEqual({ lead_id: "L-1", channel: "email", resume_token: "R-tok" });
  });
});

describe("apiSubmitLead (legacy)", () => {
  it("includes turnstile_token on first call, omits on dedup re-call", async () => {
    setTurnstileToken("tok-XYZ");
    const calls: any[] = [];
    mockFetch((url, init) => {
      calls.push({ url, body: JSON.parse(init!.body as string) });
      return {
        body: {
          ok: true,
          data: { lead_id: "L-1", account_id: 1, returning: false, office: "richmond_hill" },
        },
      };
    });
    await apiSubmitLead({
      contact: { first_name: "A", last_name: "B", phone: "5551234567" },
      address: { street: "1", city: "C", state: "GA", zip: "31324" },
      account_type: "residential",
      qualifying: {},
    });
    expect(calls[0].body.turnstile_token).toBe("tok-XYZ");

    await apiSubmitLead({
      contact: { first_name: "A", last_name: "B", phone: "5551234567" },
      address: { street: "1", city: "C", state: "GA", zip: "31324" },
      account_type: "residential",
      qualifying: {},
      customer_action: "create_new",
    });
    expect(calls[1].body.turnstile_token).toBeUndefined();
  });
});

describe("getUtmParams", () => {
  it("reads utm_* off window.location", () => {
    // jsdom defaults to localhost; replace via history pushState
    history.pushState({}, "", "/?utm_source=email&utm_campaign=spring&other=ignored");
    expect(getUtmParams()).toEqual({ utm_source: "email", utm_campaign: "spring" });
  });

  it("returns {} when no utm params", () => {
    history.pushState({}, "", "/?utm_other=foo");
    expect(getUtmParams()).toEqual({});
  });
});

describe("turnstile token storage", () => {
  it("get/set round-trip works", () => {
    setTurnstileToken("hello");
    expect(getTurnstileToken()).toBe("hello");
    setTurnstileToken(null);
    expect(getTurnstileToken()).toBeNull();
  });
});

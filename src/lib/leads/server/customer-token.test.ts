/* @vitest-environment node */
import { describe, it, expect, beforeEach } from "vitest";
import { issueCustomerToken, verifyCustomerToken } from "./customer-token";

const TEST_SECRET = "test-secret-".padEnd(64, "x");

beforeEach(() => {
  process.env.CUSTOMER_TOKEN_SECRET = TEST_SECRET;
});

describe("customer-token", () => {
  it("issues a token that verifies for the matching customer id", () => {
    const token = issueCustomerToken(12345);
    expect(verifyCustomerToken(token, 12345)).toEqual({ ok: true });
  });

  it("rejects a token verified against a different customer id", () => {
    const token = issueCustomerToken(12345);
    expect(verifyCustomerToken(token, 99999)).toEqual({
      ok: false,
      reason: "customer_id_mismatch",
    });
  });

  it("rejects an empty / non-string token", () => {
    // @ts-expect-error — runtime tolerance check
    expect(verifyCustomerToken(undefined, 1)).toEqual({ ok: false, reason: "malformed_token" });
    expect(verifyCustomerToken("", 1)).toEqual({ ok: false, reason: "malformed_token" });
    expect(verifyCustomerToken("nopdots", 1)).toEqual({ ok: false, reason: "malformed_token" });
  });

  it("rejects a token with only 2 parts (missing signature)", () => {
    expect(verifyCustomerToken("12345.1700000000", 12345)).toEqual({
      ok: false,
      reason: "malformed_token",
    });
  });

  it("rejects a token whose signature has been tampered with", () => {
    const valid = issueCustomerToken(7);
    // Flip the last char of the signature — corrupts it without changing length
    const tampered = valid.slice(0, -1) + (valid.slice(-1) === "a" ? "b" : "a");
    expect(verifyCustomerToken(tampered, 7)).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });

  it("rejects a token with a non-integer customer id", () => {
    expect(verifyCustomerToken("abc.1700000000.deadbeef", 1)).toEqual({
      ok: false,
      reason: "malformed_token",
    });
  });

  it("rejects a token whose customer id matches but exp is in the past", () => {
    // Hand-craft an expired token using the same algorithm
    const { createHmac } = require("node:crypto") as typeof import("node:crypto");
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const payload = `42.${pastExp}`;
    const sig = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    const expired = `${payload}.${sig}`;
    expect(verifyCustomerToken(expired, 42)).toEqual({ ok: false, reason: "expired" });
  });

  it("throws clearly when CUSTOMER_TOKEN_SECRET is missing", () => {
    delete process.env.CUSTOMER_TOKEN_SECRET;
    expect(() => issueCustomerToken(1)).toThrow(/CUSTOMER_TOKEN_SECRET/);
  });

  it("throws clearly when CUSTOMER_TOKEN_SECRET is too short", () => {
    process.env.CUSTOMER_TOKEN_SECRET = "too-short";
    expect(() => issueCustomerToken(1)).toThrow(/CUSTOMER_TOKEN_SECRET/);
  });
});

/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { normalizePhone, cleanString, isEmail, normalizeZip } from "./normalize";

describe("normalizePhone", () => {
  it("strips formatting, returns last 10 digits", () => {
    expect(normalizePhone("(912) 459-0160")).toBe("9124590160");
    expect(normalizePhone("912.459.0160")).toBe("9124590160");
    expect(normalizePhone("912-459-0160")).toBe("9124590160");
    expect(normalizePhone("912 459 0160")).toBe("9124590160");
  });

  it("trims country code by taking last 10 digits", () => {
    expect(normalizePhone("+1 912 459 0160")).toBe("9124590160");
    expect(normalizePhone("19124590160")).toBe("9124590160");
  });

  it("returns undefined for too-short inputs", () => {
    expect(normalizePhone("459-0160")).toBeUndefined();
    expect(normalizePhone("0160")).toBeUndefined();
    expect(normalizePhone("")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(normalizePhone(null)).toBeUndefined();
    expect(normalizePhone(undefined)).toBeUndefined();
  });
});

describe("cleanString", () => {
  it("trims leading/trailing whitespace", () => {
    expect(cleanString("  hello  ")).toBe("hello");
  });

  it("collapses internal whitespace runs", () => {
    expect(cleanString("hello    world")).toBe("hello world");
    expect(cleanString("hello\tworld\nfoo")).toBe("hello world foo");
  });

  it("returns undefined for blank/empty", () => {
    expect(cleanString("")).toBeUndefined();
    expect(cleanString("   ")).toBeUndefined();
    expect(cleanString(null)).toBeUndefined();
    expect(cleanString(undefined)).toBeUndefined();
  });
});

describe("isEmail", () => {
  it("accepts common email shapes", () => {
    expect(isEmail("carter@jeffspoolspa.com")).toBe(true);
    expect(isEmail("c+tag@example.co.uk")).toBe(true);
    expect(isEmail("a@b.cd")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isEmail("not-an-email")).toBe(false);
    expect(isEmail("missing@dot")).toBe(false);
    expect(isEmail("@no-local.com")).toBe(false);
    expect(isEmail("no-at.com")).toBe(false);
    expect(isEmail("has spaces@example.com")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("normalizeZip", () => {
  it("returns the first 5 characters", () => {
    expect(normalizeZip("31324")).toBe("31324");
    expect(normalizeZip("31324-1234")).toBe("31324");
  });

  it("trims whitespace before slicing", () => {
    expect(normalizeZip("  31324  ")).toBe("31324");
  });

  it("returns undefined for empty/null", () => {
    expect(normalizeZip("")).toBeUndefined();
    expect(normalizeZip(null)).toBeUndefined();
    expect(normalizeZip(undefined)).toBeUndefined();
  });
});

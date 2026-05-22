/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { checkServiceArea } from "./service-area";

describe("checkServiceArea", () => {
  it("maps known Brunswick zips to brunswick office", () => {
    expect(checkServiceArea("31520")).toEqual({ inArea: true, office: "brunswick" });
    expect(checkServiceArea("31525")).toEqual({ inArea: true, office: "brunswick" });
  });

  it("maps known Richmond Hill zips to richmond_hill office", () => {
    expect(checkServiceArea("31324")).toEqual({ inArea: true, office: "richmond_hill" });
    expect(checkServiceArea("31405")).toEqual({ inArea: true, office: "richmond_hill" });
  });

  it("maps known St. Marys zips to st_marys office", () => {
    expect(checkServiceArea("31547")).toEqual({ inArea: true, office: "st_marys" });
  });

  it("falls back to richmond_hill for any 31300-31599 coastal-GA zip", () => {
    // Unknown zip in the range — should fall through to the catch-all.
    expect(checkServiceArea("31399")).toEqual({ inArea: true, office: "richmond_hill" });
    expect(checkServiceArea("31599")).toEqual({ inArea: true, office: "richmond_hill" });
  });

  it("returns not-in-area for zips outside the range", () => {
    expect(checkServiceArea("30303")).toEqual({ inArea: false, office: null });
    expect(checkServiceArea("90210")).toEqual({ inArea: false, office: null });
    expect(checkServiceArea("31299")).toEqual({ inArea: false, office: null });
    expect(checkServiceArea("31600")).toEqual({ inArea: false, office: null });
  });

  it("handles empty/garbage input gracefully", () => {
    expect(checkServiceArea("")).toEqual({ inArea: false, office: null });
    // @ts-expect-error — testing runtime tolerance to null
    expect(checkServiceArea(null)).toEqual({ inArea: false, office: null });
    // @ts-expect-error — testing runtime tolerance to undefined
    expect(checkServiceArea(undefined)).toEqual({ inArea: false, office: null });
  });

  it("trims and truncates input to 5 chars before lookup", () => {
    // Common case: "31324-1234" (ZIP+4) should match 31324
    expect(checkServiceArea("31324-1234")).toEqual({ inArea: true, office: "richmond_hill" });
    expect(checkServiceArea(" 31324 ")).toEqual({ inArea: true, office: "richmond_hill" });
  });

  it("prioritizes Brunswick over St. Marys for shared zips (31548, 31558)", () => {
    // Behavioral note from the source: Brunswick wins on overlap because we
    // check Brunswick first. If ops wants St. Marys to own these, the source
    // needs reordering.
    expect(checkServiceArea("31548")).toEqual({ inArea: true, office: "brunswick" });
    expect(checkServiceArea("31558")).toEqual({ inArea: true, office: "brunswick" });
  });
});

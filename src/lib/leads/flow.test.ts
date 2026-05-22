/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  MAINTENANCE_FLOW,
  MAINTENANCE_FLOW_STEPS,
  getStepAt,
  getStepPosition,
} from "./flow";

describe("MAINTENANCE_FLOW", () => {
  it("has the expected step ids in the current order", () => {
    expect(MAINTENANCE_FLOW.map((s) => s.id)).toEqual([
      "address",
      "contact",
      "qualifier",
      "referral",
      "quote",
    ]);
  });

  it("every step has a non-empty label", () => {
    for (const step of MAINTENANCE_FLOW) {
      expect(step.label).toBeTruthy();
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it("MAINTENANCE_FLOW_STEPS matches the array length", () => {
    expect(MAINTENANCE_FLOW_STEPS).toBe(MAINTENANCE_FLOW.length);
  });
});

describe("getStepAt", () => {
  it("returns the step at a valid 1-indexed position", () => {
    expect(getStepAt(1)?.id).toBe("address");
    expect(getStepAt(2)?.id).toBe("contact");
    expect(getStepAt(MAINTENANCE_FLOW_STEPS)?.id).toBe("quote");
  });

  it("returns null for out-of-range positions", () => {
    expect(getStepAt(0)).toBeNull();
    expect(getStepAt(-1)).toBeNull();
    expect(getStepAt(MAINTENANCE_FLOW_STEPS + 1)).toBeNull();
    expect(getStepAt(99)).toBeNull();
  });

  it("returns null for non-integer inputs", () => {
    expect(getStepAt(1.5)).toBeNull();
    expect(getStepAt(NaN)).toBeNull();
    // @ts-expect-error runtime tolerance
    expect(getStepAt("1")).toBeNull();
  });
});

describe("getStepPosition", () => {
  it("returns 1-indexed position of known ids", () => {
    expect(getStepPosition("address")).toBe(1);
    expect(getStepPosition("contact")).toBe(2);
    expect(getStepPosition("qualifier")).toBe(3);
    expect(getStepPosition("referral")).toBe(4);
    expect(getStepPosition("quote")).toBe(5);
  });

  it("returns -1 for unknown ids", () => {
    // @ts-expect-error testing runtime tolerance
    expect(getStepPosition("nope")).toBe(-1);
  });
});

describe("round-trip", () => {
  it("getStepAt(getStepPosition(id)) returns the same step", () => {
    for (const step of MAINTENANCE_FLOW) {
      expect(getStepAt(getStepPosition(step.id))?.id).toBe(step.id);
    }
  });
});

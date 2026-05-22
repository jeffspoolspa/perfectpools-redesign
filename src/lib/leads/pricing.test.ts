/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { calculateQuote, BASE_PRICES, ADDITIONAL_BODY_SURCHARGE } from "./pricing";

describe("calculateQuote", () => {
  it("returns the base price for a single pool, 1 visit/week", () => {
    expect(calculateQuote({ primaryBodyType: "pool", additionalBodyCount: 0, visitsPerWeek: 1 })).toEqual({
      perVisit: 50,
      visitsPerMonth: 4,
      firstMonthsDeposit: 200,
    });
  });

  it("returns the base price for a single spa, 1 visit/week", () => {
    expect(calculateQuote({ primaryBodyType: "spa", additionalBodyCount: 0, visitsPerWeek: 1 })).toEqual({
      perVisit: 45,
      visitsPerMonth: 4,
      firstMonthsDeposit: 180,
    });
  });

  it("adds surcharge for each additional body (pool + spa = combo)", () => {
    // pool + 1 additional body = $50 base + $10 surcharge = $60/visit
    // Matches the form's pool_spa_combo price exactly.
    const q = calculateQuote({ primaryBodyType: "pool", additionalBodyCount: 1, visitsPerWeek: 1 });
    expect(q.perVisit).toBe(60);
    expect(q.firstMonthsDeposit).toBe(240);
  });

  it("scales monthly with visits_per_week", () => {
    const weekly = calculateQuote({ primaryBodyType: "pool", additionalBodyCount: 0, visitsPerWeek: 1 });
    const biweekly = calculateQuote({ primaryBodyType: "pool", additionalBodyCount: 0, visitsPerWeek: 0.5 });
    const twiceWeekly = calculateQuote({ primaryBodyType: "pool", additionalBodyCount: 0, visitsPerWeek: 2 });
    expect(weekly.visitsPerMonth).toBe(4);
    expect(biweekly.visitsPerMonth).toBe(2);
    expect(twiceWeekly.visitsPerMonth).toBe(8);
    expect(biweekly.firstMonthsDeposit).toBe(100);
    expect(twiceWeekly.firstMonthsDeposit).toBe(400);
  });

  it("treats negative additionalBodyCount as zero (defensive)", () => {
    const q = calculateQuote({ primaryBodyType: "pool", additionalBodyCount: -3, visitsPerWeek: 1 });
    expect(q.perVisit).toBe(50);
  });

  it("constants match the form's quoted prices", () => {
    expect(BASE_PRICES.pool).toBe(50);
    expect(BASE_PRICES.spa).toBe(45);
    expect(ADDITIONAL_BODY_SURCHARGE).toBe(10);
  });
});

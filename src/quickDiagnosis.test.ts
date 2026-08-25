import { describe, expect, it } from "vitest";
import {
  EBITDA_MULTIPLE,
  calculateQuickDiagnosis,
  calculateTwoPeriodCagr,
  type DiagnosisFinancials,
} from "./quickDiagnosis";

const financials: DiagnosisFinancials = {
  twoYearsAgo: {
    revenue: 10_000,
    operatingProfit: 1_000,
    netIncome: 500,
    cash: 2_000,
    depreciation: 200,
  },
  previousYear: {
    revenue: 15_000,
    operatingProfit: 1_500,
    netIncome: 750,
    cash: 2_500,
    depreciation: 250,
  },
  latestYear: {
    revenue: 20_000,
    operatingProfit: 2_000,
    netIncome: 1_000,
    cash: 3_000,
    depreciation: 300,
  },
};

describe("calculateTwoPeriodCagr", () => {
  it("calculates CAGR from three fiscal years (two periods)", () => {
    expect(calculateTwoPeriodCagr(10_000, 12_100)).toBeCloseTo(0.1);
  });

  it("allows a shrinking trend", () => {
    expect(calculateTwoPeriodCagr(10_000, 8_100)).toBeCloseTo(-0.1);
  });

  it("does not fabricate CAGR when the formula is undefined", () => {
    expect(calculateTwoPeriodCagr(0, 1_000)).toBeNull();
    expect(calculateTwoPeriodCagr(-500, 1_000)).toBeNull();
    expect(calculateTwoPeriodCagr(500, -1_000)).toBeNull();
  });
});

describe("calculateQuickDiagnosis", () => {
  it("extends the CAGR to 5 and 10 years", () => {
    const result = calculateQuickDiagnosis(financials);

    expect(result.growthRates.revenue).toBeCloseTo(Math.sqrt(2) - 1);
    expect(result.projections[3].revenue).toBeCloseTo(
      20_000 * Math.sqrt(2) ** 5,
    );
    expect(result.projections[4].revenue).toBeCloseTo(640_000);
  });

  it("uses cash plus EBITDA times the fixed three-times multiple", () => {
    const result = calculateQuickDiagnosis(financials);

    expect(EBITDA_MULTIPLE).toBe(3);
    expect(result.currentEbitda).toBe(2_300);
    expect(result.companyValues[0].value).toBe(3_000 + 2_300 * 3);
  });

  it("returns a caution message for a flat trend", () => {
    const flat = structuredClone(financials);
    flat.twoYearsAgo.revenue = flat.latestYear.revenue;
    flat.twoYearsAgo.operatingProfit = flat.latestYear.operatingProfit;

    expect(calculateQuickDiagnosis(flat).message).toContain("このままの延長線");
  });
});

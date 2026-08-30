import { describe, expect, it } from "vitest";
import {
  EBITDA_MULTIPLE,
  MONTE_CARLO_RUNS,
  calculateQuickDiagnosis,
  calculateTwoPeriodCagr,
  simulateQuickDiagnosis,
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
  it("uses Monte Carlo medians for the 5-year and 10-year forecast", () => {
    const result = calculateQuickDiagnosis(financials);

    expect(result.growthRates.revenue).toBeCloseTo(Math.sqrt(2) - 1);
    expect(result.simulation.runs).toBe(MONTE_CARLO_RUNS);
    expect(result.projections[3].revenue).toBe(
      result.simulation.year5.revenue.p50,
    );
    expect(result.projections[4].revenue).toBe(
      result.simulation.year10.revenue.p50,
    );
    expect(result.projections[4].revenue).not.toBeCloseTo(640_000);
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

    expect(calculateQuickDiagnosis(flat).message).toMatch(/10,000通り|10年後/);
  });
});

describe("simulateQuickDiagnosis", () => {
  it("is reproducible for auditability", () => {
    expect(simulateQuickDiagnosis(financials, 1_000)).toEqual(
      simulateQuickDiagnosis(financials, 1_000),
    );
  });

  it("returns ordered uncertainty ranges and valid probabilities", () => {
    const simulation = simulateQuickDiagnosis(financials, 2_000);

    for (const horizon of [simulation.year5, simulation.year10]) {
      for (const metric of Object.values(horizon)) {
        expect(metric.p10).toBeLessThanOrEqual(metric.p50);
        expect(metric.p50).toBeLessThanOrEqual(metric.p90);
      }
    }
    expect(simulation.probabilityCompanyValueDeclines).toBeGreaterThanOrEqual(0);
    expect(simulation.probabilityCompanyValueDeclines).toBeLessThanOrEqual(1);
    expect(simulation.probabilityOperatingLoss).toBeGreaterThanOrEqual(0);
    expect(simulation.probabilityOperatingLoss).toBeLessThanOrEqual(1);
    expect(simulation.year10.companyValue.p90).toBeGreaterThan(
      simulation.year10.companyValue.p10,
    );
  });
});

import { describe, expect, it } from "vitest";
import { defaultScenarios, sampleBaseline, sampleProfile } from "../data/sample";
import { goalSeek, runSensitivity } from "./analysis";
import {
  calculateDebt,
  calculatePersonnel,
  calculateRevenue,
  calculateWorkingCapital,
  cloneScenario,
  forecastScenario,
} from "./engine";

describe("deterministic finance engine", () => {
  const asIs = defaultScenarios[0];

  it("calculates revenue growth from volume, price, new and lost revenue", () => {
    const revenue = calculateRevenue(1_000_000, {
      volumeGrowth: 0.05,
      priceGrowth: 0.03,
      newBusinessRevenue: 25_000,
      lostRevenue: 10_000,
    });
    expect(revenue).toBe(1_096_500);
  });

  it("rolls forward FTE and personnel cost", () => {
    const result = calculatePersonnel(100, 5_000_000, {
      hires: 10,
      exits: 4,
      salaryGrowth: 0.02,
      benefitsRate: 0.15,
    });
    expect(result.endingFte).toBe(106);
    expect(result.averageSalary).toBe(5_100_000);
    expect(result.personnelCost).toBe(604_095_000);
  });

  it("calculates DSO, DIO and DPO working capital", () => {
    const result = calculateWorkingCapital(3_650_000_000, 1_825_000_000, {
      dso: 60,
      dio: 80,
      dpo: 45,
    });
    expect(result.accountsReceivable).toBe(600_000_000);
    expect(result.inventory).toBe(400_000_000);
    expect(result.accountsPayable).toBe(225_000_000);
    expect(result.netWorkingCapital).toBe(775_000_000);
  });

  it("rolls debt and calculates interest on average debt", () => {
    const result = calculateDebt(1_000_000_000, {
      newBorrowing: 200_000_000,
      debtRepayment: 100_000_000,
      borrowingRate: 0.02,
    });
    expect(result.endingDebt).toBe(1_100_000_000);
    expect(result.interestExpense).toBe(21_000_000);
  });

  it("produces ten linked, balanced forecast years", () => {
    const result = forecastScenario(
      sampleBaseline,
      asIs,
      sampleProfile.baseYear,
      10,
    );
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].year).toBe(2027);
    expect(result.rows[9].year).toBe(2036);
    expect(result.kpis.balanceValid).toBe(true);
    result.rows.forEach((row, index) => {
      expect(Math.abs(row.balanceDifference)).toBeLessThanOrEqual(1);
      const previousCash = index === 0 ? sampleBaseline.cash : result.rows[index - 1].endingCash;
      expect(row.endingCash).toBeCloseTo(
        previousCash + row.cfo + row.cfi + row.cff,
        4,
      );
    });
  });

  it("rolls capex into PPE and depreciation", () => {
    const result = forecastScenario(
      sampleBaseline,
      asIs,
      sampleProfile.baseYear,
      3,
    );
    const first = result.rows[0];
    expect(first.netPpe).toBeCloseTo(
      sampleBaseline.netPpe + first.capex - first.depreciation,
      4,
    );
    expect(result.rows[1].depreciation).toBeGreaterThan(first.depreciation);
  });

  it("clones a scenario without sharing mutable driver objects", () => {
    const clone = cloneScenario(asIs, "As-Is copy");
    clone.drivers.priceGrowth = 0.05;
    expect(clone.name).toBe("As-Is copy");
    expect(asIs.drivers.priceGrowth).not.toBe(0.05);
    expect(clone.meta.status).toBe("draft");
  });

  it("returns deterministic sensitivity impacts", () => {
    const first = runSensitivity(sampleBaseline, asIs, sampleProfile.baseYear, 5);
    const second = runSensitivity(sampleBaseline, asIs, sampleProfile.baseYear, 5);
    expect(first).toEqual(second);
    expect(first).toHaveLength(7);
    expect(first.find((item) => item.label === "価格上昇率")!.ebitdaImpact).toBeGreaterThan(0);
  });

  it("finds feasible goal-seek combinations within constraints", () => {
    const solutions = goalSeek(sampleBaseline, asIs, sampleProfile.baseYear, {
      year5Revenue: 6_500_000_000,
      ebitdaMargin: 0.1,
      minimumCash: 100_000_000,
    });
    expect(solutions.length).toBeGreaterThan(0);
    solutions.forEach((solution) => {
      expect(solution.priceGrowth).toBeLessThanOrEqual(0.05);
      expect(solution.year5Revenue).toBeGreaterThanOrEqual(6_500_000_000);
      expect(solution.ebitdaMargin).toBeGreaterThanOrEqual(0.1);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultIndiaInputs,
  defaultScenarios,
  sampleBaseline,
  sampleProfile,
} from "../data/sample";
import {
  assessBusinessRisk,
  assessIndia,
  deriveStrategyActions,
  runSensitivity,
} from "./analysis";
import { forecastScenario } from "./engine";

describe("strategy analysis", () => {
  it("maps financial gaps to prioritized operating actions", () => {
    const asIs = forecastScenario(
      sampleBaseline,
      defaultScenarios[0],
      sampleProfile.baseYear,
      10,
    );
    const target = forecastScenario(
      sampleBaseline,
      defaultScenarios[4],
      sampleProfile.baseYear,
      10,
    );
    const actions = deriveStrategyActions(asIs, target);
    expect(actions.length).toBeGreaterThanOrEqual(3);
    expect(actions.some((action) => action.category === "収益性")).toBe(true);
    expect(actions.some((action) => action.title.includes("インド"))).toBe(true);
  });

  it("forces Conditional Go when a critical India gate is missing", () => {
    const assessment = assessIndia(defaultIndiaInputs, sampleProfile.baseYear);
    expect(assessment.verdict).toBe("Conditional Go");
    expect(assessment.reasons).toContain("現地責任者が未確定");
    expect(assessment.rows).toHaveLength(10);
  });

  it("allows Go only after critical India gates are satisfied", () => {
    const assessment = assessIndia(
      {
        ...defaultIndiaInputs,
        hasCountryManager: true,
        hasAnchorCustomer: true,
        regulatoryBlocker: false,
        year3Revenue: 800_000_000,
      },
      sampleProfile.baseYear,
    );
    expect(assessment.verdict).toBe("Go");
    expect(assessment.operatingBreakEvenYear).not.toBeNull();
  });

  it("shows cash deterioration when collection days increase", () => {
    const rows = runSensitivity(
      sampleBaseline,
      defaultScenarios[0],
      sampleProfile.baseYear,
      5,
    );
    const dso = rows.find((row) => row.label === "回収サイト")!;
    expect(dso.minimumCashImpact).toBeLessThan(0);
  });

  it("ranks the three MVP risk indicators with explicit weights", () => {
    const result = forecastScenario(
      sampleBaseline,
      defaultScenarios[0],
      sampleProfile.baseYear,
      10,
    );
    const assessment = assessBusinessRisk(result, 7_000_000_000);
    expect(assessment.indicators.map((indicator) => indicator.id)).toEqual([
      "cash",
      "personnel",
      "growth",
    ]);
    expect(
      assessment.indicators.reduce(
        (sum, indicator) => sum + indicator.weight,
        0,
      ),
    ).toBe(1);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
  });

  it("flags a cash shortfall as high risk", () => {
    const result = forecastScenario(
      { ...sampleBaseline, cash: 10_000_000 },
      {
        ...defaultScenarios[0],
        drivers: {
          ...defaultScenarios[0].drivers,
          growthCapex: 1_000_000_000,
          newBorrowing: 0,
        },
      },
      sampleProfile.baseYear,
      5,
    );
    const assessment = assessBusinessRisk(result, 7_000_000_000);
    expect(
      assessment.indicators.find((indicator) => indicator.id === "cash")?.level,
    ).toBe("high");
    expect(assessment.cashShortfallYear).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultIndiaInputs,
  defaultScenarios,
  sampleBaseline,
  sampleProfile,
} from "../data/sample";
import {
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
});

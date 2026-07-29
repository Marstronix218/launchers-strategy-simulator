import { createHash } from "node:crypto";
import { z } from "zod";
import { forecastScenario } from "../src/finance/engine";
import type { CompanyBaseline, CompanyProfile, Scenario } from "../src/types";
import {
  AuthError,
  authenticateRequest,
  requireProjectAccess,
} from "../server/auth";
import type { VercelRequest, VercelResponse } from "../server/types";

const ProfileSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(200),
  baseYear: z.number().int().min(1900).max(2200),
  horizon: z.union([z.literal(5), z.literal(10)]),
  currency: z.literal("JPY"),
  businessUnits: z.array(z.string().min(1).max(120)).max(10),
});

const BaselineSchema = z.object({
  revenue: z.number(),
  variableCogsRate: z.number(),
  fixedManufacturingCost: z.number(),
  fte: z.number(),
  averageSalary: z.number(),
  benefitsRate: z.number(),
  sga: z.number(),
  cash: z.number(),
  accountsReceivable: z.number(),
  inventory: z.number(),
  netPpe: z.number(),
  otherAssets: z.number(),
  accountsPayable: z.number(),
  debt: z.number(),
  otherLiabilities: z.number(),
  shareCapital: z.number(),
  retainedEarnings: z.number(),
  dso: z.number(),
  dio: z.number(),
  dpo: z.number(),
});

const DriverSchema = z.object({
  volumeGrowth: z.number(),
  priceGrowth: z.number(),
  newBusinessRevenue: z.number(),
  lostRevenue: z.number(),
  variableCogsRate: z.number(),
  costInflation: z.number(),
  productivityImprovement: z.number(),
  hires: z.number(),
  exits: z.number(),
  salaryGrowth: z.number(),
  benefitsRate: z.number(),
  sgaInflation: z.number(),
  maintenanceCapexRate: z.number(),
  growthCapex: z.number(),
  usefulLife: z.number(),
  dso: z.number(),
  dio: z.number(),
  dpo: z.number(),
  borrowingRate: z.number(),
  newBorrowing: z.number(),
  debtRepayment: z.number(),
  effectiveTaxRate: z.number(),
  dividends: z.number(),
});

const ScenarioSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  shortName: z.string().min(1).max(100),
  kind: z.enum(["as-is", "downside", "domestic", "india", "target"]),
  description: z.string().max(1000),
  color: z.string().max(32),
  drivers: DriverSchema,
  annualOverrides: z.record(z.string(), DriverSchema.partial()),
  meta: z.object({
    sourceName: z.string(),
    sourceDate: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    status: z.enum(["approved", "suggested", "draft"]),
    createdBy: z.string(),
    updatedAt: z.string(),
  }),
});

const RequestSchema = z.object({
  projectId: z.string().uuid(),
  profile: ProfileSchema,
  baseline: BaselineSchema,
  scenario: ScenarioSchema,
});

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const auth = await authenticateRequest(request);
    const input = RequestSchema.parse(request.body);
    const access = await requireProjectAccess(auth, input.projectId);
    const scenario = input.scenario as Scenario;
    const profile = input.profile as CompanyProfile;
    const baseline = input.baseline as CompanyBaseline;
    const result = forecastScenario(
      baseline,
      scenario,
      profile.baseYear,
      profile.horizon,
    );
    if (!result.kpis.balanceValid) {
      return response.status(422).json({
        error: "The forecast did not pass the balance-sheet validation.",
      });
    }

    const { data: scenarioRow, error: scenarioError } = await auth.admin
      .from("scenarios")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("external_id", scenario.id)
      .single();
    if (scenarioError || !scenarioRow) {
      return response.status(409).json({
        error: "Save the workspace before creating an authoritative forecast.",
      });
    }
    const serializedInput = JSON.stringify({
      baseline,
      scenario,
      baseYear: profile.baseYear,
      horizon: profile.horizon,
    });
    const inputHash = createHash("sha256")
      .update(serializedInput)
      .digest("hex");
    const values = result.rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key, value]) => key !== "year" && typeof value === "number")
        .map(([metric, value]) => ({
          fiscal_year: row.year,
          metric,
          value,
          unit:
            metric.includes("Margin") ||
            metric === "roic" ||
            metric === "dscr"
              ? "ratio"
              : "JPY",
          formula_key: `finance_engine.${metric}`,
        })),
    );
    const { data: runId, error: runError } = await auth.admin.rpc(
      "record_forecast_run",
      {
        p_organization_id: access.organizationId,
        p_project_id: input.projectId,
        p_scenario_id: scenarioRow.id,
        p_model_version: "finance-engine-0.2.0",
        p_input_hash: inputHash,
        p_inputs: JSON.parse(serializedInput),
        p_result: result,
        p_values: values,
        p_created_by: auth.user.id,
      },
    );
    if (runError || !runId) {
      throw runError ?? new Error("Forecast run transaction failed.");
    }

    return response.status(200).json({ runId, result });
  } catch (caught) {
    if (caught instanceof AuthError) {
      return response.status(caught.status).json({ error: caught.message });
    }
    if (caught instanceof z.ZodError) {
      return response.status(400).json({
        error: "Invalid forecast request.",
        issues: caught.issues,
      });
    }
    console.error("forecast endpoint failed", caught);
    return response.status(500).json({
      error: "Forecast could not be recorded. Check the server logs.",
    });
  }
}

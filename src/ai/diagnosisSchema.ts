import { z } from "zod";

const finiteFinancialNumber = z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000);
const growthRate = z.number().finite().min(-1).max(100).nullable();
const simulationRange = z.object({
  p10: finiteFinancialNumber,
  p50: finiteFinancialNumber,
  p90: finiteFinancialNumber,
});

export const DiagnosisInsightRequestSchema = z.object({
  industry: z.string().trim().max(100).optional().default(""),
  growthRates: z.object({
    revenue: growthRate,
    operatingProfit: growthRate,
    netIncome: growthRate,
  }),
  currentEbitda: finiteFinancialNumber,
  companyValues: z.object({
    current: finiteFinancialNumber,
    year5: finiteFinancialNumber,
    year10: finiteFinancialNumber,
  }),
  projections: z.object({
    latest: z.object({
      revenue: finiteFinancialNumber,
      operatingProfit: finiteFinancialNumber,
      netIncome: finiteFinancialNumber,
    }),
    year5: z.object({
      revenue: finiteFinancialNumber,
      operatingProfit: finiteFinancialNumber,
      netIncome: finiteFinancialNumber,
    }),
    year10: z.object({
      revenue: finiteFinancialNumber,
      operatingProfit: finiteFinancialNumber,
      netIncome: finiteFinancialNumber,
    }),
  }),
  simulation: z.object({
    runs: z.number().int().min(100).max(100_000),
    year5CompanyValue: simulationRange,
    year10CompanyValue: simulationRange,
    probabilityCompanyValueDeclines: z.number().min(0).max(1),
    probabilityOperatingLoss: z.number().min(0).max(1),
  }),
});

export const DiagnosisInsightSchema = z.object({
  headline: z.string().min(1).max(80).describe("日本語のみの簡潔な見出し"),
  analysis: z.string().min(1).max(450).describe("日本語のみの事実と提案"),
  focusPoints: z
    .array(z.string().min(8).max(90).describe("日本語のみの確認項目。番号は付けない"))
    .length(3),
  consultationQuestion: z.string().min(1).max(150).describe("日本語のみの具体的な質問"),
  disclaimer: z.string().min(1).max(180).describe("日本語のみの注意事項"),
});

export type DiagnosisInsightRequest = z.infer<typeof DiagnosisInsightRequestSchema>;
export type DiagnosisInsight = z.infer<typeof DiagnosisInsightSchema>;

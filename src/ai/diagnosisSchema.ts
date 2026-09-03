import { z } from "zod";

const finiteFinancialNumber = z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000);
const growthRate = z.number().finite().min(-1).max(100).nullable();
const simulationRange = z.object({
  p10: finiteFinancialNumber,
  p50: finiteFinancialNumber,
  p90: finiteFinancialNumber,
});

export const CapitalRangeSchema = z.enum([
  "300万円未満",
  "300万〜1,000万円",
  "1,000万〜3,000万円",
  "3,000万〜1億円",
  "1億円以上",
]);

export const RevenueRangeSchema = z.enum([
  "1億円未満",
  "1億〜3億円",
  "3億〜10億円",
  "10億〜30億円",
  "30億円以上",
]);

const qualitativeChoice = z.enum(["はい", "いいえ", "わからない"]);
const financialSource = z.enum(["user", "derived", "edited"]);
const sourcedFinancialNumber = z.object({
  value: finiteFinancialNumber,
  source: financialSource,
});
const historicalPeriod = z.object({
  revenue: sourcedFinancialNumber,
  operatingProfit: sourcedFinancialNumber,
  netIncome: sourcedFinancialNumber,
  cash: sourcedFinancialNumber,
  depreciation: sourcedFinancialNumber,
});

export const DiagnosisInsightRequestSchema = z.object({
  industry: z.string().trim().max(100).optional().default(""),
  capitalRange: z.union([CapitalRangeSchema, z.literal("")]).optional().default(""),
  revenueRange: z.union([RevenueRangeSchema, z.literal("")]).optional().default(""),
  performanceRating: z.number().int().min(1).max(5),
  qualitativeAnswers: z.object({
    q1: qualitativeChoice.optional(),
    q2: qualitativeChoice.optional(),
    q3: qualitativeChoice.optional(),
    q4: qualitativeChoice.optional(),
    q5: z.string().trim().max(500).optional(),
  }),
  historicalFinancials: z.object({
    twoYearsAgo: historicalPeriod,
    previousYear: historicalPeriod,
    latestYear: historicalPeriod,
  }),
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
  feedback: z.string().min(1).max(450).describe("日本語のみの簡潔なフィードバック"),
  risks: z
    .array(z.string().min(8).max(150).describe("日本語のみの具体的なリスク。番号は付けない"))
    .min(1)
    .max(3),
  summary: z.string().min(1).max(450).describe("日本語のみの総評"),
  rating: z.number().int().min(1).max(5).describe("経営状況の5段階評価"),
  ratingRationale: z.string().min(1).max(220).describe("日本語のみの評価理由"),
});

export type DiagnosisInsightRequest = z.infer<typeof DiagnosisInsightRequestSchema>;
export type DiagnosisInsight = z.infer<typeof DiagnosisInsightSchema>;

import { z } from "zod";

const finiteFinancialNumber = z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000);
const growthRate = z.number().finite().min(-1).max(100).nullable();

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
});

export const DiagnosisInsightSchema = z.object({
  headline: z.string().min(1).max(100),
  analysis: z.string().min(1).max(500),
  focusPoints: z.array(z.string().min(1).max(160)).min(2).max(3),
  consultationQuestion: z.string().min(1).max(180),
  disclaimer: z.string().min(1).max(200),
});

export type DiagnosisInsightRequest = z.infer<typeof DiagnosisInsightRequestSchema>;
export type DiagnosisInsight = z.infer<typeof DiagnosisInsightSchema>;

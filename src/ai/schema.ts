import { z } from "zod";

export const AIReviewModeSchema = z.enum([
  "account_mapping",
  "anomaly_explanation",
  "scenario_narrative",
  "strategy_actions",
  "india_review",
  "executive_summary",
]);

export type AIReviewMode = z.infer<typeof AIReviewModeSchema>;

export const AIReviewRequestSchema = z.object({
  projectId: z.string().uuid(),
  scenarioExternalId: z.string().min(1).max(160).optional(),
  mode: AIReviewModeSchema,
  context: z.record(z.string(), z.unknown()),
  userNote: z.string().max(2000).optional().default(""),
});

export const AIInsightSchema = z.object({
  summary: z.string(),
  observations: z.array(
    z.object({
      title: z.string(),
      evidence: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      rationale: z.string(),
      financialLink: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  followUpQuestions: z.array(z.string()),
  disclaimer: z.string(),
});

export type AIInsight = z.infer<typeof AIInsightSchema>;

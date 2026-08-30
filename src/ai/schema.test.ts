import { describe, expect, it } from "vitest";
import { DiagnosisInsightSchema } from "./diagnosisSchema";
import { AIInsightSchema, AIReviewRequestSchema } from "./schema";

describe("AI schemas", () => {
  it("accepts a structured evidence-based insight", () => {
    const result = AIInsightSchema.parse({
      summary: "収益性は改善する一方、最低現金残高に注意が必要です。",
      observations: [
        {
          title: "成長と資金のずれ",
          evidence: "売上CAGRは4.2%、最低現金残高は2.1億円です。",
          confidence: "high",
        },
      ],
      recommendations: [
        {
          title: "回収条件の短縮",
          rationale: "成長時の運転資金負担を抑えます。",
          financialLink: "DSOと最低現金残高に連動します。",
          priority: "high",
        },
      ],
      followUpQuestions: ["主要顧客との支払条件を変更できますか。"],
      disclaimer: "確定計算の解釈であり、最終判断ではありません。",
    });
    expect(result.observations[0].confidence).toBe("high");
  });

  it("rejects an unsupported review mode", () => {
    expect(() =>
      AIReviewRequestSchema.parse({
        projectId: "9ea738db-86a7-4c1c-8107-a1fbec021dad",
        mode: "make_financials_up",
        context: {},
      }),
    ).toThrow();
  });
});

describe("DiagnosisInsightSchema", () => {
  it("accepts the production diagnosis insight shape", () => {
    expect(
      DiagnosisInsightSchema.parse({
        headline: "利益の縮小を先回りして確認する局面です",
        analysis: "売上が伸びる一方で利益が縮小する試算になっています。",
        focusPoints: [
          "粗利構造を確認する",
          "固定費の増加要因を確認する",
          "資金繰りへの影響を確認する",
        ],
        consultationQuestion: "5年後に残したい利益水準はいくらですか？",
        disclaimer: "本内容は簡易診断であり、専門家による確認が必要です。",
      }).focusPoints,
    ).toHaveLength(3);
  });
});

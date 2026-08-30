import { describe, expect, it } from "vitest";
import {
  formatDiagnosisPromptInput,
  normalizeDiagnosisInsight,
  normalizeManYenInText,
} from "./diagnosisFormatting";
import type { DiagnosisInsightRequest } from "../src/ai/diagnosisSchema";

const request: DiagnosisInsightRequest = {
  industry: "製造業",
  growthRates: {
    revenue: 0.03456,
    operatingProfit: -0.05004,
    netIncome: null,
  },
  currentEbitda: 3_800.49,
  companyValues: {
    current: 19_300.4,
    year5: 17_412.5,
    year10: 15_950.49,
  },
  projections: {
    latest: { revenue: 45_000, operatingProfit: 2_800, netIncome: 1_600 },
    year5: {
      revenue: 53_471.49,
      operatingProfit: 2_171.5,
      netIncome: 1_041.1,
    },
    year10: {
      revenue: 63_537.281712976735,
      operatingProfit: 1_684.2,
      netIncome: 677.8,
    },
  },
  simulation: {
    runs: 10_000,
    year5CompanyValue: { p10: 10_000, p50: 17_412.5, p90: 28_000 },
    year10CompanyValue: { p10: 8_000, p50: 15_950.49, p90: 35_000 },
    probabilityCompanyValueDeclines: 0.423,
    probabilityOperatingLoss: 0.187,
  },
};

describe("diagnosis AI response formatting", () => {
  it("rounds monetary values to whole ten-thousands before prompting the AI", () => {
    const prompt = formatDiagnosisPromptInput(request);

    expect(prompt).toContain("売上高 63,537万円");
    expect(prompt).toContain("売上高: +3.5%");
    expect(prompt).toContain("営業利益: -5.0%");
    expect(prompt).toContain("最終利益: 算定不可");
    expect(prompt).not.toContain("63,537.281712976735");
    expect(prompt).toContain("10,000回");
    expect(prompt).toContain("42.3%");
  });

  it("normalizes decimal amounts even if the AI returns one", () => {
    expect(normalizeManYenInText("予測は63,537.281712976735万円です")).toBe(
      "予測は63,537万円です",
    );
    expect(normalizeManYenInText("予測は63537.8万円です")).toBe(
      "予測は63,538万円です",
    );
  });

  it("normalizes every displayed insight field", () => {
    const insight = normalizeDiagnosisInsight({
      headline: "63,537.28万円の売上",
      analysis: "営業利益は1,684.2万円です",
      focusPoints: ["677.8万円の前提を確認", "数字以外の論点を確認する", "資金繰りの変化を確認する"],
      consultationQuestion: "63,537.5万円を維持できますか？",
      disclaimer: "15,950.49万円は簡易試算です",
    });

    expect(JSON.stringify(insight)).not.toMatch(/\d\.\d+万円/);
    expect(insight.consultationQuestion).toContain("63,538万円");
  });

  it("removes runaway repetition and provider names from displayed text", () => {
    const insight = normalizeDiagnosisInsight({
      headline: "OpenAIによる分析",
      analysis: "前提を確認しますすすすすすすすすす。",
      focusPoints: [
        "主要前提を確認するるるるるるるるるるるるるるるるるるるるるるるる",
        "GPTの回答を経営判断に使う",
        "利益率の変化を毎月確認する",
      ],
      consultationQuestion: "前提が崩れた場合を確認できますか？",
      disclaimer: "簡易診断です。",
    });

    expect(insight.headline).toBe("AIによる分析");
    expect(insight.focusPoints[0]).toBe("主要前提を確認する");
    expect(insight.focusPoints[1]).toBe("AIの回答を経営判断に使う");
    expect(JSON.stringify(insight)).not.toMatch(/(.)\1{2,}/u);
  });

  it("rejects unexpected English copy before it reaches the page", () => {
    expect(() =>
      normalizeDiagnosisInsight({
        headline: "Review the assumptions",
        analysis: "利益率の前提を確認します。",
        focusPoints: ["売上の前提を確認する", "利益率を確認する", "資金繰りを確認する"],
        consultationQuestion: "どの前提から確認しますか？",
        disclaimer: "簡易診断です。",
      }),
    ).toThrow("英字");
  });

  it("rejects a field that contains only repeated characters", () => {
    expect(() =>
      normalizeDiagnosisInsight({
        headline: "経営上の前提確認が必要です",
        analysis: "利益率の前提を確認します。",
        focusPoints: ["る".repeat(80), "利益率を毎月確認する", "資金繰りを毎月確認する"],
        consultationQuestion: "どの前提から確認しますか？",
        disclaimer: "簡易診断です。",
      }),
    ).toThrow();
  });
});

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
};

describe("diagnosis GPT number formatting", () => {
  it("rounds monetary values to whole ten-thousands before prompting GPT", () => {
    const prompt = formatDiagnosisPromptInput(request);

    expect(prompt).toContain("売上高 63,537万円");
    expect(prompt).toContain("売上高: +3.5%");
    expect(prompt).toContain("営業利益: -5.0%");
    expect(prompt).toContain("最終利益: 算定不可");
    expect(prompt).not.toContain("63,537.281712976735");
  });

  it("normalizes decimal amounts even if GPT returns one", () => {
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
      focusPoints: ["677.8万円を確認", "数字以外の論点"],
      consultationQuestion: "63,537.5万円を維持できますか？",
      disclaimer: "15,950.49万円は簡易試算です",
    });

    expect(JSON.stringify(insight)).not.toMatch(/\d\.\d+万円/);
    expect(insight.consultationQuestion).toContain("63,538万円");
  });
});

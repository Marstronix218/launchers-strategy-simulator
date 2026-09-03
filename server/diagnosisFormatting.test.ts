import { describe, expect, it } from "vitest";
import { formatDiagnosisPromptInput, normalizeDiagnosisInsight, normalizeManYenInText } from "./diagnosisFormatting";
import type { DiagnosisInsightRequest } from "../src/ai/diagnosisSchema";

const period = (source: "user" | "derived" | "edited") => ({
  revenue: { value: 45_000, source },
  operatingProfit: { value: 2_800, source },
  netIncome: { value: 1_600, source },
  cash: { value: 9_000, source },
  depreciation: { value: 1_000, source },
});

const request: DiagnosisInsightRequest = {
  industry: "製造業",
  capitalRange: "1,000万〜3,000万円",
  revenueRange: "3億〜10億円",
  performanceRating: 4,
  qualitativeAnswers: { q1: "はい", q2: "わからない", q5: "後継者と今後の投資方針を整理したい" },
  historicalFinancials: {
    twoYearsAgo: { ...period("derived"), operatingProfit: { value: 3_100, source: "edited" } },
    previousYear: period("derived"),
    latestYear: period("user"),
  },
  growthRates: { revenue: 0.03456, operatingProfit: -0.05004, netIncome: null },
  currentEbitda: 3_800.49,
  companyValues: { current: 19_300.4, year5: 17_412.5, year10: 15_950.49 },
  projections: {
    latest: { revenue: 45_000, operatingProfit: 2_800, netIncome: 1_600 },
    year5: { revenue: 53_471.49, operatingProfit: 2_171.5, netIncome: 1_041.1 },
    year10: { revenue: 63_537.281712976735, operatingProfit: 1_684.2, netIncome: 677.8 },
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
  it("includes rounded financial, qualitative, classification, and source data", () => {
    const prompt = formatDiagnosisPromptInput(request);
    expect(prompt).toContain("売上高 63,537万円");
    expect(prompt).toContain("売上高: +3.5%");
    expect(prompt).toContain("営業利益: -5.0%");
    expect(prompt).toContain("最終利益: 算定不可");
    expect(prompt).not.toContain("63,537.281712976735");
    expect(prompt).toContain("10,000回");
    expect(prompt).toContain("42.3%");
    expect(prompt).toContain("資本金: 1,000万〜3,000万円");
    expect(prompt).toContain("利用者による直近業績の評価: 4/5");
    expect(prompt).toContain("営業利益: 3,100万円（利用者修正）");
    expect(prompt).toContain("後継者と今後の投資方針を整理したい");
    expect(prompt).toContain("給与・待遇を維持し続けられますか？: 未回答");
  });

  it("normalizes decimal amounts even if the AI returns one", () => {
    expect(normalizeManYenInText("予測は63,537.281712976735万円です")).toBe("予測は63,537万円です");
    expect(normalizeManYenInText("予測は63537.8万円です")).toBe("予測は63,538万円です");
  });

  it("normalizes every displayed insight field", () => {
    const insight = normalizeDiagnosisInsight({
      feedback: "63,537.28万円の売上と営業利益1,684.2万円です",
      risks: ["677.8万円の前提を確認", "資金繰りの変化を確認する"],
      summary: "15,950.49万円は簡易試算です",
      rating: 4,
      ratingRationale: "63,537.5万円を維持できる可能性を評価しました",
    });
    expect(JSON.stringify(insight)).not.toMatch(/\d\.\d+万円/);
    expect(insight.ratingRationale).toContain("63,538万円");
  });

  it("removes runaway repetition and provider names from displayed text", () => {
    const insight = normalizeDiagnosisInsight({
      feedback: "OpenAIによる分析",
      risks: ["主要前提を確認するるるるるるるるるるるるるるるるるるるるるるる", "GPTの回答を経営判断に使う"],
      summary: "利益率の変化を毎月確認しますすすすすすすすすす。",
      rating: 3,
      ratingRationale: "前提が崩れた場合の影響を確認しました。",
    });
    expect(insight.feedback).toBe("AIによる分析");
    expect(insight.risks[0]).toBe("主要前提を確認する");
    expect(insight.risks[1]).toBe("AIの回答を経営判断に使う");
    expect(JSON.stringify(insight)).not.toMatch(/(.)\1{2,}/u);
  });

  it("preserves common business abbreviations without dropping the analysis", () => {
    const insight = normalizeDiagnosisInsight({
      feedback: "IT投資とM&Aの前提を確認します。",
      risks: ["DX投資が先行して資金を圧迫する可能性があります。"],
      summary: "利益率とSaaS事業の前提を確認します。",
      rating: 3,
      ratingRationale: "簡易評価です。",
    });
    expect(insight.feedback).toContain("IT投資");
    expect(insight.risks[0]).toContain("DX投資");
  });

  it("rejects a field that contains only repeated characters", () => {
    expect(() => normalizeDiagnosisInsight({
      feedback: "経営上の前提確認が必要です",
      risks: ["る".repeat(150)],
      summary: "利益率の前提を確認します。",
      rating: 3,
      ratingRationale: "簡易評価です。",
    })).toThrow();
  });
});

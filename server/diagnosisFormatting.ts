import {
  DiagnosisInsightSchema,
  type DiagnosisInsight,
  type DiagnosisInsightRequest,
} from "../src/ai/diagnosisSchema";

const integerFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

export function formatManYen(value: number): string {
  return `${integerFormatter.format(Math.round(value))}万円`;
}

export function formatGrowthRate(value: number | null): string {
  if (value === null) return "算定不可";
  const percentage = value * 100;
  return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

export function formatDiagnosisPromptInput(input: DiagnosisInsightRequest): string {
  const { latest, year5, year10 } = input.projections;
  const { simulation } = input;
  return [
    `業種: ${input.industry || "未入力"}`,
    "年平均成長率:",
    `- 売上高: ${formatGrowthRate(input.growthRates.revenue)}`,
    `- 営業利益: ${formatGrowthRate(input.growthRates.operatingProfit)}`,
    `- 最終利益: ${formatGrowthRate(input.growthRates.netIncome)}`,
    `直近期の簡易キャッシュ創出力: ${formatManYen(input.currentEbitda)}`,
    "モンテカルロ・シミュレーションの簡易企業価値（中央値）:",
    `- 現在: ${formatManYen(input.companyValues.current)}`,
    `- 5年後: ${formatManYen(input.companyValues.year5)}`,
    `- 10年後: ${formatManYen(input.companyValues.year10)}`,
    "主要指標:",
    `- 直近期: 売上高 ${formatManYen(latest.revenue)}、営業利益 ${formatManYen(latest.operatingProfit)}、最終利益 ${formatManYen(latest.netIncome)}`,
    `- 5年後: 売上高 ${formatManYen(year5.revenue)}、営業利益 ${formatManYen(year5.operatingProfit)}、最終利益 ${formatManYen(year5.netIncome)}`,
    `- 10年後: 売上高 ${formatManYen(year10.revenue)}、営業利益 ${formatManYen(year10.operatingProfit)}、最終利益 ${formatManYen(year10.netIncome)}`,
    `シミュレーション回数: ${simulation.runs.toLocaleString("ja-JP")}回`,
    `- 5年後企業価値の下位10%値・中央値・上位10%値: ${formatManYen(simulation.year5CompanyValue.p10)} / ${formatManYen(simulation.year5CompanyValue.p50)} / ${formatManYen(simulation.year5CompanyValue.p90)}`,
    `- 10年後企業価値の下位10%値・中央値・上位10%値: ${formatManYen(simulation.year10CompanyValue.p10)} / ${formatManYen(simulation.year10CompanyValue.p50)} / ${formatManYen(simulation.year10CompanyValue.p90)}`,
    `- 10年後に現在価値を下回る確率: ${(simulation.probabilityCompanyValueDeclines * 100).toFixed(1)}%`,
    `- 10年以内に営業赤字となる確率: ${(simulation.probabilityOperatingLoss * 100).toFixed(1)}%`,
  ].join("\n");
}

export function normalizeManYenInText(text: string): string {
  return text.replace(
    /(-?(?:\d{1,3}(?:,\d{3})+|\d+))\.\d+(?=\s*万円)/g,
    (match, integerPart: string) => {
      const value = Number(match.replaceAll(",", ""));
      return Number.isFinite(value)
        ? integerFormatter.format(Math.round(value))
        : integerPart;
    },
  );
}

function normalizeDisplayedInsightText(text: string): string {
  let normalized = normalizeManYenInText(text)
    .replace(/Open\s*AI|GPT(?:-\d+(?:\.\d+)*(?:-[A-Za-z]+)?)?/giu, "AI")
    .trim();

  for (let unitLength = 1; unitLength <= 12; unitLength += 1) {
    const repeatedSequence = new RegExp(`(.{${unitLength}})\\1{2,}`, "gu");
    normalized = normalized.replace(repeatedSequence, "$1");
  }

  const textWithoutAllowedAiLabel = normalized.replaceAll("AI", "");
  if (/[A-Za-z]/u.test(textWithoutAllowedAiLabel)) {
    throw new Error("AI分析結果に許可されていない英字が含まれています。");
  }

  return normalized;
}

export function normalizeDiagnosisInsight(
  insight: DiagnosisInsight,
): DiagnosisInsight {
  const normalizedInsight = {
    headline: normalizeDisplayedInsightText(insight.headline),
    analysis: normalizeDisplayedInsightText(insight.analysis),
    focusPoints: insight.focusPoints.map(normalizeDisplayedInsightText),
    consultationQuestion: normalizeDisplayedInsightText(insight.consultationQuestion),
    disclaimer: normalizeDisplayedInsightText(insight.disclaimer),
  };

  if (new Set(normalizedInsight.focusPoints).size !== normalizedInsight.focusPoints.length) {
    throw new Error("AI分析結果の確認項目が重複しています。");
  }

  return DiagnosisInsightSchema.parse(normalizedInsight);
}

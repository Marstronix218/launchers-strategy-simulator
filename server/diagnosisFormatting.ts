import type {
  DiagnosisInsight,
  DiagnosisInsightRequest,
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
  return [
    `業種: ${input.industry || "未入力"}`,
    "CAGR:",
    `- 売上高: ${formatGrowthRate(input.growthRates.revenue)}`,
    `- 営業利益: ${formatGrowthRate(input.growthRates.operatingProfit)}`,
    `- 最終利益: ${formatGrowthRate(input.growthRates.netIncome)}`,
    `直近期の簡易EBITDA: ${formatManYen(input.currentEbitda)}`,
    "簡易企業価値:",
    `- 現在: ${formatManYen(input.companyValues.current)}`,
    `- 5年後: ${formatManYen(input.companyValues.year5)}`,
    `- 10年後: ${formatManYen(input.companyValues.year10)}`,
    "主要指標:",
    `- 直近期: 売上高 ${formatManYen(latest.revenue)}、営業利益 ${formatManYen(latest.operatingProfit)}、最終利益 ${formatManYen(latest.netIncome)}`,
    `- 5年後: 売上高 ${formatManYen(year5.revenue)}、営業利益 ${formatManYen(year5.operatingProfit)}、最終利益 ${formatManYen(year5.netIncome)}`,
    `- 10年後: 売上高 ${formatManYen(year10.revenue)}、営業利益 ${formatManYen(year10.operatingProfit)}、最終利益 ${formatManYen(year10.netIncome)}`,
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

export function normalizeDiagnosisInsight(
  insight: DiagnosisInsight,
): DiagnosisInsight {
  return {
    headline: normalizeManYenInText(insight.headline),
    analysis: normalizeManYenInText(insight.analysis),
    focusPoints: insight.focusPoints.map(normalizeManYenInText),
    consultationQuestion: normalizeManYenInText(insight.consultationQuestion),
    disclaimer: normalizeManYenInText(insight.disclaimer),
  };
}

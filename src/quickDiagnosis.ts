export const EBITDA_MULTIPLE = 3;

export type DiagnosisMetric =
  | "revenue"
  | "operatingProfit"
  | "netIncome"
  | "cash"
  | "depreciation";

export type DiagnosisPeriod = "twoYearsAgo" | "previousYear" | "latestYear";

export type DiagnosisFinancials = Record<
  DiagnosisPeriod,
  Record<DiagnosisMetric, number>
>;

export interface DiagnosisProjectionPoint {
  label: string;
  revenue: number;
  operatingProfit: number;
  netIncome: number;
}

export interface DiagnosisValuePoint {
  label: string;
  value: number;
}

export interface QuickDiagnosisResult {
  growthRates: Record<"revenue" | "operatingProfit" | "netIncome", number | null>;
  projections: DiagnosisProjectionPoint[];
  companyValues: DiagnosisValuePoint[];
  currentEbitda: number;
  year10ValueRatio: number | null;
  message: string;
}

const GROWTH_METRICS = ["revenue", "operatingProfit", "netIncome"] as const;

/**
 * PRDの「直近期 ÷ 前々期」の2期間CAGR。
 * CAGRが数学的に定義できないゼロ・負の始点や負の終点は null とする。
 */
export function calculateTwoPeriodCagr(
  oldestValue: number,
  latestValue: number,
): number | null {
  if (oldestValue <= 0 || latestValue < 0) return null;
  return Math.sqrt(latestValue / oldestValue) - 1;
}

function projectValue(latestValue: number, rate: number | null, years: number): number {
  if (rate === null) return latestValue;
  return latestValue * (1 + rate) ** years;
}

function companyValue(cash: number, operatingProfit: number, depreciation: number): number {
  return cash + (operatingProfit + depreciation) * EBITDA_MULTIPLE;
}

export function calculateQuickDiagnosis(
  financials: DiagnosisFinancials,
): QuickDiagnosisResult {
  const oldest = financials.twoYearsAgo;
  const previous = financials.previousYear;
  const latest = financials.latestYear;
  const growthRates = Object.fromEntries(
    GROWTH_METRICS.map((metric) => [
      metric,
      calculateTwoPeriodCagr(oldest[metric], latest[metric]),
    ]),
  ) as QuickDiagnosisResult["growthRates"];

  const projectionFor = (label: string, years: number): DiagnosisProjectionPoint => ({
    label,
    revenue: projectValue(latest.revenue, growthRates.revenue, years),
    operatingProfit: projectValue(
      latest.operatingProfit,
      growthRates.operatingProfit,
      years,
    ),
    netIncome: projectValue(latest.netIncome, growthRates.netIncome, years),
  });

  const projections: DiagnosisProjectionPoint[] = [
    {
      label: "前々期",
      revenue: oldest.revenue,
      operatingProfit: oldest.operatingProfit,
      netIncome: oldest.netIncome,
    },
    {
      label: "前期",
      revenue: previous.revenue,
      operatingProfit: previous.operatingProfit,
      netIncome: previous.netIncome,
    },
    {
      label: "直近期",
      revenue: latest.revenue,
      operatingProfit: latest.operatingProfit,
      netIncome: latest.netIncome,
    },
    projectionFor("5年後", 5),
    projectionFor("10年後", 10),
  ];

  // PRDで将来変化率が定義されていない現預金と減価償却費は、直近期の値で固定する。
  const currentValue = companyValue(
    latest.cash,
    latest.operatingProfit,
    latest.depreciation,
  );
  const year5Value = companyValue(
    latest.cash,
    projections[3].operatingProfit,
    latest.depreciation,
  );
  const year10Value = companyValue(
    latest.cash,
    projections[4].operatingProfit,
    latest.depreciation,
  );
  const year10ValueRatio = currentValue === 0 ? null : year10Value / currentValue;

  let message: string;
  if (growthRates.revenue === null || growthRates.operatingProfit === null) {
    message =
      "利益が赤字またはゼロの期を含むため、一部の成長率は算定できません。今の収益構造をいつまでに転換するか、個別に確認してみませんか？";
  } else if (growthRates.revenue <= 0.005 || growthRates.operatingProfit <= 0.005) {
    const percentage = year10ValueRatio === null
      ? "算定が難しい水準"
      : `現在の${Math.max(0, Math.round(year10ValueRatio * 100))}%程度`;
    message = `このままの延長線だと、10年後の企業価値は${percentage}になる可能性があります。`;
  } else {
    message =
      "このペースの成長を、この先も維持できますか？人材・投資・次の市場まで含めた成長戦略を、今のうちに確かめてみませんか？";
  }

  return {
    growthRates,
    projections,
    companyValues: [
      { label: "現在", value: currentValue },
      { label: "5年後", value: year5Value },
      { label: "10年後", value: year10Value },
    ],
    currentEbitda: latest.operatingProfit + latest.depreciation,
    year10ValueRatio,
    message,
  };
}

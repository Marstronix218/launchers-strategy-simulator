export const EBITDA_MULTIPLE = 3;
export const MONTE_CARLO_RUNS = 10_000;

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

export interface SimulationRange {
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationHorizonResult {
  revenue: SimulationRange;
  operatingProfit: SimulationRange;
  netIncome: SimulationRange;
  cash: SimulationRange;
  companyValue: SimulationRange;
}

export interface QuickSimulationResult {
  runs: number;
  seed: number;
  year5: SimulationHorizonResult;
  year10: SimulationHorizonResult;
  probabilityCompanyValueDeclines: number;
  probabilityOperatingLoss: number;
}

export interface QuickDiagnosisResult {
  growthRates: Record<"revenue" | "operatingProfit" | "netIncome", number | null>;
  projections: DiagnosisProjectionPoint[];
  companyValues: DiagnosisValuePoint[];
  currentEbitda: number;
  year10ValueRatio: number | null;
  message: string;
  simulation: QuickSimulationResult;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function companyValue(cash: number, operatingProfit: number, depreciation: number): number {
  return cash + (operatingProfit + depreciation) * EBITDA_MULTIPLE;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function annualRate(from: number, to: number): number | null {
  if (from <= 0) return null;
  return to / from - 1;
}

function finiteMean(values: Array<number | null>, fallback: number): number {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length > 0 ? mean(valid) : fallback;
}

function hashFinancials(financials: DiagnosisFinancials): number {
  let hash = 2_166_136_261;
  const serialized = JSON.stringify(financials);
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normalRandom(random: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const first = Math.max(Number.EPSILON, random());
    const second = random();
    const magnitude = Math.sqrt(-2 * Math.log(first));
    spare = magnitude * Math.sin(2 * Math.PI * second);
    return magnitude * Math.cos(2 * Math.PI * second);
  };
}

function percentile(sortedValues: number[], quantile: number): number {
  const position = (sortedValues.length - 1) * quantile;
  const lower = Math.floor(position);
  const remainder = position - lower;
  const upper = sortedValues[lower + 1];
  return upper === undefined
    ? sortedValues[lower]
    : sortedValues[lower] + remainder * (upper - sortedValues[lower]);
}

function range(values: number[]): SimulationRange {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  };
}

type SimulationSnapshot = {
  revenue: number;
  operatingProfit: number;
  netIncome: number;
  cash: number;
  companyValue: number;
};

function summarizeSnapshots(
  snapshots: SimulationSnapshot[],
): SimulationHorizonResult {
  return {
    revenue: range(snapshots.map((item) => item.revenue)),
    operatingProfit: range(snapshots.map((item) => item.operatingProfit)),
    netIncome: range(snapshots.map((item) => item.netIncome)),
    cash: range(snapshots.map((item) => item.cash)),
    companyValue: range(snapshots.map((item) => item.companyValue)),
  };
}

/**
 * Runs a reproducible Monte Carlo forecast from the limited quick-diagnosis
 * inputs. Historical observations set the central tendency; conservative
 * volatility floors prevent three fiscal years from producing false precision.
 */
export function simulateQuickDiagnosis(
  financials: DiagnosisFinancials,
  runs = MONTE_CARLO_RUNS,
): QuickSimulationResult {
  const historical = [
    financials.twoYearsAgo,
    financials.previousYear,
    financials.latestYear,
  ];
  const latest = financials.latestYear;
  const revenueRates = [
    annualRate(historical[0].revenue, historical[1].revenue),
    annualRate(historical[1].revenue, historical[2].revenue),
  ];
  const validRevenueRates = revenueRates.filter(
    (value): value is number => value !== null,
  );
  const revenueTrend = clamp(
    finiteMean(revenueRates, 0),
    -0.3,
    0.5,
  );
  const revenueVolatility = clamp(
    Math.max(0.05, standardDeviation(validRevenueRates)),
    0.05,
    0.35,
  );

  const operatingMargins = historical.map((item) =>
    item.revenue > 0 ? item.operatingProfit / item.revenue : 0,
  );
  const netMargins = historical.map((item) =>
    item.revenue > 0 ? item.netIncome / item.revenue : 0,
  );
  const depreciationRates = historical.map((item) =>
    item.revenue > 0 ? item.depreciation / item.revenue : 0,
  );
  const cashConversionRates = [
    historical[1].netIncome === 0
      ? null
      : (historical[1].cash - historical[0].cash) / historical[1].netIncome,
    historical[2].netIncome === 0
      ? null
      : (historical[2].cash - historical[1].cash) / historical[2].netIncome,
  ];

  const targetOperatingMargin = clamp(mean(operatingMargins), -0.5, 0.6);
  const targetNetMargin = clamp(mean(netMargins), -0.5, 0.5);
  const targetDepreciationRate = clamp(mean(depreciationRates), 0, 0.25);
  const operatingMarginVolatility = clamp(
    Math.max(0.015, standardDeviation(operatingMargins)),
    0.015,
    0.2,
  );
  const netMarginVolatility = clamp(
    Math.max(0.012, standardDeviation(netMargins)),
    0.012,
    0.15,
  );
  const depreciationVolatility = clamp(
    Math.max(0.003, standardDeviation(depreciationRates)),
    0.003,
    0.05,
  );
  const cashConversion = clamp(finiteMean(cashConversionRates, 0.5), -2, 2);
  const seed = hashFinancials(financials);
  const random = seededRandom(seed);
  const normal = normalRandom(random);
  const year5: SimulationSnapshot[] = [];
  const year10: SimulationSnapshot[] = [];
  let valueDeclines = 0;
  let operatingLosses = 0;
  const currentValue = companyValue(
    latest.cash,
    latest.operatingProfit,
    latest.depreciation,
  );

  for (let run = 0; run < runs; run += 1) {
    let revenue = latest.revenue;
    let cash = latest.cash;
    let revenueGrowth = revenueTrend;
    let operatingMargin = operatingMargins[2];
    let netMargin = netMargins[2];
    let depreciationRate = depreciationRates[2];
    let hadOperatingLoss = false;
    let finalSnapshot: SimulationSnapshot | null = null;

    for (let year = 1; year <= 10; year += 1) {
      const macroShock = normal();
      revenueGrowth = clamp(
        revenueTrend * 0.65 +
          revenueGrowth * 0.35 +
          revenueVolatility * (macroShock * 0.55 + normal() * 0.835),
        -0.5,
        1,
      );
      revenue = Math.max(0, revenue * (1 + revenueGrowth));
      operatingMargin = clamp(
        operatingMargin +
          (targetOperatingMargin - operatingMargin) * 0.22 +
          operatingMarginVolatility * (macroShock * 0.35 + normal() * 0.937),
        -1,
        0.7,
      );
      netMargin = clamp(
        netMargin +
          (targetNetMargin - netMargin) * 0.25 +
          netMarginVolatility * (macroShock * 0.3 + normal() * 0.954),
        -1,
        0.6,
      );
      depreciationRate = clamp(
        depreciationRate +
          (targetDepreciationRate - depreciationRate) * 0.3 +
          depreciationVolatility * normal(),
        0,
        0.25,
      );

      const operatingProfit = revenue * operatingMargin;
      const netIncome = revenue * netMargin;
      const depreciation = revenue * depreciationRate;
      const cashFlowNoise = revenue * revenueVolatility * 0.025 * normal();
      cash += netIncome * cashConversion + cashFlowNoise;
      const snapshot = {
        revenue,
        operatingProfit,
        netIncome,
        cash,
        companyValue: companyValue(cash, operatingProfit, depreciation),
      };
      if (operatingProfit < 0) hadOperatingLoss = true;
      if (year === 5) year5.push(snapshot);
      if (year === 10) {
        year10.push(snapshot);
        finalSnapshot = snapshot;
      }
    }

    if (hadOperatingLoss) operatingLosses += 1;
    if (finalSnapshot && finalSnapshot.companyValue < currentValue) {
      valueDeclines += 1;
    }
  }

  return {
    runs,
    seed,
    year5: summarizeSnapshots(year5),
    year10: summarizeSnapshots(year10),
    probabilityCompanyValueDeclines: valueDeclines / runs,
    probabilityOperatingLoss: operatingLosses / runs,
  };
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
  const simulation = simulateQuickDiagnosis(financials);

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
    {
      label: "5年後（中央値）",
      revenue: simulation.year5.revenue.p50,
      operatingProfit: simulation.year5.operatingProfit.p50,
      netIncome: simulation.year5.netIncome.p50,
    },
    {
      label: "10年後（中央値）",
      revenue: simulation.year10.revenue.p50,
      operatingProfit: simulation.year10.operatingProfit.p50,
      netIncome: simulation.year10.netIncome.p50,
    },
  ];

  const currentValue = companyValue(
    latest.cash,
    latest.operatingProfit,
    latest.depreciation,
  );
  const year5Value = simulation.year5.companyValue.p50;
  const year10Value = simulation.year10.companyValue.p50;
  const year10ValueRatio = currentValue === 0 ? null : year10Value / currentValue;

  let message: string;
  if (simulation.probabilityOperatingLoss >= 0.4) {
    message = `10,000通りの試算のうち、${Math.round(simulation.probabilityOperatingLoss * 100)}%で10年以内に営業赤字が発生しました。`;
  } else if (simulation.probabilityCompanyValueDeclines >= 0.4) {
    message = `10,000通りの試算のうち、${Math.round(simulation.probabilityCompanyValueDeclines * 100)}%で10年後の企業価値が現在を下回りました。`;
  } else {
    message = `10年後の企業価値は、中央値${Math.round(year10Value / 100).toLocaleString("ja-JP")}百万円。結果の幅を生む前提を確認することが重要です。`;
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
    simulation,
  };
}

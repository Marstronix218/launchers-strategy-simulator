import type {
  CompanyBaseline,
  GoalSolution,
  GoalTargets,
  IndiaAssessment,
  IndiaInputs,
  Scenario,
  SensitivityResult,
  StrategyAction,
} from "../types";
import { forecastScenario } from "./engine";

function adjusted(
  scenario: Scenario,
  driver: keyof Scenario["drivers"],
  amount: number,
): Scenario {
  return {
    ...scenario,
    drivers: {
      ...scenario.drivers,
      [driver]: scenario.drivers[driver] + amount,
    },
  };
}

export function runSensitivity(
  baseline: CompanyBaseline,
  scenario: Scenario,
  baseYear: number,
  horizon: number,
): SensitivityResult[] {
  const base = forecastScenario(baseline, scenario, baseYear, horizon);
  const baseLast = base.rows[Math.min(4, base.rows.length - 1)];
  const baseMinCash = base.kpis.minimumCash;
  const cases: Array<{
    label: string;
    change: string;
    driver: keyof Scenario["drivers"];
    amount: number;
  }> = [
    { label: "売上数量成長率", change: "+3.0pt", driver: "volumeGrowth", amount: 0.03 },
    { label: "価格上昇率", change: "+2.0pt", driver: "priceGrowth", amount: 0.02 },
    { label: "生産性改善率", change: "+2.0pt", driver: "productivityImprovement", amount: 0.02 },
    { label: "人件費上昇率", change: "+2.0pt", driver: "salaryGrowth", amount: 0.02 },
    { label: "借入金利", change: "+1.0pt", driver: "borrowingRate", amount: 0.01 },
    { label: "回収サイト", change: "+15日", driver: "dso", amount: 15 },
    { label: "設備投資", change: "+1億円", driver: "growthCapex", amount: 100_000_000 },
  ];

  return cases.map((item) => {
    const result = forecastScenario(
      baseline,
      adjusted(scenario, item.driver, item.amount),
      baseYear,
      horizon,
    );
    const last = result.rows[Math.min(4, result.rows.length - 1)];
    return {
      label: item.label,
      change: item.change,
      ebitdaImpact: last.ebitda - baseLast.ebitda,
      freeCashFlowImpact: last.freeCashFlow - baseLast.freeCashFlow,
      minimumCashImpact: result.kpis.minimumCash - baseMinCash,
    };
  });
}

export function goalSeek(
  baseline: CompanyBaseline,
  baseScenario: Scenario,
  baseYear: number,
  targets: GoalTargets,
): GoalSolution[] {
  const solutions: GoalSolution[] = [];
  const priceOptions = [0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045];
  const volumeOptions = [0.01, 0.02, 0.03, 0.04, 0.05];
  const productivityOptions = [0.01, 0.02, 0.03, 0.04];
  const newBusinessOptions = [50, 100, 150, 200].map((value) => value * 1_000_000);

  for (const priceGrowth of priceOptions) {
    for (const volumeGrowth of volumeOptions) {
      for (const productivityImprovement of productivityOptions) {
        for (const newBusinessRevenue of newBusinessOptions) {
          const scenario: Scenario = {
            ...baseScenario,
            drivers: {
              ...baseScenario.drivers,
              priceGrowth,
              volumeGrowth,
              productivityImprovement,
              newBusinessRevenue,
            },
          };
          const result = forecastScenario(baseline, scenario, baseYear, 5);
          const year5 = result.rows[4];
          const ebitdaMargin = year5.ebitda / year5.revenue;
          const minimumCash = result.kpis.minimumCash;
          if (
            year5.revenue >= targets.year5Revenue &&
            ebitdaMargin >= targets.ebitdaMargin &&
            minimumCash >= targets.minimumCash
          ) {
            const score =
              priceGrowth * 100 +
              volumeGrowth * 80 +
              productivityImprovement * 70 +
              newBusinessRevenue / 100_000_000;
            solutions.push({
              priceGrowth,
              volumeGrowth,
              productivityImprovement,
              newBusinessRevenue,
              year5Revenue: year5.revenue,
              ebitdaMargin,
              minimumCash,
              score,
            });
          }
        }
      }
    }
  }

  return solutions.sort((a, b) => a.score - b.score).slice(0, 8);
}

export function deriveStrategyActions(
  asIs: ReturnType<typeof forecastScenario>,
  target: ReturnType<typeof forecastScenario>,
): StrategyAction[] {
  const asIsYear5 = asIs.rows[Math.min(4, asIs.rows.length - 1)];
  const targetYear5 = target.rows[Math.min(4, target.rows.length - 1)];
  const revenueGap = targetYear5.revenue - asIsYear5.revenue;
  const ebitdaGap = targetYear5.ebitda - asIsYear5.ebitda;
  const cashGap = targetYear5.endingCash - asIsYear5.endingCash;
  const actions: StrategyAction[] = [];

  if (revenueGap > 0) {
    actions.push({
      category: "成長",
      title: "重点顧客の価格・数量ミックス改善",
      rationale: `5年後売上に約${Math.round(revenueGap / 100_000_000)}億円のギャップがあります。`,
      impact: "単価 +2〜3%、重点顧客シェア +4pt",
      priority: "最優先",
    });
    actions.push({
      category: "新規事業",
      title: "保守サービスのストック売上化",
      rationale: "既存納入先を起点に、収益の変動性を下げます。",
      impact: "5年後の新規売上 4〜6億円",
      priority: "高",
    });
  }
  if (ebitdaGap > 0) {
    actions.push({
      category: "収益性",
      title: "調達・歩留まり・自動化の統合改善",
      rationale: `EBITDAに約${Math.round(ebitdaGap / 100_000_000)}億円の改善余地があります。`,
      impact: "変動原価率 -2.5pt、生産性 +2pt/年",
      priority: "最優先",
    });
  }
  if (cashGap > 0) {
    actions.push({
      category: "資金",
      title: "運転資本60日プログラム",
      rationale: "成長投資を借入だけに依存しない資金余力を作ります。",
      impact: "DSO -7日、DIO -10日",
      priority: "高",
    });
  }
  actions.push({
    category: "選択肢",
    title: "インド参入を段階投資で検証",
    rationale: "国内改善後も残る売上ギャップに対する追加オプションです。",
    impact: "アンカー顧客獲得を投資ゲートに設定",
    priority: "中",
  });
  return actions;
}

export function assessIndia(inputs: IndiaInputs, baseYear: number): IndiaAssessment {
  const rows: IndiaAssessment["rows"] = [];
  let cumulativeCashFlow = 0;
  const cumulativeInvestment = inputs.initialSetupCost + inputs.capex;
  let peakFundingNeed = cumulativeInvestment;
  let operatingBreakEvenYear: number | null = null;
  let cashBreakEvenYear: number | null = null;

  for (let index = 1; index <= 10; index += 1) {
    const activeYear = index - inputs.preparationYears;
    const ramp =
      activeYear <= 0 ? 0 : activeYear === 1 ? 0.3 : activeYear === 2 ? 0.65 : Math.min(1.8, 1 + (activeYear - 3) * 0.12);
    const revenue = inputs.year3Revenue * ramp;
    const grossProfit =
      revenue * (inputs.grossMargin - inputs.logisticsAndTariffRate);
    const personnel = inputs.localHeadcount * inputs.annualSalary * Math.pow(1.06, index - 1);
    const overhead = activeYear <= 0 ? 35_000_000 : 55_000_000 * Math.pow(1.04, index - 1);
    const ebitda = grossProfit - personnel - overhead;
    const workingCapitalInvestment =
      revenue > 0 ? (revenue / 365) * inputs.dso * 0.28 : 0;
    const setupCash =
      index === 1 ? -(inputs.initialSetupCost + inputs.capex) : 0;
    const tax = Math.max(0, ebitda) * inputs.taxRate;
    const cashFlow =
      ebitda - tax + setupCash - (index <= 3 ? workingCapitalInvestment * 0.3 : 0);
    cumulativeCashFlow += cashFlow;
    peakFundingNeed = Math.max(peakFundingNeed, -cumulativeCashFlow);
    if (ebitda > 0 && operatingBreakEvenYear === null) {
      operatingBreakEvenYear = baseYear + index;
    }
    if (cumulativeCashFlow > 0 && cashBreakEvenYear === null) {
      cashBreakEvenYear = baseYear + index;
    }
    rows.push({
      year: baseYear + index,
      revenue,
      ebitda,
      cashFlow,
      cumulativeCashFlow,
    });
  }

  let score = 72;
  const reasons: string[] = [];
  if (!inputs.hasCountryManager) {
    score -= 15;
    reasons.push("現地責任者が未確定");
  }
  if (!inputs.hasAnchorCustomer) {
    score -= 20;
    reasons.push("初期顧客仮説が未検証");
  } else {
    reasons.push("アンカー顧客候補あり");
  }
  if (inputs.regulatoryBlocker) {
    score -= 35;
    reasons.push("法規制上の重大障害あり");
  }
  if (cashBreakEvenYear === null) {
    score -= 15;
    reasons.push("10年内に累積CFが黒字化しない");
  } else {
    reasons.push(`${cashBreakEvenYear}年度に累積CF黒字化`);
  }
  if (inputs.grossMargin >= 0.35) {
    score += 8;
    reasons.push("目標粗利率は参入基準を充足");
  }

  let verdict: IndiaAssessment["verdict"] =
    score >= 75 ? "Go" : score >= 50 ? "Conditional Go" : "No-Go";
  if (
    inputs.regulatoryBlocker ||
    !inputs.hasAnchorCustomer ||
    !inputs.hasCountryManager
  ) {
    verdict = score < 45 ? "No-Go" : "Conditional Go";
  }

  return {
    verdict,
    score: Math.max(0, Math.min(100, score)),
    peakFundingNeed,
    operatingBreakEvenYear,
    cashBreakEvenYear,
    cumulativeInvestment,
    reasons,
    rows,
  };
}

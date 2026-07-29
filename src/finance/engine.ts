import Decimal from "decimal.js";
import type {
  CompanyBaseline,
  CoreDrivers,
  ForecastRow,
  Scenario,
  ScenarioResult,
} from "../types";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const D = (value: Decimal.Value) => new Decimal(value);
const n = (value: Decimal) => value.toNumber();

function driversForYear(scenario: Scenario, index: number): CoreDrivers {
  return {
    ...scenario.drivers,
    ...(scenario.annualOverrides[index] ?? {}),
  };
}

export function calculateRevenue(
  previousRevenue: number,
  drivers: Pick<
    CoreDrivers,
    "volumeGrowth" | "priceGrowth" | "newBusinessRevenue" | "lostRevenue"
  >,
): number {
  return n(
    D(previousRevenue)
      .mul(D(1).plus(drivers.volumeGrowth))
      .mul(D(1).plus(drivers.priceGrowth))
      .plus(drivers.newBusinessRevenue)
      .minus(drivers.lostRevenue),
  );
}

export function calculatePersonnel(
  beginningFte: number,
  previousSalary: number,
  drivers: Pick<
    CoreDrivers,
    "hires" | "exits" | "salaryGrowth" | "benefitsRate"
  >,
): { endingFte: number; averageSalary: number; personnelCost: number } {
  const endingFte = Math.max(0, beginningFte + drivers.hires - drivers.exits);
  const averageFte = D(beginningFte).plus(endingFte).div(2);
  const averageSalary = D(previousSalary).mul(D(1).plus(drivers.salaryGrowth));
  return {
    endingFte,
    averageSalary: n(averageSalary),
    personnelCost: n(
      averageFte.mul(averageSalary).mul(D(1).plus(drivers.benefitsRate)),
    ),
  };
}

export function calculateWorkingCapital(
  revenue: number,
  cogs: number,
  drivers: Pick<CoreDrivers, "dso" | "dio" | "dpo">,
): {
  accountsReceivable: number;
  inventory: number;
  accountsPayable: number;
  netWorkingCapital: number;
} {
  const accountsReceivable = D(revenue).div(365).mul(drivers.dso);
  const inventory = D(cogs).div(365).mul(drivers.dio);
  const accountsPayable = D(cogs).div(365).mul(drivers.dpo);
  return {
    accountsReceivable: n(accountsReceivable),
    inventory: n(inventory),
    accountsPayable: n(accountsPayable),
    netWorkingCapital: n(accountsReceivable.plus(inventory).minus(accountsPayable)),
  };
}

export function calculateDebt(
  beginningDebt: number,
  drivers: Pick<
    CoreDrivers,
    "newBorrowing" | "debtRepayment" | "borrowingRate"
  >,
): { endingDebt: number; interestExpense: number } {
  const endingDebt = Decimal.max(
    0,
    D(beginningDebt).plus(drivers.newBorrowing).minus(drivers.debtRepayment),
  );
  const averageDebt = D(beginningDebt).plus(endingDebt).div(2);
  return {
    endingDebt: n(endingDebt),
    interestExpense: n(averageDebt.mul(drivers.borrowingRate)),
  };
}

export function forecastScenario(
  baseline: CompanyBaseline,
  scenario: Scenario,
  baseYear: number,
  horizon: number,
): ScenarioResult {
  const rows: ForecastRow[] = [];
  const capexVintages: Array<{ amount: Decimal; remainingYears: number; life: number }> = [];

  let previousRevenue = baseline.revenue;
  let previousFixedCost = baseline.fixedManufacturingCost;
  let previousFte = baseline.fte;
  let previousSalary = baseline.averageSalary;
  let previousSga = baseline.sga;
  let previousCash = baseline.cash;
  let previousDebt = baseline.debt;
  let previousNetPpe = baseline.netPpe;
  let previousRetainedEarnings = baseline.retainedEarnings;
  let previousNwc =
    baseline.accountsReceivable + baseline.inventory - baseline.accountsPayable;

  for (let index = 1; index <= horizon; index += 1) {
    const drivers = driversForYear(scenario, index);
    const revenue = D(calculateRevenue(previousRevenue, drivers));
    const variableCogs = revenue.mul(drivers.variableCogsRate);
    const fixedManufacturingCost = D(previousFixedCost).mul(
      D(1).plus(drivers.costInflation).minus(drivers.productivityImprovement),
    );
    const grossProfit = revenue.minus(variableCogs).minus(fixedManufacturingCost);
    const personnel = calculatePersonnel(previousFte, previousSalary, drivers);
    const sga = D(previousSga).mul(D(1).plus(drivers.sgaInflation));
    const ebitda = grossProfit.minus(personnel.personnelCost).minus(sga);
    const capex = revenue.mul(drivers.maintenanceCapexRate).plus(drivers.growthCapex);

    const existingAssetDepreciation =
      index <= 8 ? D(baseline.netPpe).div(8) : D(0);
    capexVintages.push({
      amount: capex,
      remainingYears: drivers.usefulLife,
      life: drivers.usefulLife,
    });
    let depreciation = existingAssetDepreciation;
    for (const vintage of capexVintages) {
      if (vintage.remainingYears > 0) {
        depreciation = depreciation.plus(vintage.amount.div(vintage.life));
        vintage.remainingYears -= 1;
      }
    }

    const operatingProfit = ebitda.minus(depreciation);
    const debt = calculateDebt(previousDebt, drivers);
    const preTaxIncome = operatingProfit.minus(debt.interestExpense);
    const tax = Decimal.max(preTaxIncome, 0).mul(drivers.effectiveTaxRate);
    const netIncome = preTaxIncome.minus(tax);
    const workingCapital = calculateWorkingCapital(
      n(revenue),
      n(variableCogs.plus(fixedManufacturingCost)),
      drivers,
    );
    const changeInNetWorkingCapital = D(workingCapital.netWorkingCapital).minus(
      previousNwc,
    );
    const cfo = netIncome.plus(depreciation).minus(changeInNetWorkingCapital);
    const cfi = capex.negated();
    const cff = D(drivers.newBorrowing)
      .minus(drivers.debtRepayment)
      .minus(drivers.dividends);
    const freeCashFlow = cfo.plus(cfi);
    const endingCash = D(previousCash).plus(cfo).plus(cfi).plus(cff);
    const netPpe = Decimal.max(0, D(previousNetPpe).plus(capex).minus(depreciation));
    const retainedEarnings = D(previousRetainedEarnings)
      .plus(netIncome)
      .minus(drivers.dividends);
    const totalAssets = endingCash
      .plus(workingCapital.accountsReceivable)
      .plus(workingCapital.inventory)
      .plus(netPpe)
      .plus(baseline.otherAssets);
    const totalLiabilitiesAndEquity = D(workingCapital.accountsPayable)
      .plus(debt.endingDebt)
      .plus(baseline.otherLiabilities)
      .plus(baseline.shareCapital)
      .plus(retainedEarnings);
    const investedCapital = D(debt.endingDebt)
      .plus(baseline.shareCapital)
      .plus(retainedEarnings)
      .minus(endingCash);
    const nopat = operatingProfit.mul(D(1).minus(drivers.effectiveTaxRate));
    const debtService = D(drivers.debtRepayment).plus(debt.interestExpense);

    rows.push({
      year: baseYear + index,
      revenue: n(revenue),
      variableCogs: n(variableCogs),
      fixedManufacturingCost: n(fixedManufacturingCost),
      grossProfit: n(grossProfit),
      fte: personnel.endingFte,
      averageSalary: personnel.averageSalary,
      personnelCost: personnel.personnelCost,
      sga: n(sga),
      ebitda: n(ebitda),
      depreciation: n(depreciation),
      operatingProfit: n(operatingProfit),
      interestExpense: debt.interestExpense,
      preTaxIncome: n(preTaxIncome),
      tax: n(tax),
      netIncome: n(netIncome),
      capex: n(capex),
      accountsReceivable: workingCapital.accountsReceivable,
      inventory: workingCapital.inventory,
      accountsPayable: workingCapital.accountsPayable,
      netWorkingCapital: workingCapital.netWorkingCapital,
      changeInNetWorkingCapital: n(changeInNetWorkingCapital),
      cfo: n(cfo),
      cfi: n(cfi),
      cff: n(cff),
      freeCashFlow: n(freeCashFlow),
      endingCash: n(endingCash),
      debt: debt.endingDebt,
      netPpe: n(netPpe),
      retainedEarnings: n(retainedEarnings),
      totalAssets: n(totalAssets),
      totalLiabilitiesAndEquity: n(totalLiabilitiesAndEquity),
      balanceDifference: n(totalAssets.minus(totalLiabilitiesAndEquity)),
      roic: investedCapital.gt(0) ? n(nopat.div(investedCapital)) : 0,
      dscr: debtService.gt(0) ? n(cfo.div(debtService)) : 99,
    });

    previousRevenue = n(revenue);
    previousFixedCost = n(fixedManufacturingCost);
    previousFte = personnel.endingFte;
    previousSalary = personnel.averageSalary;
    previousSga = n(sga);
    previousCash = n(endingCash);
    previousDebt = debt.endingDebt;
    previousNetPpe = n(netPpe);
    previousRetainedEarnings = n(retainedEarnings);
    previousNwc = workingCapital.netWorkingCapital;
  }

  const last = rows.at(-1)!;
  const revenueCagr =
    Math.pow(last.revenue / baseline.revenue, 1 / rows.length) - 1;
  const minimumCash = Math.min(...rows.map((row) => row.endingCash));
  const cumulativeFreeCashFlow = rows.reduce(
    (sum, row) => sum + row.freeCashFlow,
    0,
  );

  return {
    scenario,
    rows,
    kpis: {
      revenueCagr,
      ebitdaMargin: last.ebitda / last.revenue,
      operatingMargin: last.operatingProfit / last.revenue,
      minimumCash,
      netDebtToEbitda:
        last.ebitda > 0 ? (last.debt - last.endingCash) / last.ebitda : 99,
      cumulativeFreeCashFlow,
      balanceValid: rows.every((row) => Math.abs(row.balanceDifference) <= 1),
    },
  };
}

export function cloneScenario(scenario: Scenario, name: string): Scenario {
  return {
    ...scenario,
    id: `${scenario.id}-copy-${Date.now()}`,
    name,
    shortName: `${scenario.shortName} 複製`,
    drivers: { ...scenario.drivers },
    annualOverrides: Object.fromEntries(
      Object.entries(scenario.annualOverrides).map(([year, values]) => [
        Number(year),
        { ...values },
      ]),
    ),
    meta: {
      ...scenario.meta,
      status: "draft",
      updatedAt: new Date().toISOString().slice(0, 10),
    },
  };
}

export function assertBalanced(result: ScenarioResult): void {
  const invalid = result.rows.find((row) => Math.abs(row.balanceDifference) > 1);
  if (invalid) {
    throw new Error(
      `${invalid.year}年度の貸借差額が許容範囲を超えています: ${invalid.balanceDifference.toFixed(0)}円`,
    );
  }
}

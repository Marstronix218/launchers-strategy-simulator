export type ScenarioKind =
  | "as-is"
  | "downside"
  | "domestic"
  | "india"
  | "target";

export type AssumptionStatus = "approved" | "suggested" | "draft";

export interface AssumptionMeta {
  sourceName: string;
  sourceDate: string;
  confidence: "high" | "medium" | "low";
  status: AssumptionStatus;
  createdBy: string;
  updatedAt: string;
}

export interface CompanyProfile {
  name: string;
  industry: string;
  baseYear: number;
  horizon: 5 | 10;
  currency: "JPY";
  businessUnits: string[];
}

export interface CompanyBaseline {
  revenue: number;
  variableCogsRate: number;
  fixedManufacturingCost: number;
  fte: number;
  averageSalary: number;
  benefitsRate: number;
  sga: number;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  netPpe: number;
  otherAssets: number;
  accountsPayable: number;
  debt: number;
  otherLiabilities: number;
  shareCapital: number;
  retainedEarnings: number;
  dso: number;
  dio: number;
  dpo: number;
}

export interface CoreDrivers {
  volumeGrowth: number;
  priceGrowth: number;
  newBusinessRevenue: number;
  lostRevenue: number;
  variableCogsRate: number;
  costInflation: number;
  productivityImprovement: number;
  hires: number;
  exits: number;
  salaryGrowth: number;
  benefitsRate: number;
  sgaInflation: number;
  maintenanceCapexRate: number;
  growthCapex: number;
  usefulLife: number;
  dso: number;
  dio: number;
  dpo: number;
  borrowingRate: number;
  newBorrowing: number;
  debtRepayment: number;
  effectiveTaxRate: number;
  dividends: number;
}

export interface Scenario {
  id: string;
  name: string;
  shortName: string;
  kind: ScenarioKind;
  description: string;
  color: string;
  drivers: CoreDrivers;
  annualOverrides: Record<number, Partial<CoreDrivers>>;
  meta: AssumptionMeta;
}

export interface ForecastRow {
  year: number;
  revenue: number;
  variableCogs: number;
  fixedManufacturingCost: number;
  grossProfit: number;
  fte: number;
  averageSalary: number;
  personnelCost: number;
  sga: number;
  ebitda: number;
  depreciation: number;
  operatingProfit: number;
  interestExpense: number;
  preTaxIncome: number;
  tax: number;
  netIncome: number;
  capex: number;
  accountsReceivable: number;
  inventory: number;
  accountsPayable: number;
  netWorkingCapital: number;
  changeInNetWorkingCapital: number;
  cfo: number;
  cfi: number;
  cff: number;
  freeCashFlow: number;
  endingCash: number;
  debt: number;
  netPpe: number;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  balanceDifference: number;
  roic: number;
  dscr: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  rows: ForecastRow[];
  kpis: {
    revenueCagr: number;
    ebitdaMargin: number;
    operatingMargin: number;
    minimumCash: number;
    netDebtToEbitda: number;
    cumulativeFreeCashFlow: number;
    balanceValid: boolean;
  };
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  sheet: string;
  message: string;
}

export interface SensitivityResult {
  label: string;
  change: string;
  ebitdaImpact: number;
  freeCashFlowImpact: number;
  minimumCashImpact: number;
}

export interface GoalTargets {
  year5Revenue: number;
  ebitdaMargin: number;
  minimumCash: number;
}

export interface GoalSolution {
  priceGrowth: number;
  volumeGrowth: number;
  productivityImprovement: number;
  newBusinessRevenue: number;
  year5Revenue: number;
  ebitdaMargin: number;
  minimumCash: number;
  score: number;
}

export interface StrategyAction {
  category: string;
  title: string;
  rationale: string;
  impact: string;
  priority: "最優先" | "高" | "中";
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskIndicator {
  id: "cash" | "personnel" | "growth";
  label: string;
  score: number;
  weight: number;
  level: RiskLevel;
  value: string;
  summary: string;
  action: string;
}

export interface BusinessRiskAssessment {
  score: number;
  level: RiskLevel;
  label: string;
  cashShortfallYear: number | null;
  indicators: RiskIndicator[];
}

export interface IndiaInputs {
  preparationYears: number;
  initialSetupCost: number;
  localHeadcount: number;
  annualSalary: number;
  year3Revenue: number;
  grossMargin: number;
  logisticsAndTariffRate: number;
  capex: number;
  dso: number;
  exchangeRate: number;
  taxRate: number;
  hasCountryManager: boolean;
  hasAnchorCustomer: boolean;
  regulatoryBlocker: boolean;
}

export interface IndiaAssessment {
  verdict: "Go" | "Conditional Go" | "No-Go";
  score: number;
  peakFundingNeed: number;
  operatingBreakEvenYear: number | null;
  cashBreakEvenYear: number | null;
  cumulativeInvestment: number;
  reasons: string[];
  rows: Array<{
    year: number;
    revenue: number;
    ebitda: number;
    cashFlow: number;
    cumulativeCashFlow: number;
  }>;
}

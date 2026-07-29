import readXlsxFile, {
  readSheetNames,
  type Row,
} from "read-excel-file/browser";
import writeXlsxFile, {
  type Cell,
  type Sheet,
} from "write-excel-file/browser";
import type {
  CompanyBaseline,
  CompanyProfile,
  ScenarioResult,
  ValidationIssue,
} from "../types";

const REQUIRED_SHEETS = [
  "Historical_PL",
  "Historical_BS",
  "Historical_CF",
  "Business_Units",
  "Headcount",
  "Capex_Assets",
  "Debt",
  "Assumptions",
];

type Primitive = string | number | boolean | Date | null | undefined;

function makeSheet(
  sheet: string,
  headers: string[],
  rows: Primitive[][],
): Sheet<Blob> {
  const header: Cell[] = headers.map((value) => ({
    value,
    type: String,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: "#673735",
  }));
  return {
    sheet,
    data: [
      header,
      ...rows.map((row) =>
        row.map((value) => {
          if (typeof value === "number") {
            return { value, type: Number, format: "#,##0.00" };
          }
          if (typeof value === "boolean") {
            return { value, type: Boolean };
          }
          if (value instanceof Date) {
            return { value, type: Date, format: "yyyy-mm-dd" };
          }
          return value == null ? null : { value: String(value), type: String };
        }),
      ),
    ],
    columns: headers.map((headerName) => ({
      width: Math.max(14, Math.min(28, headerName.length + 4)),
    })),
    stickyRowsCount: 1,
  };
}

async function saveSheets(sheets: Sheet<Blob>[], filename: string): Promise<void> {
  await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
  }).toFile(filename);
}

export async function downloadInputTemplate(
  profile: CompanyProfile,
  baseline: CompanyBaseline,
): Promise<void> {
  const years = Array.from({ length: 5 }, (_, index) => profile.baseYear - 4 + index);
  const revenueFactors = [0.8, 0.85, 0.89, 0.95, 1];
  const sheets: Sheet<Blob>[] = [];

  sheets.push(
    makeSheet(
      "Historical_PL",
      [
        "FiscalYear",
        "Revenue",
        "VariableCOGS",
        "FixedManufacturingCost",
        "PersonnelCost",
        "SGA",
      ],
      years.map((year, index) => [
        year,
        Math.round(baseline.revenue * revenueFactors[index]),
        Math.round(
          baseline.revenue *
            revenueFactors[index] *
            baseline.variableCogsRate,
        ),
        Math.round(baseline.fixedManufacturingCost * revenueFactors[index]),
        Math.round(
          baseline.fte *
            baseline.averageSalary *
            (1 + baseline.benefitsRate) *
            revenueFactors[index],
        ),
        Math.round(baseline.sga * revenueFactors[index]),
      ]),
    ),
  );
  sheets.push(
    makeSheet(
      "Historical_BS",
      [
        "FiscalYear",
        "Cash",
        "AccountsReceivable",
        "Inventory",
        "NetPPE",
        "OtherAssets",
        "AccountsPayable",
        "Debt",
        "OtherLiabilities",
        "ShareCapital",
        "RetainedEarnings",
      ],
      years.map((year, index) => {
        const factor = revenueFactors[index];
        const assets = {
          cash: Math.round(baseline.cash * factor),
          ar: Math.round(baseline.accountsReceivable * factor),
          inventory: Math.round(baseline.inventory * factor),
          ppe: Math.round(baseline.netPpe * factor),
          other: Math.round(baseline.otherAssets * factor),
        };
        const liabilities = {
          ap: Math.round(baseline.accountsPayable * factor),
          debt: Math.round(baseline.debt * (1.12 - index * 0.03)),
          other: Math.round(baseline.otherLiabilities * factor),
          capital: baseline.shareCapital,
        };
        const retainedEarnings =
          assets.cash +
          assets.ar +
          assets.inventory +
          assets.ppe +
          assets.other -
          liabilities.ap -
          liabilities.debt -
          liabilities.other -
          liabilities.capital;
        return [
          year,
          assets.cash,
          assets.ar,
          assets.inventory,
          assets.ppe,
          assets.other,
          liabilities.ap,
          liabilities.debt,
          liabilities.other,
          liabilities.capital,
          retainedEarnings,
        ];
      }),
    ),
  );
  sheets.push(
    makeSheet(
      "Historical_CF",
      ["FiscalYear", "BeginningCash", "CFO", "CFI", "CFF", "EndingCash"],
      years.map((year, index) => {
        const endingCash = Math.round(baseline.cash * revenueFactors[index]);
        const beginningCash =
          index === 0
            ? endingCash - 10_000_000
            : Math.round(baseline.cash * revenueFactors[index - 1]);
        const cfi = -(210_000_000 + index * 20_000_000);
        const cff = -30_000_000;
        const cfo = endingCash - beginningCash - cfi - cff;
        return [year, beginningCash, cfo, cfi, cff, endingCash];
      }),
    ),
  );
  sheets.push(
    makeSheet(
      "Business_Units",
      ["FiscalYear", "BusinessUnit", "Revenue", "GrossProfit"],
      profile.businessUnits.flatMap((unit, unitIndex) =>
        years.map((year, yearIndex) => [
          year,
          unit,
          Math.round(
            baseline.revenue *
              revenueFactors[yearIndex] *
              [0.55, 0.3, 0.15][unitIndex],
          ),
          Math.round(
            baseline.revenue *
              revenueFactors[yearIndex] *
              [0.14, 0.09, 0.07][unitIndex],
          ),
        ]),
      ),
    ),
  );
  sheets.push(
    makeSheet(
      "Headcount",
      [
        "FiscalYear",
        "BusinessUnit",
        "BeginningFTE",
        "Hires",
        "Exits",
        "EndingFTE",
        "AverageSalary",
      ],
      profile.businessUnits.map((unit, index) => [
        profile.baseYear,
        unit,
        [112, 65, 37][index] ?? 0,
        [4, 3, 1][index] ?? 0,
        [3, 2, 2][index] ?? 0,
        [113, 66, 36][index] ?? 0,
        baseline.averageSalary,
      ]),
    ),
  );
  sheets.push(
    makeSheet(
      "Capex_Assets",
      [
        "FiscalYear",
        "AssetClass",
        "BeginningNBV",
        "Capex",
        "UsefulLife",
        "Depreciation",
      ],
      [
        [
          profile.baseYear,
          "Production Equipment",
          baseline.netPpe,
          230_000_000,
          8,
          190_000_000,
        ],
        [profile.baseYear, "IT_DX", 80_000_000, 65_000_000, 5, 22_000_000],
      ],
    ),
  );
  sheets.push(
    makeSheet(
      "Debt",
      [
        "Instrument",
        "BeginningDebt",
        "RateType",
        "BorrowingRate",
        "NewBorrowing",
        "Repayment",
        "MaturityYear",
      ],
      [
        [
          "Term Loan A",
          baseline.debt,
          "Fixed",
          0.018,
          0,
          90_000_000,
          profile.baseYear + 7,
        ],
      ],
    ),
  );
  sheets.push(
    makeSheet(
      "Assumptions",
      [
        "Scenario",
        "FiscalYear",
        "BusinessUnit",
        "Metric",
        "Value",
        "Unit",
        "SourceName",
        "SourceDate",
        "Confidence",
        "Status",
        "CreatedBy",
        "UpdatedAt",
      ],
      [
        [
          "As-Is",
          profile.baseYear + 1,
          "Company",
          "VolumeGrowth",
          0.012,
          "%",
          "Management Plan",
          "2026-06-30",
          "High",
          "Approved",
          "Launchers",
          "2026-07-29",
        ],
      ],
    ),
  );
  await saveSheets(sheets, "launchers_input_template.xlsx");
}

function headerIndex(headers: Row, name: string): number {
  return headers.findIndex((value) => String(value) === name);
}

function numberAt(row: Row, headers: Row, name: string): number | undefined {
  const index = headerIndex(headers, name);
  const value = index >= 0 ? row[index] : undefined;
  return typeof value === "number" ? value : undefined;
}

function validateColumns(
  issues: ValidationIssue[],
  sheet: string,
  headers: Row,
  requiredColumns: string[],
): void {
  for (const column of requiredColumns) {
    if (headerIndex(headers, column) < 0) {
      issues.push({
        severity: "error",
        sheet,
        message: `必須列 ${column} がありません。`,
      });
    }
  }
}

export async function validateAndReadWorkbook(
  file: File,
): Promise<{
  issues: ValidationIssue[];
  baselinePatch: Partial<CompanyBaseline>;
}> {
  const issues: ValidationIssue[] = [];
  const sheetNames = await readSheetNames(file);

  for (const required of REQUIRED_SHEETS) {
    if (!sheetNames.includes(required)) {
      issues.push({
        severity: "error",
        sheet: required,
        message: "必須シートがありません。",
      });
    }
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { issues, baselinePatch: {} };
  }

  const [pl, bs, cf] = await Promise.all([
    readXlsxFile(file, { sheet: "Historical_PL" }),
    readXlsxFile(file, { sheet: "Historical_BS" }),
    readXlsxFile(file, { sheet: "Historical_CF" }),
  ]);
  if (pl.length < 2 || bs.length < 2 || cf.length < 2) {
    issues.push({
      severity: "error",
      sheet: "Historical_PL / Historical_BS / Historical_CF",
      message: "実績データ行がありません。",
    });
    return { issues, baselinePatch: {} };
  }

  const plHeaders = pl[0];
  const bsHeaders = bs[0];
  const cfHeaders = cf[0];
  validateColumns(issues, "Historical_PL", plHeaders, [
    "FiscalYear",
    "Revenue",
    "VariableCOGS",
    "FixedManufacturingCost",
    "PersonnelCost",
    "SGA",
  ]);
  validateColumns(issues, "Historical_BS", bsHeaders, [
    "Cash",
    "AccountsReceivable",
    "Inventory",
    "NetPPE",
    "OtherAssets",
    "AccountsPayable",
    "Debt",
    "OtherLiabilities",
    "ShareCapital",
    "RetainedEarnings",
  ]);
  validateColumns(issues, "Historical_CF", cfHeaders, [
    "BeginningCash",
    "CFO",
    "CFI",
    "CFF",
    "EndingCash",
  ]);
  if (issues.some((issue) => issue.severity === "error")) {
    return { issues, baselinePatch: {} };
  }

  const lastPl = pl.at(-1)!;
  const lastBs = bs.at(-1)!;
  const lastCf = cf.at(-1)!;
  const assets =
    (numberAt(lastBs, bsHeaders, "Cash") ?? 0) +
    (numberAt(lastBs, bsHeaders, "AccountsReceivable") ?? 0) +
    (numberAt(lastBs, bsHeaders, "Inventory") ?? 0) +
    (numberAt(lastBs, bsHeaders, "NetPPE") ?? 0) +
    (numberAt(lastBs, bsHeaders, "OtherAssets") ?? 0);
  const liabilitiesAndEquity =
    (numberAt(lastBs, bsHeaders, "AccountsPayable") ?? 0) +
    (numberAt(lastBs, bsHeaders, "Debt") ?? 0) +
    (numberAt(lastBs, bsHeaders, "OtherLiabilities") ?? 0) +
    (numberAt(lastBs, bsHeaders, "ShareCapital") ?? 0) +
    (numberAt(lastBs, bsHeaders, "RetainedEarnings") ?? 0);
  if (Math.abs(assets - liabilitiesAndEquity) > 1) {
    issues.push({
      severity: "error",
      sheet: "Historical_BS",
      message: `最新年度の貸借が${Math.round(assets - liabilitiesAndEquity).toLocaleString("ja-JP")}円一致していません。`,
    });
  }

  const cfReconciliation =
    (numberAt(lastCf, cfHeaders, "BeginningCash") ?? 0) +
    (numberAt(lastCf, cfHeaders, "CFO") ?? 0) +
    (numberAt(lastCf, cfHeaders, "CFI") ?? 0) +
    (numberAt(lastCf, cfHeaders, "CFF") ?? 0) -
    (numberAt(lastCf, cfHeaders, "EndingCash") ?? 0);
  if (Math.abs(cfReconciliation) > 1) {
    issues.push({
      severity: "error",
      sheet: "Historical_CF",
      message: `現金増減が${Math.round(cfReconciliation).toLocaleString("ja-JP")}円一致していません。`,
    });
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { issues, baselinePatch: {} };
  }

  const revenue = numberAt(lastPl, plHeaders, "Revenue");
  const variableCogs = numberAt(lastPl, plHeaders, "VariableCOGS");
  const baselinePatch: Partial<CompanyBaseline> = {
    revenue,
    variableCogsRate:
      revenue && variableCogs ? Math.abs(variableCogs / revenue) : undefined,
    fixedManufacturingCost: numberAt(
      lastPl,
      plHeaders,
      "FixedManufacturingCost",
    ),
    sga: numberAt(lastPl, plHeaders, "SGA"),
    cash: numberAt(lastBs, bsHeaders, "Cash"),
    accountsReceivable: numberAt(lastBs, bsHeaders, "AccountsReceivable"),
    inventory: numberAt(lastBs, bsHeaders, "Inventory"),
    netPpe: numberAt(lastBs, bsHeaders, "NetPPE"),
    otherAssets: numberAt(lastBs, bsHeaders, "OtherAssets"),
    accountsPayable: numberAt(lastBs, bsHeaders, "AccountsPayable"),
    debt: numberAt(lastBs, bsHeaders, "Debt"),
    otherLiabilities: numberAt(lastBs, bsHeaders, "OtherLiabilities"),
    shareCapital: numberAt(lastBs, bsHeaders, "ShareCapital"),
    retainedEarnings: numberAt(lastBs, bsHeaders, "RetainedEarnings"),
  };
  for (const key of Object.keys(baselinePatch) as Array<
    keyof CompanyBaseline
  >) {
    if (baselinePatch[key] === undefined) delete baselinePatch[key];
  }
  issues.push({
    severity: "info",
    sheet: "全体",
    message: `${sheetNames.length}シートを検証し、最新年度の基準値を反映しました。`,
  });
  return { issues, baselinePatch };
}

export async function downloadResults(
  profile: CompanyProfile,
  results: ScenarioResult[],
): Promise<void> {
  const summaryRows = results.map((result) => {
    const year5 = result.rows[Math.min(4, result.rows.length - 1)];
    return [
      result.scenario.name,
      year5.revenue,
      year5.ebitda,
      year5.ebitda / year5.revenue,
      year5.operatingProfit,
      year5.freeCashFlow,
      year5.endingCash,
      year5.debt,
      result.kpis.minimumCash,
    ];
  });
  const sheets: Sheet<Blob>[] = [
    makeSheet(
      "Executive_Summary",
      [
        "Scenario",
        "Year5 Revenue",
        "Year5 EBITDA",
        "EBITDA Margin",
        "Operating Profit",
        "Free Cash Flow",
        "Ending Cash",
        "Debt",
        "Minimum Cash",
      ],
      summaryRows,
    ),
  ];

  for (const result of results) {
    sheets.push(
      makeSheet(
        result.scenario.shortName.slice(0, 25),
        [
          "Year",
          "Revenue",
          "GrossProfit",
          "EBITDA",
          "OperatingProfit",
          "NetIncome",
          "CFO",
          "CFI",
          "CFF",
          "FreeCashFlow",
          "EndingCash",
          "Debt",
          "TotalAssets",
          "LiabilitiesAndEquity",
          "BalanceDifference",
        ],
        result.rows.map((row) => [
          row.year,
          row.revenue,
          row.grossProfit,
          row.ebitda,
          row.operatingProfit,
          row.netIncome,
          row.cfo,
          row.cfi,
          row.cff,
          row.freeCashFlow,
          row.endingCash,
          row.debt,
          row.totalAssets,
          row.totalLiabilitiesAndEquity,
          row.balanceDifference,
        ]),
      ),
    );
  }
  sheets.push(
    makeSheet(
      "Assumptions_Audit",
      [
        "Scenario",
        "Metric",
        "Value",
        "Source",
        "SourceDate",
        "Confidence",
        "Status",
        "CreatedBy",
        "UpdatedAt",
        "ModelVersion",
      ],
      results.flatMap((result) =>
        Object.entries(result.scenario.drivers).map(([metric, value]) => [
          result.scenario.name,
          metric,
          value,
          result.scenario.meta.sourceName,
          result.scenario.meta.sourceDate,
          result.scenario.meta.confidence,
          result.scenario.meta.status,
          result.scenario.meta.createdBy,
          result.scenario.meta.updatedAt,
          "0.1.0",
        ]),
      ),
    ),
  );
  await saveSheets(
    sheets,
    `${profile.name.replace(/[\\/:*?"<>|]/g, "_")}_strategy_results.xlsx`,
  );
}

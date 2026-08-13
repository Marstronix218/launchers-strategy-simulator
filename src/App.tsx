import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  CircleGauge,
  ClipboardList,
  Clock3,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  FileOutput,
  FileSpreadsheet,
  Flag,
  Globe2,
  Info,
  Landmark,
  Layers3,
  Menu,
  PanelLeftClose,
  PieChart,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  LogOut,
  LoaderCircle,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  defaultIndiaInputs,
  defaultScenarios,
  historicalData,
  sampleBaseline,
  sampleProfile,
} from "./data/sample";
import {
  assessBusinessRisk,
  assessIndia,
  deriveStrategyActions,
  goalSeek,
  runSensitivity,
} from "./finance/analysis";
import { cloneScenario, forecastScenario } from "./finance/engine";
import type {
  CompanyBaseline,
  CompanyProfile,
  CoreDrivers,
  GoalTargets,
  IndiaInputs,
  Scenario,
  ValidationIssue,
} from "./types";
import {
  formatMultiple,
  formatPercent,
  formatYen,
  signedYen,
} from "./utils/format";
import { useAuth } from "./platform/auth";
import {
  loadOrCreateWorkspace,
  saveWorkspace,
  uploadSourceFile,
  type StoredWorkspace,
} from "./platform/repository";
import {
  requestAIReview,
  runAuthoritativeForecast,
} from "./platform/api";
import type { AIInsight, AIReviewMode } from "./ai/schema";
import {
  addCompletedStep,
  onboardingStepIndex,
  onboardingSteps,
  validCompletedSteps,
  type DataOrigin,
  type OnboardingStepId,
} from "./onboarding";

type Screen =
  | "diagnosis"
  | "setup"
  | "import"
  | "historical"
  | "assumptions"
  | "scenarios"
  | "statements"
  | "insights"
  | "gap"
  | "india"
  | "export";

type Brand = "launchers" | "go-india" | "india-biz";

const brandLabels: Record<Brand, { name: string; short: string }> = {
  launchers: { name: "Capital Launchers", short: "Launchers" },
  "go-india": { name: "Go India", short: "Go India" },
  "india-biz": { name: "インドビズ", short: "インドビズ" },
};

const navGroups: Array<{
  label: string;
  items: Array<{
    id: Screen;
    label: string;
    icon: typeof Building2;
  }>;
}> = [
  {
    label: "準備",
    items: [
      { id: "diagnosis", label: "無料簡易診断", icon: CircleGauge },
      { id: "setup", label: "プロジェクト設定", icon: Building2 },
      { id: "import", label: "データ取込", icon: Database },
      { id: "historical", label: "過去実績", icon: BarChart3 },
    ],
  },
  {
    label: "シミュレーション",
    items: [
      { id: "assumptions", label: "前提条件", icon: Settings2 },
      { id: "scenarios", label: "シナリオ", icon: Layers3 },
      { id: "statements", label: "財務三表", icon: FileSpreadsheet },
      { id: "insights", label: "経営インサイト", icon: CircleGauge },
    ],
  },
  {
    label: "戦略",
    items: [
      { id: "gap", label: "戦略ギャップ", icon: Target },
      { id: "india", label: "India Go / No-Go", icon: Globe2 },
      { id: "export", label: "レポート出力", icon: FileOutput },
    ],
  },
];

const screenTitles: Record<Screen, { eyebrow: string; title: string; description: string }> = {
  diagnosis: {
    eyebrow: "Free business diagnosis · β",
    title: "経営の危険信号を、3分で可視化",
    description: "確定計算による5年・10年予測と、3指標の危険度を確認します。",
  },
  setup: {
    eyebrow: "Project setup",
    title: "診断プロジェクトを設定",
    description: "企業情報とモデル期間を定義します。",
  },
  import: {
    eyebrow: "Data import & mapping",
    title: "実績データを取り込む",
    description: "標準Excelを使い、計算前に整合性を検証します。",
  },
  historical: {
    eyebrow: "Historical dashboard",
    title: "5年間の実績を読む",
    description: "成長・収益・資金の構造変化を確認します。",
  },
  assumptions: {
    eyebrow: "Assumption center",
    title: "前提条件を管理",
    description: "計算に使うドライバー、出典、承認状態を一元管理します。",
  },
  scenarios: {
    eyebrow: "Scenario builder",
    title: "選択肢を比較可能にする",
    description: "現状延長から目標逆算まで、同じ計算式で比較します。",
  },
  statements: {
    eyebrow: "Financial statements",
    title: "財務三表を確認",
    description: "PL・BS・CFのつながりと貸借一致を年度ごとに検証します。",
  },
  insights: {
    eyebrow: "Insight dashboard",
    title: "経営の分岐点をつかむ",
    description: "シナリオ差と主要ドライバーの影響を意思決定につなげます。",
  },
  gap: {
    eyebrow: "Strategy gap",
    title: "数値ギャップを施策へ変換",
    description: "目標達成に必要な改善を、優先アクションに落とします。",
  },
  india: {
    eyebrow: "India Go / No-Go",
    title: "インド参入を条件付きで判定",
    description: "点数だけでなく、重大条件と資金耐久力でゲート判定します。",
  },
  export: {
    eyebrow: "Report export",
    title: "経営会議の資料を出力",
    description: "数値、前提、出典、モデルバージョンを一体で残します。",
  },
};

const driverFields: Array<{
  key: keyof CoreDrivers;
  label: string;
  unit: "%" | "日" | "億円" | "人" | "年";
  step: number;
  min: number;
  max: number;
  group: string;
}> = [
  { key: "volumeGrowth", label: "数量成長率", unit: "%", step: 0.1, min: -5, max: 10, group: "売上" },
  { key: "priceGrowth", label: "価格上昇率", unit: "%", step: 0.1, min: -2, max: 8, group: "売上" },
  { key: "newBusinessRevenue", label: "新規事業売上", unit: "億円", step: 0.1, min: 0, max: 10, group: "売上" },
  { key: "variableCogsRate", label: "変動原価率", unit: "%", step: 0.1, min: 25, max: 60, group: "原価・人員" },
  { key: "productivityImprovement", label: "生産性改善率", unit: "%", step: 0.1, min: 0, max: 8, group: "原価・人員" },
  { key: "salaryGrowth", label: "平均給与上昇率", unit: "%", step: 0.1, min: 0, max: 8, group: "原価・人員" },
  { key: "hires", label: "年間採用", unit: "人", step: 1, min: 0, max: 30, group: "原価・人員" },
  { key: "maintenanceCapexRate", label: "維持投資率", unit: "%", step: 0.1, min: 0, max: 8, group: "投資・資金" },
  { key: "growthCapex", label: "成長投資", unit: "億円", step: 0.1, min: 0, max: 8, group: "投資・資金" },
  { key: "dso", label: "売掛回収日数", unit: "日", step: 1, min: 20, max: 120, group: "投資・資金" },
  { key: "borrowingRate", label: "借入金利", unit: "%", step: 0.1, min: 0, max: 8, group: "投資・資金" },
];

const tooltipStyle = {
  background: "#5d302f",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
};

async function downloadInputTemplate(
  profile: CompanyProfile,
  baseline: CompanyBaseline,
): Promise<void> {
  const excel = await import("./ingestion/excel");
  await excel.downloadInputTemplate(profile, baseline);
}

async function downloadResults(
  profile: CompanyProfile,
  results: ReturnType<typeof forecastScenario>[],
): Promise<void> {
  const excel = await import("./ingestion/excel");
  await excel.downloadResults(profile, results);
}

function driverDisplayValue(value: number, unit: string): number {
  if (unit === "%") return value * 100;
  if (unit === "億円") return value / 100_000_000;
  return value;
}

function driverRawValue(value: number, unit: string): number {
  if (unit === "%") return value / 100;
  if (unit === "億円") return value * 100_000_000;
  return value;
}

function StatusPill({ status }: { status: Scenario["meta"]["status"] }) {
  const config = {
    approved: { label: "承認済み", icon: BadgeCheck },
    suggested: { label: "要承認", icon: Sparkles },
    draft: { label: "下書き", icon: Clock3 },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`status-pill ${status}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  meta,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  meta: string;
  tone?: "default" | "positive" | "warning";
  icon: typeof TrendingUp;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-label">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>{meta}</p>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={24} /></div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const onboardingStorageBaseKey = "launchers:onboarding:v1";

function onboardingStorageKey(userId?: string): string {
  return `${onboardingStorageBaseKey}:${userId ?? "demo"}`;
}

function readOnboardingProgress(storageKey: string): OnboardingStepId[] {
  try {
    return validCompletedSteps(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return [];
  }
}

function OnboardingGuide({
  screen,
  completed,
  hasImportedData,
  importBlocked,
  onStep,
  onContinue,
  onUseSample,
  onClose,
}: {
  screen: Screen;
  completed: readonly OnboardingStepId[];
  hasImportedData: boolean;
  importBlocked: boolean;
  onStep: (screen: Screen) => void;
  onContinue: () => void;
  onUseSample: () => void;
  onClose: () => void;
}) {
  const activeIndex = onboardingStepIndex(screen);
  const completeCount = completed.length;
  const currentStep = onboardingSteps[activeIndex];
  const stepIcons = [Building2, Database, Settings2, BarChart3];
  const continueLabels = [
    screen === "diagnosis" ? "会社情報から始める" : "設定を確定して次へ",
    hasImportedData ? "取込データで前提を確認" : "サンプルで前提を試す",
    "前提を承認して結果を見る",
    screen === "insights"
      ? completeCount === onboardingSteps.length ? "ガイドを閉じる" : "オンボーディングを完了"
      : "診断結果を見る",
  ];
  const continueDisabled = activeIndex === 1 && importBlocked;

  return (
    <section className="onboarding-guide" aria-label="はじめての方向け4ステップガイド">
      <div className="onboarding-head">
        <div>
          <span className="section-kicker">Quick start · 約5分</span>
          <h2>まずは4ステップで診断結果まで進みましょう</h2>
          <p>必要な項目だけを順番に確認します。後からサイドメニューで詳しく調整できます。</p>
        </div>
        <div className="onboarding-progress-copy" aria-live="polite">
          <strong>{completeCount} / {onboardingSteps.length}</strong>
          <span>完了</span>
        </div>
        <button className="icon-button small" onClick={onClose} aria-label="はじめ方ガイドを閉じる">
          <X size={16} />
        </button>
      </div>
      <div
        className="onboarding-progress"
        role="progressbar"
        aria-label="オンボーディング進捗"
        aria-valuemin={0}
        aria-valuemax={onboardingSteps.length}
        aria-valuenow={completeCount}
      >
        <span style={{ width: `${(completeCount / onboardingSteps.length) * 100}%` }} />
      </div>
      <div className="onboarding-steps">
        {onboardingSteps.map((step, index) => {
          const Icon = stepIcons[index];
          const isComplete = completed.includes(step.id);
          const isActive = index === activeIndex;
          return (
            <button
              key={step.id}
              className={`onboarding-step ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
              onClick={() => onStep(step.screen as Screen)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="onboarding-step-icon">
                {isComplete ? <Check size={17} /> : <Icon size={17} />}
              </span>
              <span>
                <small>STEP {index + 1}</small>
                <strong>{step.title}</strong>
                <em>{step.description}</em>
              </span>
            </button>
          );
        })}
      </div>
      <div className="onboarding-next">
        <div>
          <span>現在地</span>
          <strong>STEP {activeIndex + 1}：{currentStep.title}</strong>
          {continueDisabled && <small>Excelのエラーを修正してから続けてください。</small>}
        </div>
        <div className="onboarding-next-actions">
          {continueDisabled && (
            <button className="button secondary" onClick={onUseSample}>
              エラーを破棄してサンプルで続ける
            </button>
          )}
          <button className="button primary" onClick={onContinue} disabled={continueDisabled}>
            {continueLabels[activeIndex]} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function App() {
  const auth = useAuth();
  const [screen, setScreen] = useState<Screen>("diagnosis");
  const [brand, setBrand] = useState<Brand>("launchers");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 1100,
  );
  const [profile, setProfile] = useState(sampleProfile);
  const [baseline, setBaseline] = useState(sampleBaseline);
  const [scenarios, setScenarios] = useState(defaultScenarios);
  const [selectedScenarioId, setSelectedScenarioId] = useState("as-is");
  const [statementTab, setStatementTab] = useState<"pl" | "bs" | "cf">("pl");
  const [importIssues, setImportIssues] = useState<ValidationIssue[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [goalTargets, setGoalTargets] = useState<GoalTargets>({
    year5Revenue: 7_000_000_000,
    ebitdaMargin: 0.1,
    minimumCash: 300_000_000,
  });
  const [indiaInputs, setIndiaInputs] = useState(defaultIndiaInputs);
  const [workspace, setWorkspace] = useState<StoredWorkspace | null>(null);
  const [cloudState, setCloudState] = useState<
    "demo" | "loading" | "ready" | "saving" | "saved" | "error"
  >(auth.session ? "loading" : "demo");
  const [cloudMessage, setCloudMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiMode, setAiMode] = useState<AIReviewMode>("executive_summary");
  const [dataOrigin, setDataOrigin] = useState<DataOrigin>("sample");
  const progressStorageKey = onboardingStorageKey(auth.user?.id);
  const [completedOnboarding, setCompletedOnboarding] = useState<OnboardingStepId[]>(
    () => readOnboardingProgress(progressStorageKey),
  );
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => readOnboardingProgress(progressStorageKey).length < onboardingSteps.length,
  );
  const progressScope = useRef(progressStorageKey);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (progressScope.current !== progressStorageKey) return;
    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(completedOnboarding));
    } catch {
      // Progress persistence is optional; the guide still works for this session.
    }
  }, [completedOnboarding, progressStorageKey]);

  useEffect(() => {
    if (progressScope.current === progressStorageKey) return;
    const storedProgress = readOnboardingProgress(progressStorageKey);
    progressScope.current = progressStorageKey;
    setCompletedOnboarding(storedProgress);
    setOnboardingOpen(storedProgress.length < onboardingSteps.length);
  }, [progressStorageKey]);

  useEffect(() => {
    if (!auth.session || auth.demoMode) {
      return;
    }
    let active = true;
    const companyName =
      typeof auth.session.user.user_metadata.company_name === "string"
        ? auth.session.user.user_metadata.company_name.trim()
        : "";
    const fallbackProfile = companyName
      ? { ...sampleProfile, name: companyName }
      : sampleProfile;
    loadOrCreateWorkspace(fallbackProfile)
      .then((stored) => {
        if (!active) return;
        setWorkspace(stored);
        setProfile(stored.profile ?? fallbackProfile);
        if (stored.baseline) setBaseline(stored.baseline);
        setDataOrigin(stored.dataOrigin ?? "sample");
        if (stored.scenarios?.length) setScenarios(stored.scenarios);
        if (stored.selectedScenarioId) {
          setSelectedScenarioId(stored.selectedScenarioId);
        }
        if (stored.goalTargets) setGoalTargets(stored.goalTargets);
        if (stored.indiaInputs) setIndiaInputs(stored.indiaInputs);
        setCloudState("ready");
        setCloudMessage("クラウドと同期済み");
      })
      .catch((caught) => {
        if (!active) return;
        setCloudState("error");
        setCloudMessage(
          caught instanceof Error ? caught.message : "ワークスペースを読み込めませんでした。",
        );
      });
    return () => {
      active = false;
    };
  }, [auth.demoMode, auth.session]);

  const results = useMemo(
    () =>
      scenarios.map((scenario) =>
        forecastScenario(baseline, scenario, profile.baseYear, profile.horizon),
      ),
    [baseline, profile.baseYear, profile.horizon, scenarios],
  );
  const selectedResult =
    results.find((result) => result.scenario.id === selectedScenarioId) ?? results[0];
  const selectedScenario = selectedResult.scenario;
  const asIsResult = results.find((result) => result.scenario.kind === "as-is")!;
  const targetResult = results.find((result) => result.scenario.kind === "target")!;
  const sensitivity = useMemo(
    () =>
      runSensitivity(
        baseline,
        selectedScenario,
        profile.baseYear,
        profile.horizon,
      ),
    [baseline, profile.baseYear, profile.horizon, selectedScenario],
  );
  const solutions = useMemo(
    () => goalSeek(baseline, asIsResult.scenario, profile.baseYear, goalTargets),
    [asIsResult.scenario, baseline, goalTargets, profile.baseYear],
  );
  const actions = useMemo(
    () => deriveStrategyActions(asIsResult, targetResult),
    [asIsResult, targetResult],
  );
  const businessRisk = useMemo(
    () => assessBusinessRisk(asIsResult, goalTargets.year5Revenue),
    [asIsResult, goalTargets.year5Revenue],
  );
  const indiaAssessment = useMemo(
    () => assessIndia(indiaInputs, profile.baseYear),
    [indiaInputs, profile.baseYear],
  );

  const scenarioChartData = useMemo(
    () =>
      selectedResult.rows.map((row, index) => ({
        year: `${String(row.year).slice(2)}年度`,
        ...Object.fromEntries(
          results.map((result) => [
            result.scenario.shortName,
            Math.round(result.rows[index].revenue / 100_000_000),
          ]),
        ),
      })),
    [results, selectedResult.rows],
  );
  const cashChartData = selectedResult.rows.map((row) => ({
    year: `${String(row.year).slice(2)}年`,
    cash: row.endingCash / 100_000_000,
    debt: row.debt / 100_000_000,
    fcf: row.freeCashFlow / 100_000_000,
  }));
  const year5 = selectedResult.rows[Math.min(4, selectedResult.rows.length - 1)];

  function updateProfile<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function markOnboardingStep(step: OnboardingStepId) {
    setCompletedOnboarding((current) => addCompletedStep(current, step));
  }

  function handleOnboardingContinue() {
    const stepIndex = onboardingStepIndex(screen);
    if (stepIndex === 0) {
      if (screen === "diagnosis") {
        setScreen("setup");
        return;
      }
      markOnboardingStep("profile");
      setScreen("import");
      return;
    }
    if (stepIndex === 1) {
      if (importIssues.some((issue) => issue.severity === "error")) return;
      markOnboardingStep("data");
      setScreen("assumptions");
      return;
    }
    if (stepIndex === 2) {
      approveScenario();
      setScreen("insights");
      return;
    }
    if (screen !== "insights") {
      setScreen("insights");
      return;
    }
    markOnboardingStep("results");
    setOnboardingOpen(false);
  }

  function continueOnboardingWithSample() {
    setImportIssues([]);
    setBaseline(sampleBaseline);
    setDataOrigin("sample");
    markOnboardingStep("data");
    setScreen("assumptions");
  }

  function updateDriver(key: keyof CoreDrivers, value: number) {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === selectedScenarioId
          ? {
              ...scenario,
              drivers: { ...scenario.drivers, [key]: value },
              meta: {
                ...scenario.meta,
                status: "draft",
                updatedAt: new Date().toISOString().slice(0, 10),
              },
            }
          : scenario,
      ),
    );
  }

  function approveScenario() {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === selectedScenarioId
          ? {
              ...scenario,
              meta: {
                ...scenario.meta,
                status: "approved",
                updatedAt: new Date().toISOString().slice(0, 10),
              },
            }
          : scenario,
      ),
    );
    markOnboardingStep("assumptions");
  }

  function duplicateScenario(scenario: Scenario) {
    const copy = cloneScenario(scenario, `${scenario.name} — Copy`);
    setScenarios((current) => [...current, copy]);
    setSelectedScenarioId(copy.id);
    setScreen("assumptions");
  }

  async function handleCloudSave() {
    if (!auth.session || !workspace) {
      setCloudMessage("デモモードではブラウザ内だけに保持されます。");
      return;
    }
    setCloudState("saving");
    setCloudMessage("保存とサーバー再計算を実行中…");
    try {
      await saveWorkspace(
        workspace,
        profile,
        baseline,
        scenarios,
        selectedScenarioId,
        goalTargets,
        indiaInputs,
        dataOrigin,
      );
      await runAuthoritativeForecast(auth.session.access_token, {
        projectId: workspace.projectId,
        profile,
        baseline,
        scenario: selectedScenario,
      });
      setCloudState("saved");
      setCloudMessage("保存・再計算・監査記録が完了しました");
      window.setTimeout(() => setCloudState("ready"), 2400);
    } catch (caught) {
      setCloudState("error");
      setCloudMessage(
        caught instanceof Error ? caught.message : "クラウド保存に失敗しました。",
      );
    }
  }

  async function handleAIReview(mode: AIReviewMode = "executive_summary") {
    setAiMode(mode);
    setAiOpen(true);
    setAiError("");
    setAiInsight(null);
    if (!auth.session || !workspace) {
      setAiError("AIレビューはSupabaseにログインし、保存したワークスペースで利用できます。");
      return;
    }
    setAiLoading(true);
    try {
      const response = await requestAIReview(auth.session.access_token, {
        projectId: workspace.projectId,
        scenarioExternalId: selectedScenario.id,
        mode,
        context: {
          company: {
            industry: profile.industry,
            baseYear: profile.baseYear,
            horizon: profile.horizon,
          },
          selectedScenario: {
            id: selectedScenario.id,
            name: selectedScenario.name,
            status: selectedScenario.meta.status,
            drivers: selectedScenario.drivers,
            kpis: selectedResult.kpis,
            forecast: selectedResult.rows,
          },
          sensitivity: sensitivity.slice(0, 8),
          strategyActions: actions,
          indiaAssessment,
          instruction:
            "数値は確定済み計算結果です。再計算せず、根拠を示して解釈してください。",
        },
      });
      setAiInsight(response.insight);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "AIレビューに失敗しました。");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setIsImporting(true);
    try {
      const { validateAndReadWorkbook } = await import("./ingestion/excel");
      const { issues, baselinePatch } = await validateAndReadWorkbook(file);
      setImportIssues(issues);
      if (!issues.some((issue) => issue.severity === "error")) {
        setBaseline((current) => ({ ...current, ...baselinePatch }));
        setDataOrigin("imported");
        markOnboardingStep("data");
      }
      if (workspace && auth.session) {
        try {
          await uploadSourceFile(workspace, file, issues);
          setCloudMessage("原本と検証結果を安全に保存しました");
        } catch (caught) {
          setCloudState("error");
          setCloudMessage(
            caught instanceof Error ? caught.message : "原本の保存に失敗しました。",
          );
        }
      }
    } catch {
      setImportIssues([
        {
          severity: "error",
          sheet: file.name,
          message: "Excelファイルを解析できませんでした。標準テンプレートを確認してください。",
        },
      ]);
    } finally {
      setIsImporting(false);
    }
  }

  const title = screenTitles[screen];

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div className="brand-copy">
            <strong>{brandLabels[brand].short}</strong>
            <span>Strategy Simulator</span>
          </div>
          <button
            className="icon-button collapse-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="サイドバーを閉じる"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={screen === item.id ? "nav-item active" : "nav-item"}
                    onClick={() => {
                      setScreen(item.id);
                      if (window.innerWidth <= 1100) setSidebarOpen(false);
                    }}
                    title={item.label}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="model-status">
            <div className="status-dot" />
            <div>
              <strong>Model v0.1.0</strong>
              <span>貸借一致・計算正常</span>
            </div>
            <ShieldCheck size={18} />
          </div>
          <button
            className="consultant-chip"
            onClick={() => {
              if (auth.session) void auth.signOut();
              else if (auth.configured) auth.exitDemo();
            }}
            aria-label={auth.session ? "ログアウト" : auth.configured ? "ログイン画面へ戻る" : "デモワークスペース"}
            title={auth.session ? "ログアウト" : auth.configured ? "ログインして保存を有効にする" : undefined}
          >
            <span>{auth.user?.email?.slice(0, 2).toUpperCase() ?? "NL"}</span>
            <div>
              <strong>{auth.user?.email ?? "Demo workspace"}</strong>
              <small>{workspace?.role ?? (auth.demoMode ? "Demo" : "Member")}</small>
            </div>
            {auth.session ? (
              <LogOut size={15} />
            ) : (
              <ChevronDown size={15} />
            )}
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          className="sidebar-open-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="メニューを開く"
        >
          <Menu size={20} />
        </button>
      )}

      <main>
        <header className="topbar">
          <div className="project-context">
            <span className="project-avatar">{profile.name.slice(0, 1)}</span>
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.baseYear}年度基準 · {profile.horizon}年計画</span>
            </div>
          </div>
          <div className="topbar-actions">
            <div
              className={`cloud-status ${cloudState}`}
              title={cloudMessage}
              role="status"
            >
              {cloudState === "loading" || cloudState === "saving" ? (
                <LoaderCircle className="spin" size={15} />
              ) : cloudState === "demo" || cloudState === "error" ? (
                <CloudOff size={15} />
              ) : (
                <Cloud size={15} />
              )}
              <span>
                {cloudState === "demo"
                  ? "デモ"
                  : cloudState === "saving"
                    ? "保存中"
                    : cloudState === "error"
                      ? "同期エラー"
                      : "クラウド"}
              </span>
            </div>
            <button
              className="button save-button"
              onClick={() => void handleCloudSave()}
              disabled={!auth.session || cloudState === "saving" || cloudState === "loading"}
              title={!auth.session ? "ログインするとクラウド保存を利用できます" : cloudMessage}
            >
              <Save size={16} /> 保存
            </button>
            <label className="scenario-select">
              <span style={{ background: selectedScenario.color }} />
              <select
                value={selectedScenarioId}
                onChange={(event) => setSelectedScenarioId(event.target.value)}
                aria-label="表示シナリオ"
              >
                {scenarios.map((scenario) => (
                  <option value={scenario.id} key={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <StatusPill status={selectedScenario.meta.status} />
            <button className="icon-button" aria-label="検索">
              <Search size={18} />
            </button>
          </div>
        </header>

        <div className="page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{title.eyebrow}</span>
              <h1>{title.title}</h1>
              <p>{title.description}</p>
            </div>
            <div className="heading-actions">
              {!onboardingOpen && (
                <button className="button secondary" onClick={() => setOnboardingOpen(true)}>
                  <BookOpenCheck size={16} /> はじめ方
                </button>
              )}
              {(screen === "insights" || screen === "gap" || screen === "india") && (
                <button
                  className="button ai-button"
                  onClick={() =>
                    void handleAIReview(
                      screen === "india"
                        ? "india_review"
                        : screen === "gap"
                          ? "strategy_actions"
                          : "executive_summary",
                    )
                  }
                >
                  <Bot size={16} /> AIレビュー
                </button>
              )}
              {screen === "assumptions" && (
                <>
                  <button className="button secondary" onClick={() => setScenarios(defaultScenarios)}>
                    <RefreshCw size={16} /> 初期値へ戻す
                  </button>
                  <button className="button primary" onClick={approveScenario}>
                    <Check size={16} /> 前提を承認
                  </button>
                </>
              )}
              {screen === "insights" && (
                <button className="button primary" onClick={() => setScreen("export")}>
                  <FileOutput size={16} /> レポートを作成
                </button>
              )}
            </div>
          </div>

          {onboardingOpen && (
            <OnboardingGuide
              screen={screen}
              completed={completedOnboarding}
              hasImportedData={dataOrigin === "imported"}
              importBlocked={importIssues.some((issue) => issue.severity === "error")}
              onStep={setScreen}
              onContinue={handleOnboardingContinue}
              onUseSample={continueOnboardingWithSample}
              onClose={() => setOnboardingOpen(false)}
            />
          )}

          {screen === "setup" && (
            <SetupScreen profile={profile} updateProfile={updateProfile} />
          )}
          {screen === "diagnosis" && (
            <DiagnosisScreen
              brand={brand}
              setBrand={setBrand}
              profile={profile}
              baseline={baseline}
              result={asIsResult}
              risk={businessRisk}
              targetRevenue={goalTargets.year5Revenue}
              hasImportedData={dataOrigin === "imported"}
              setScreen={setScreen}
            />
          )}
          {screen === "import" && (
            <ImportScreen
              profile={profile}
              baseline={baseline}
              issues={importIssues}
              importing={isImporting}
              onFile={handleFile}
              onBrowse={() => fileInput.current?.click()}
            />
          )}
          {screen === "historical" && <HistoricalScreen />}
          {screen === "assumptions" && (
            <AssumptionsScreen
              scenario={selectedScenario}
              onChange={updateDriver}
            />
          )}
          {screen === "scenarios" && (
            <ScenariosScreen
              results={results}
              selectedId={selectedScenarioId}
              onSelect={(id) => {
                setSelectedScenarioId(id);
                setScreen("insights");
              }}
              onDuplicate={duplicateScenario}
            />
          )}
          {screen === "statements" && (
            <StatementsScreen
              result={selectedResult}
              tab={statementTab}
              setTab={setStatementTab}
            />
          )}
          {screen === "insights" && (
            <InsightsScreen
              selectedResult={selectedResult}
              results={results}
              scenarioChartData={scenarioChartData}
              cashChartData={cashChartData}
              sensitivity={sensitivity}
              year5={year5}
              setScreen={setScreen}
            />
          )}
          {screen === "gap" && (
            <GapScreen
              asIs={asIsResult}
              target={targetResult}
              actions={actions}
              targets={goalTargets}
              setTargets={setGoalTargets}
              solutions={solutions}
            />
          )}
          {screen === "india" && (
            <IndiaScreen
              inputs={indiaInputs}
              setInputs={setIndiaInputs}
              assessment={indiaAssessment}
            />
          )}
          {screen === "export" && (
            <ExportScreen
              profile={profile}
              baseline={baseline}
              results={results}
            />
          )}
        </div>
      </main>
      {(auth.demoMode || cloudState === "error") && (
        <div className={`environment-banner ${cloudState === "error" ? "error" : ""}`}>
          {cloudState === "error" ? <CloudOff size={16} /> : <Info size={16} />}
          <span>
            {cloudState === "error"
              ? cloudMessage
              : "デモモード：サンプルや取込データは保存されません。"}
          </span>
          {auth.demoMode && auth.configured && (
            <button className="text-button" onClick={auth.exitDemo}>
              ログインして保存を有効にする <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
      <AIReviewDrawer
        open={aiOpen}
        loading={aiLoading}
        mode={aiMode}
        insight={aiInsight}
        error={aiError}
        onClose={() => setAiOpen(false)}
        onRetry={() => void handleAIReview(aiMode)}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}

function AIReviewDrawer({
  open,
  loading,
  mode,
  insight,
  error,
  onClose,
  onRetry,
}: {
  open: boolean;
  loading: boolean;
  mode: AIReviewMode;
  insight: AIInsight | null;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (!open) return null;
  const modeLabels: Record<AIReviewMode, string> = {
    account_mapping: "勘定科目マッピング",
    anomaly_explanation: "異常値の説明",
    scenario_narrative: "シナリオ解説",
    strategy_actions: "戦略アクション",
    india_review: "India Go / No-Go",
    executive_summary: "経営サマリー",
  };
  return (
    <div className="ai-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="ai-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="AIレビュー"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ai-drawer-head">
          <div>
            <span className="section-kicker"><Sparkles size={14} /> AI review</span>
            <h2>{modeLabels[mode]}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="閉じる">
            <X size={19} />
          </button>
        </div>
        <div className="ai-drawer-body">
          {loading && (
            <div className="ai-loading">
              <LoaderCircle className="spin" size={24} />
              <strong>確定済みの計算結果を分析しています…</strong>
              <span>AIは数値を再計算せず、根拠と示唆を整理します。</span>
            </div>
          )}
          {error && (
            <div className="ai-error">
              <AlertCircle size={20} />
              <div><strong>レビューを実行できませんでした</strong><p>{error}</p></div>
              <button className="button secondary" onClick={onRetry}>再試行</button>
            </div>
          )}
          {insight && (
            <>
              <div className="ai-summary"><p>{insight.summary}</p></div>
              <section className="ai-section">
                <h3>主要な観察</h3>
                {insight.observations.map((item) => (
                  <article className="ai-item" key={`${item.title}-${item.evidence}`}>
                    <div><strong>{item.title}</strong><span className={`confidence ${item.confidence}`}>{item.confidence}</span></div>
                    <p>{item.evidence}</p>
                  </article>
                ))}
              </section>
              <section className="ai-section">
                <h3>推奨アクション</h3>
                {insight.recommendations.map((item) => (
                  <article className="ai-item recommendation" key={`${item.title}-${item.rationale}`}>
                    <div><strong>{item.title}</strong><span className={`priority ${item.priority}`}>{item.priority}</span></div>
                    <p>{item.rationale}</p>
                    <small>{item.financialLink}</small>
                  </article>
                ))}
              </section>
              {insight.followUpQuestions.length > 0 && (
                <section className="ai-section">
                  <h3>次に確認すること</h3>
                  <ul>{insight.followUpQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                </section>
              )}
              <p className="ai-disclaimer">{insight.disclaimer}</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function DiagnosisScreen({
  brand,
  setBrand,
  profile,
  baseline,
  result,
  risk,
  targetRevenue,
  hasImportedData,
  setScreen,
}: {
  brand: Brand;
  setBrand: (brand: Brand) => void;
  profile: CompanyProfile;
  baseline: CompanyBaseline;
  result: ReturnType<typeof forecastScenario>;
  risk: ReturnType<typeof assessBusinessRisk>;
  targetRevenue: number;
  hasImportedData: boolean;
  setScreen: (screen: Screen) => void;
}) {
  const riskIcons = {
    cash: WalletCards,
    personnel: UsersRound,
    growth: TrendingUp,
  };
  const chartData = result.rows.map((row) => ({
    year: String(row.year),
    revenue: Math.round(row.revenue / 100_000_000),
    cash: Math.round(row.endingCash / 100_000_000),
  }));
  const year5 = result.rows[Math.min(4, result.rows.length - 1)];

  return (
    <div className="diagnosis-stack">
      <section className="diagnosis-hero">
        <div className="diagnosis-hero-copy">
          <div className="beta-line">
            <span className="beta-badge">2026年10月 β</span>
            <label className="brand-switcher">
              <span>表示ブランド</span>
              <select
                value={brand}
                onChange={(event) => setBrand(event.target.value as Brand)}
              >
                {Object.entries(brandLabels).map(([id, item]) => (
                  <option key={id} value={id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={`diagnosis-data-source ${hasImportedData ? "imported" : "sample"}`}>
            {hasImportedData ? <BadgeCheck size={15} /> : <Info size={15} />}
            <span>
              <strong>{hasImportedData ? "自社データで表示中" : "サンプルデータで表示中"}</strong>
              {hasImportedData
                ? "取り込んだ財務データをもとに再計算しています。"
                : "画面の流れを試せます。自社の診断結果にするには会社情報とExcelを設定してください。"}
            </span>
          </div>
          <span className="diagnosis-kicker">{brandLabels[brand].name} AI事業計画診断</span>
          <h2>
            {hasImportedData ? profile.name : "サンプル企業"}の<br />
            経営リスクを診断しました
          </h2>
          <p>
            過去実績と承認済み前提から、将来の資金・人員・成長ギャップを
            同じ計算式で判定しています。
          </p>
          <div className="diagnosis-actions">
            <button className="button diagnosis-primary" onClick={() => setScreen("setup")}>
              <ClipboardList size={16} /> 自社データで診断を始める
            </button>
            <button className="button diagnosis-secondary" onClick={() => setScreen("export")}>
              <FileOutput size={16} /> レポートを見る
            </button>
          </div>
          <small><ShieldCheck size={13} /> AIは財務数値を再計算しません。確定計算の解釈にのみ使用します。</small>
        </div>
        <div className={`risk-score-card ${risk.level}`}>
          <span>総合危険度</span>
          <div
            className="risk-score-ring"
            style={{ "--risk-score": `${risk.score * 3.6}deg` } as React.CSSProperties}
          >
            <div><strong>{risk.score}</strong><small>/ 100</small></div>
          </div>
          <b>{risk.label}</b>
          <p>
            {risk.level === "high"
              ? "資金対策を最優先で具体化してください。"
              : risk.level === "medium"
                ? "成長と固定費のバランスに注意が必要です。"
                : "現時点で重大な危険信号はありません。"}
          </p>
        </div>
      </section>

      <section>
        <div className="diagnosis-section-heading">
          <div>
            <span>Risk ranking</span>
            <h2>優先して見るべき3つの危険信号</h2>
          </div>
          <p>資金45% · 人件費30% · 成長ギャップ25%</p>
        </div>
        <div className="risk-grid">
          {[...risk.indicators]
            .sort((a, b) => b.score - a.score)
            .map((indicator, index) => {
              const Icon = riskIcons[indicator.id];
              return (
                <article className={`risk-card ${indicator.level}`} key={indicator.id}>
                  <div className="risk-card-top">
                    <span className="risk-rank">0{index + 1}</span>
                    <div className="risk-icon"><Icon size={20} /></div>
                    <span className="risk-level">{indicator.level === "high" ? "高" : indicator.level === "medium" ? "中" : "低"}</span>
                  </div>
                  <h3>{indicator.label}</h3>
                  <strong>{indicator.value}</strong>
                  <p>{indicator.summary}</p>
                  <div className="risk-action"><ArrowRight size={14} /> {indicator.action}</div>
                </article>
              );
            })}
        </div>
      </section>

      <div className="diagnosis-two-column">
        <section className="panel diagnosis-chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">5 / 10 year forecast</span>
              <h2>売上と期末現金の見通し</h2>
            </div>
            <span className="unit-caption">億円</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="diagnosisRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c92f3e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#c92f3e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eee5e3" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" name="売上" stroke="#c92f3e" fill="url(#diagnosisRevenue)" strokeWidth={3} />
              <Line type="monotone" dataKey="cash" name="期末現金" stroke="#4f718f" strokeWidth={2} dot={false} />
              <ReferenceLine y={0} stroke="#d1495b" strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
        <section className="panel gap-summary-panel">
          <span className="section-kicker">Ideal → reality</span>
          <h2>5年後の目標ギャップ</h2>
          <div className="gap-big-number">
            <span>売上不足額</span>
            <strong>{formatYen(Math.max(0, targetRevenue - year5.revenue))}</strong>
          </div>
          <dl>
            <div><dt>5年後予測</dt><dd>{formatYen(year5.revenue)}</dd></div>
            <div><dt>5年後目標</dt><dd>{formatYen(targetRevenue)}</dd></div>
            <div><dt>営業CF</dt><dd>{formatYen(year5.cfo)}</dd></div>
            <div><dt>従業員数</dt><dd>{Math.round(year5.fte)}名</dd></div>
          </dl>
          <button className="text-button" onClick={() => setScreen("gap")}>
            目標達成の積み上げを見る <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <section className="mvp-scope-panel">
        <div>
          <span className="section-kicker">MVP scope</span>
          <h2>β版で約束する範囲</h2>
          <p>入力負荷を抑え、計測可能なコア機能に限定します。</p>
        </div>
        <div className="scope-column">
          <strong>INPUT</strong>
          <div className="scope-tags">
            <span>会社基本情報</span><span>過去3期財務</span>
            <span>売上3セグメント</span><span>成長アサンプション</span>
          </div>
          <button className="text-button" onClick={() => setScreen("import")}>
            財務データを取り込む <ArrowRight size={14} />
          </button>
        </div>
        <div className="scope-column">
          <strong>OUTPUT</strong>
          <ul>
            <li><Check size={14} /> 5年・10年の簡易財務予測</li>
            <li><Check size={14} /> 資金ショート警告と危険度</li>
            <li><Check size={14} /> 理想と現実のギャップ</li>
          </ul>
        </div>
        <div className="scope-column out-scope">
          <strong>NEXT PHASE</strong>
          <ul>
            <li>アニメ調コンサルUI</li>
            <li>具体企業・M&amp;A候補の提示</li>
            <li>インド企業リストの動的分析</li>
          </ul>
        </div>
      </section>

      <section className="india-bridge">
        <div className="india-bridge-icon"><Globe2 size={24} /></div>
        <div>
          <span className="section-kicker">India module · MVP</span>
          <h2>インド連動は「売上比率の感度分析」まで</h2>
          <p>市場成長率レンジと注目セグメントを参考情報として提示し、個別企業紹介は相談CTAへ分離します。</p>
        </div>
        <button className="button diagnosis-secondary" onClick={() => setScreen("india")}>
          India仮説を確認 <ArrowUpRight size={15} />
        </button>
      </section>

      <p className="beta-disclaimer">
        β版は経営判断を支援する試算ツールです。会計・税務・投資判断を代替するものではありません。
        入力データの利用目的と保管期間は同意画面で明示します。
      </p>
      <span className="diagnosis-data-note">
        基準値：売上 {formatYen(baseline.revenue)} · 現金 {formatYen(baseline.cash)} · {profile.baseYear}年度
      </span>
    </div>
  );
}

function SetupScreen({
  profile,
  updateProfile,
}: {
  profile: CompanyProfile;
  updateProfile: <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) => void;
}) {
  const [unitDraft, setUnitDraft] = useState("");
  return (
    <div className="two-column-grid setup-grid">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">企業情報</span>
            <h2>基本設定</h2>
          </div>
          <span className="step-badge">1 / 3</span>
        </div>
        <div className="form-grid">
          <label className="field full">
            <span>会社名</span>
            <input
              value={profile.name}
              onChange={(event) => updateProfile("name", event.target.value)}
            />
          </label>
          <label className="field full">
            <span>業種</span>
            <select
              value={profile.industry}
              onChange={(event) => updateProfile("industry", event.target.value)}
            >
              <option>産業機械・精密部品製造</option>
              <option>卸売</option>
              <option>B2Bサービス</option>
              <option>その他製造業</option>
            </select>
          </label>
          <label className="field">
            <span>基準年度</span>
            <input
              type="number"
              value={profile.baseYear}
              onChange={(event) => updateProfile("baseYear", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>予測期間</span>
            <div className="segmented">
              {[5, 10].map((horizon) => (
                <button
                  key={horizon}
                  className={profile.horizon === horizon ? "active" : ""}
                  onClick={() => updateProfile("horizon", horizon as 5 | 10)}
                >
                  {horizon}年
                </button>
              ))}
            </div>
          </label>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">モデル範囲</span>
            <h2>事業部門</h2>
          </div>
          <span className="count-badge">{profile.businessUnits.length}部門</span>
        </div>
        <div className="unit-list">
          {profile.businessUnits.map((unit, index) => (
            <div className="unit-row" key={unit}>
              <span className="unit-number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{unit}</strong>
              <button
                className="icon-button small"
                onClick={() =>
                  updateProfile(
                    "businessUnits",
                    profile.businessUnits.filter((item) => item !== unit),
                  )
                }
                aria-label={`${unit}を削除`}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="inline-add">
          <input
            placeholder="部門名を入力"
            value={unitDraft}
            onChange={(event) => setUnitDraft(event.target.value)}
          />
          <button
            className="button secondary"
            onClick={() => {
              if (!unitDraft.trim()) return;
              updateProfile("businessUnits", [...profile.businessUnits, unitDraft.trim()]);
              setUnitDraft("");
            }}
          >
            <Plus size={15} /> 追加
          </button>
        </div>
        <div className="notice subtle">
          <Info size={16} />
          初期版では単体企業・最大10事業部門を対象とします。
        </div>
      </section>
    </div>
  );
}

function ImportScreen({
  profile,
  baseline,
  issues,
  importing,
  onFile,
  onBrowse,
}: {
  profile: CompanyProfile;
  baseline: CompanyBaseline;
  issues: ValidationIssue[];
  importing: boolean;
  onFile: (file?: File) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="stack">
      <div className="import-layout">
        <section
          className="upload-panel"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onFile(event.dataTransfer.files[0]);
          }}
        >
          <div className="upload-icon"><UploadCloud size={28} /></div>
          <h2>{importing ? "ファイルを検証中…" : "標準Excelをここにドロップ"}</h2>
          <p>Historical PL / BS / CFと主要ドライバーをまとめて検証します。</p>
          <button className="button primary" onClick={onBrowse} disabled={importing}>
            <FileSpreadsheet size={17} /> ファイルを選択
          </button>
          <span className="file-note">.xlsx · 最大10MB</span>
        </section>
        <section className="panel template-panel">
          <div className="template-illustration">
            <FileSpreadsheet size={32} />
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="section-kicker">初めての方</span>
          <h2>標準テンプレート</h2>
          <p>必要な8シート、入力例、監査項目を含むExcelです。</p>
          <button
            className="button secondary full-button"
            onClick={() => downloadInputTemplate(profile, baseline)}
          >
            <Download size={16} /> テンプレートをダウンロード
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Validation</span>
            <h2>データ整合性チェック</h2>
          </div>
          {issues.length > 0 && (
            <span className="count-badge">
              {issues.filter((issue) => issue.severity === "error").length} errors
            </span>
          )}
        </div>
        {issues.length === 0 ? (
          <EmptyState
            icon={BookOpenCheck}
            title="ファイル待機中"
            text="取込後、欠損・符号・貸借・キャッシュ増減をここで確認できます。"
          />
        ) : (
          <div className="issue-list">
            {issues.map((issue, index) => (
              <div className={`issue-row ${issue.severity}`} key={`${issue.sheet}-${index}`}>
                {issue.severity === "error" ? (
                  <AlertCircle size={18} />
                ) : issue.severity === "warning" ? (
                  <Info size={18} />
                ) : (
                  <BadgeCheck size={18} />
                )}
                <div>
                  <strong>{issue.sheet}</strong>
                  <span>{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HistoricalScreen() {
  return (
    <div className="stack">
      <div className="metric-grid four">
        <MetricCard icon={TrendingUp} label="売上 CAGR" value="5.9%" meta="過去5年間" tone="positive" />
        <MetricCard icon={PieChart} label="EBITDAマージン" value="8.0%" meta="+0.1pt YoY" />
        <MetricCard icon={UsersRound} label="従業員数" value="214名" meta="+16名 / 5年" />
        <MetricCard icon={WalletCards} label="ネットデット" value="5.3億円" meta="-3.7億円 / 5年" tone="positive" />
      </div>
      <div className="two-column-grid chart-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Growth & profit</span>
              <h2>売上とEBITDA</h2>
            </div>
            <span className="unit-caption">百万円</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={historicalData}>
              <CartesianGrid stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" name="売上" fill="#b9d3c7" radius={[5, 5, 0, 0]} />
              <Line dataKey="ebitda" name="EBITDA" stroke="#c6903d" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Capital structure</span>
              <h2>現金・借入・設備投資</h2>
            </div>
            <span className="unit-caption">百万円</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line dataKey="cash" name="現金" stroke="#95514b" strokeWidth={3} dot={false} />
              <Line dataKey="debt" name="借入" stroke="#c45b4d" strokeWidth={3} dot={false} />
              <Line dataKey="capex" name="設備投資" stroke="#735d9d" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel driver-observation">
        <div className="observation-icon"><Sparkles size={19} /></div>
        <div>
          <span className="section-kicker">Consultant observation</span>
          <h3>売上は伸びていますが、利益率の改善は限定的です。</h3>
          <p>賃金上昇と設備更新負担を価格転嫁が吸収しきれていません。次の5年は「成長率」よりも「単価・生産性・運転資本」の組み合わせが重要です。</p>
        </div>
        <button className="text-button">根拠を見る <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}

function AssumptionsScreen({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (key: keyof CoreDrivers, value: number) => void;
}) {
  const groups = [...new Set(driverFields.map((field) => field.group))];
  return (
    <div className="assumptions-layout">
      <section className="panel assumptions-table">
        <div className="assumption-summary">
          <div>
            <span className="scenario-dot" style={{ background: scenario.color }} />
            <div>
              <strong>{scenario.name}</strong>
              <p>{scenario.description}</p>
            </div>
          </div>
          <StatusPill status={scenario.meta.status} />
        </div>
        {groups.map((group) => (
          <div className="driver-group" key={group}>
            <div className="driver-group-title">{group}</div>
            {driverFields
              .filter((field) => field.group === group)
              .map((field) => {
                const display = driverDisplayValue(
                  Number(scenario.drivers[field.key]),
                  field.unit,
                );
                return (
                  <div className="driver-row" key={field.key}>
                    <label htmlFor={field.key}>{field.label}</label>
                    <input
                      id={field.key}
                      className="driver-range"
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={display}
                      onChange={(event) =>
                        onChange(
                          field.key,
                          driverRawValue(Number(event.target.value), field.unit),
                        )
                      }
                    />
                    <div className="number-input">
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={Number(display.toFixed(2))}
                        onChange={(event) =>
                          onChange(
                            field.key,
                            driverRawValue(Number(event.target.value), field.unit),
                          )
                        }
                      />
                      <span>{field.unit}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </section>
      <aside className="assumption-audit">
        <section className="panel">
          <span className="section-kicker">Audit trail</span>
          <h2>前提の根拠</h2>
          <dl className="audit-list">
            <div><dt>出典</dt><dd>{scenario.meta.sourceName}</dd></div>
            <div><dt>基準日</dt><dd>{scenario.meta.sourceDate}</dd></div>
            <div><dt>確度</dt><dd>{scenario.meta.confidence.toUpperCase()}</dd></div>
            <div><dt>作成者</dt><dd>{scenario.meta.createdBy}</dd></div>
            <div><dt>最終更新</dt><dd>{scenario.meta.updatedAt}</dd></div>
          </dl>
        </section>
        <section className="panel formula-card">
          <div className="formula-icon"><Zap size={18} /></div>
          <span className="section-kicker">Formula</span>
          <h3>売上計算</h3>
          <code>
            前年売上 × (1 + 数量成長率)<br />
            × (1 + 価格上昇率)<br />
            + 新規事業売上 − 喪失売上
          </code>
          <p>同じ入力からは常に同じ結果を返します。AIは計算に使用しません。</p>
        </section>
      </aside>
    </div>
  );
}

function ScenariosScreen({
  results,
  selectedId,
  onSelect,
  onDuplicate,
}: {
  results: ReturnType<typeof forecastScenario>[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDuplicate: (scenario: Scenario) => void;
}) {
  return (
    <div className="stack">
      <div className="scenario-card-grid">
        {results.map((result) => {
          const row = result.rows[Math.min(4, result.rows.length - 1)];
          return (
            <article
              className={`scenario-card ${selectedId === result.scenario.id ? "selected" : ""}`}
              key={result.scenario.id}
              style={{ "--scenario": result.scenario.color } as React.CSSProperties}
            >
              <div className="scenario-card-head">
                <span className="scenario-initial">{result.scenario.shortName.slice(0, 1)}</span>
                <StatusPill status={result.scenario.meta.status} />
              </div>
              <h2>{result.scenario.name}</h2>
              <p>{result.scenario.description}</p>
              <div className="scenario-metrics">
                <div><span>5年後売上</span><strong>{formatYen(row.revenue)}</strong></div>
                <div><span>EBITDA率</span><strong>{formatPercent(row.ebitda / row.revenue)}</strong></div>
                <div><span>最低現金</span><strong className={result.kpis.minimumCash < 0 ? "negative" : ""}>{formatYen(result.kpis.minimumCash)}</strong></div>
              </div>
              <div className="scenario-card-actions">
                <button className="button secondary" onClick={() => onDuplicate(result.scenario)}>
                  <Copy size={15} /> 複製
                </button>
                <button className="text-button" onClick={() => onSelect(result.scenario.id)}>
                  詳細 <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
        <button className="new-scenario-card" onClick={() => onDuplicate(results[0].scenario)}>
          <span><Plus size={22} /></span>
          <strong>シナリオを追加</strong>
          <p>既存シナリオを複製して調整</p>
        </button>
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <strong>比較可能性を保つためのルール</strong>
          <span>すべてのシナリオは同じ実績値・計算式・モデルバージョンを使用しています。</span>
        </div>
      </div>
    </div>
  );
}

function StatementsScreen({
  result,
  tab,
  setTab,
}: {
  result: ReturnType<typeof forecastScenario>;
  tab: "pl" | "bs" | "cf";
  setTab: (tab: "pl" | "bs" | "cf") => void;
}) {
  const rows =
    tab === "pl"
      ? [
          ["売上高", "revenue"],
          ["売上総利益", "grossProfit"],
          ["人件費", "personnelCost"],
          ["販管費", "sga"],
          ["EBITDA", "ebitda"],
          ["減価償却費", "depreciation"],
          ["営業利益", "operatingProfit"],
          ["税引前利益", "preTaxIncome"],
          ["税金", "tax"],
          ["当期純利益", "netIncome"],
        ]
      : tab === "bs"
        ? [
            ["現預金", "endingCash"],
            ["売掛金", "accountsReceivable"],
            ["在庫", "inventory"],
            ["固定資産", "netPpe"],
            ["資産合計", "totalAssets"],
            ["買掛金", "accountsPayable"],
            ["有利子負債", "debt"],
            ["利益剰余金", "retainedEarnings"],
            ["負債・純資産合計", "totalLiabilitiesAndEquity"],
            ["貸借差額", "balanceDifference"],
          ]
        : [
            ["営業キャッシュフロー", "cfo"],
            ["設備投資", "cfi"],
            ["財務キャッシュフロー", "cff"],
            ["フリーキャッシュフロー", "freeCashFlow"],
            ["期末現金残高", "endingCash"],
          ];
  return (
    <div className="stack">
      <section className="panel statement-panel">
        <div className="statement-toolbar">
          <div className="tabs">
            {[
              ["pl", "損益計算書 PL"],
              ["bs", "貸借対照表 BS"],
              ["cf", "キャッシュフロー CF"],
            ].map(([id, label]) => (
              <button
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id as "pl" | "bs" | "cf")}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="unit-caption">単位：億円</span>
        </div>
        <div className="table-scroll">
          <table className="financial-table">
            <thead>
              <tr>
                <th>勘定科目</th>
                {result.rows.map((row) => <th key={row.year}>{row.year}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr
                  key={key}
                  className={["revenue", "ebitda", "operatingProfit", "netIncome", "totalAssets", "totalLiabilitiesAndEquity", "endingCash"].includes(key) ? "emphasis" : ""}
                >
                  <th>{label}</th>
                  {result.rows.map((row) => {
                    const value = Number(row[key as keyof typeof row]);
                    return (
                      <td className={value < 0 ? "negative" : ""} key={row.year}>
                        {(value / 100_000_000).toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="statement-checks">
        <div className="check-card valid">
          <BadgeCheck size={21} />
          <div><strong>貸借一致</strong><span>全年度 ±1円以内</span></div>
        </div>
        <div className="check-card valid">
          <BadgeCheck size={21} />
          <div><strong>現金増減一致</strong><span>CFと期末残高が連動</span></div>
        </div>
        <div className="check-card">
          <Info size={21} />
          <div><strong>計算式を追跡可能</strong><span>数値 → 式 → 前提 → 出典</span></div>
        </div>
      </div>
    </div>
  );
}

function InsightsScreen({
  selectedResult,
  results,
  scenarioChartData,
  cashChartData,
  sensitivity,
  year5,
  setScreen,
}: {
  selectedResult: ReturnType<typeof forecastScenario>;
  results: ReturnType<typeof forecastScenario>[];
  scenarioChartData: Array<Record<string, string | number>>;
  cashChartData: Array<Record<string, string | number>>;
  sensitivity: ReturnType<typeof runSensitivity>;
  year5: ReturnType<typeof forecastScenario>["rows"][number];
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="stack">
      <div className="insight-banner">
        <div>
          <span className="section-kicker light">Management signal</span>
          <h2>
            現状延長では売上は伸びる一方、<br />
            <em>5年後の利益率は目標に届きません。</em>
          </h2>
          <p>価格・生産性・運転資本を同時に動かすことで、投資余力を維持した成長が可能です。</p>
        </div>
        <button className="button light-button" onClick={() => setScreen("gap")}>
          戦略ギャップを見る <ArrowRight size={16} />
        </button>
        <div className="banner-orbit orbit-one" />
        <div className="banner-orbit orbit-two" />
      </div>
      <div className="metric-grid four">
        <MetricCard icon={TrendingUp} label="5年後売上" value={formatYen(year5.revenue)} meta={`CAGR ${formatPercent(selectedResult.kpis.revenueCagr)}`} tone="positive" />
        <MetricCard icon={CircleDollarSign} label="EBITDAマージン" value={formatPercent(year5.ebitda / year5.revenue)} meta={`営業利益率 ${formatPercent(year5.operatingProfit / year5.revenue)}`} />
        <MetricCard icon={WalletCards} label="最低現金残高" value={formatYen(selectedResult.kpis.minimumCash)} meta={selectedResult.kpis.minimumCash < 0 ? "資金不足の対策が必要" : "最低基準を充足"} tone={selectedResult.kpis.minimumCash < 0 ? "warning" : "positive"} />
        <MetricCard icon={Landmark} label="Net Debt / EBITDA" value={formatMultiple(selectedResult.kpis.netDebtToEbitda)} meta={`累積FCF ${formatYen(selectedResult.kpis.cumulativeFreeCashFlow)}`} />
      </div>
      <div className="two-column-grid chart-grid wide-left">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Scenario comparison</span>
              <h2>シナリオ別 売上推移</h2>
            </div>
            <span className="unit-caption">億円</span>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={scenarioChartData}>
              <CartesianGrid stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip contentStyle={tooltipStyle} />
              {results.map((result) => (
                <Line
                  key={result.scenario.id}
                  dataKey={result.scenario.shortName}
                  stroke={result.scenario.color}
                  strokeWidth={result.scenario.id === selectedResult.scenario.id ? 3.5 : 1.8}
                  strokeDasharray={result.scenario.kind === "downside" ? "5 4" : undefined}
                  dot={false}
                />
              ))}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Liquidity</span>
              <h2>現金と借入の推移</h2>
            </div>
            <span className="unit-caption">億円</span>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={cashChartData}>
              <defs>
                <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#95514b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#95514b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="#c45b4d" />
              <Area dataKey="cash" name="現金" stroke="#95514b" fill="url(#cashFill)" strokeWidth={3} />
              <Line dataKey="debt" name="借入" stroke="#c45b4d" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel sensitivity-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Sensitivity</span>
            <h2>5年後EBITDAへの影響</h2>
          </div>
          <span className="unit-caption">基準シナリオ比</span>
        </div>
        <div className="sensitivity-list">
          {[...sensitivity]
            .sort((a, b) => Math.abs(b.ebitdaImpact) - Math.abs(a.ebitdaImpact))
            .map((item) => {
              const max = Math.max(...sensitivity.map((row) => Math.abs(row.ebitdaImpact)), 1);
              return (
                <div className="sensitivity-row" key={item.label}>
                  <div><strong>{item.label}</strong><span>{item.change}</span></div>
                  <div className="impact-track">
                    <i
                      className={item.ebitdaImpact >= 0 ? "positive" : "negative"}
                      style={{ width: `${Math.max(4, (Math.abs(item.ebitdaImpact) / max) * 100)}%` }}
                    />
                  </div>
                  <strong className={item.ebitdaImpact >= 0 ? "positive-text" : "negative"}>
                    {signedYen(item.ebitdaImpact)}
                  </strong>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function GapScreen({
  asIs,
  target,
  actions,
  targets,
  setTargets,
  solutions,
}: {
  asIs: ReturnType<typeof forecastScenario>;
  target: ReturnType<typeof forecastScenario>;
  actions: ReturnType<typeof deriveStrategyActions>;
  targets: GoalTargets;
  setTargets: (targets: GoalTargets) => void;
  solutions: ReturnType<typeof goalSeek>;
}) {
  const asIsYear5 = asIs.rows[4];
  const targetYear5 = target.rows[4];
  const gapData = [
    { label: "売上", asIs: asIsYear5.revenue / 100_000_000, target: targetYear5.revenue / 100_000_000 },
    { label: "EBITDA", asIs: asIsYear5.ebitda / 100_000_000, target: targetYear5.ebitda / 100_000_000 },
    { label: "現金", asIs: asIsYear5.endingCash / 100_000_000, target: targetYear5.endingCash / 100_000_000 },
  ];
  return (
    <div className="stack">
      <div className="gap-top-grid">
        <section className="panel goal-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">Goal seek</span><h2>5年後の到達目標</h2></div>
            <Target size={22} />
          </div>
          <div className="goal-inputs">
            <label><span>売上</span><div><input type="number" value={targets.year5Revenue / 100_000_000} onChange={(event) => setTargets({ ...targets, year5Revenue: Number(event.target.value) * 100_000_000 })} /><small>億円</small></div></label>
            <label><span>EBITDAマージン</span><div><input type="number" value={targets.ebitdaMargin * 100} onChange={(event) => setTargets({ ...targets, ebitdaMargin: Number(event.target.value) / 100 })} /><small>%</small></div></label>
            <label><span>最低現金</span><div><input type="number" value={targets.minimumCash / 100_000_000} onChange={(event) => setTargets({ ...targets, minimumCash: Number(event.target.value) * 100_000_000 })} /><small>億円</small></div></label>
          </div>
          <div className="solution-count"><BadgeCheck size={17} /> 制約内の実行可能解：<strong>{solutions.length}件</strong></div>
        </section>
        <section className="panel gap-chart">
          <div className="panel-heading">
            <div><span className="section-kicker">Gap overview</span><h2>As-Is vs Target</h2></div>
            <span className="unit-caption">億円</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gapData} layout="vertical">
              <CartesianGrid stroke="#e7e2d8" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={65} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="asIs" name="As-Is" fill="#b9c4bf" radius={[0, 5, 5, 0]} />
              <Bar dataKey="target" name="Target" fill="#c6903d" radius={[0, 5, 5, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">Feasible combinations</span><h2>目標を満たす前提の組み合わせ</h2></div>
          <span className="unit-caption">実行負荷が低い順</span>
        </div>
        {solutions.length ? (
          <div className="solution-table-wrap">
            <table className="solution-table">
              <thead><tr><th>順位</th><th>価格</th><th>数量</th><th>生産性</th><th>新規売上</th><th>5年後売上</th><th>EBITDA率</th><th>最低現金</th></tr></thead>
              <tbody>
                {solutions.slice(0, 5).map((solution, index) => (
                  <tr key={`${solution.score}-${index}`}>
                    <td><span className="rank">{index + 1}</span></td>
                    <td>{formatPercent(solution.priceGrowth)}</td>
                    <td>{formatPercent(solution.volumeGrowth)}</td>
                    <td>{formatPercent(solution.productivityImprovement)}</td>
                    <td>{formatYen(solution.newBusinessRevenue)}</td>
                    <td>{formatYen(solution.year5Revenue)}</td>
                    <td>{formatPercent(solution.ebitdaMargin)}</td>
                    <td>{formatYen(solution.minimumCash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Target} title="制約内に解がありません" text="目標値を調整するか、投資・資金調達の制約を見直してください。" />
        )}
      </section>
      <section>
        <div className="section-heading-row">
          <div><span className="section-kicker">Priority actions</span><h2>優先施策</h2></div>
          <span>ルールベースで数値ギャップから生成</span>
        </div>
        <div className="action-grid">
          {actions.map((action, index) => (
            <article className="action-card" key={action.title}>
              <div className="action-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="action-card-head"><span>{action.category}</span><b className={`priority p-${action.priority}`}>{action.priority}</b></div>
              <h3>{action.title}</h3>
              <p>{action.rationale}</p>
              <div className="action-impact"><ArrowUpRight size={16} /><strong>{action.impact}</strong></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function IndiaScreen({
  inputs,
  setInputs,
  assessment,
}: {
  inputs: IndiaInputs;
  setInputs: (inputs: IndiaInputs) => void;
  assessment: ReturnType<typeof assessIndia>;
}) {
  const chartData = assessment.rows.map((row) => ({
    year: `${String(row.year).slice(2)}年`,
    revenue: row.revenue / 100_000_000,
    ebitda: row.ebitda / 100_000_000,
    cumulative: row.cumulativeCashFlow / 100_000_000,
  }));
  return (
    <div className="stack">
      <div className="india-hero">
        <div className="verdict-block">
          <span className="section-kicker light">Current verdict</span>
          <div className={`verdict ${assessment.verdict.toLowerCase().replace(" ", "-")}`}>
            {assessment.verdict}
          </div>
          <p>総合スコア <strong>{assessment.score}</strong> / 100</p>
        </div>
        <div className="verdict-reasons">
          <span className="section-kicker light">判定理由</span>
          {assessment.reasons.slice(0, 4).map((reason) => (
            <div key={reason}>
              {reason.includes("未") || reason.includes("重大") ? <AlertCircle size={17} /> : <Check size={17} />}
              {reason}
            </div>
          ))}
        </div>
        <div className="funding-stat">
          <span>最大資金需要</span>
          <strong>{formatYen(assessment.peakFundingNeed)}</strong>
          <small>累積CF黒字化：{assessment.cashBreakEvenYear ?? "10年超"}</small>
        </div>
      </div>
      <div className="india-layout">
        <section className="panel india-inputs">
          <div className="panel-heading"><div><span className="section-kicker">Critical gates</span><h2>重大条件</h2></div><Flag size={20} /></div>
          {[
            ["hasCountryManager", "現地責任者を確保", "事業立上げの単独責任者"],
            ["hasAnchorCustomer", "アンカー顧客候補あり", "初期売上の検証可能性"],
            ["regulatoryBlocker", "重大な法規制障害あり", "該当時はNo-Go候補"],
          ].map(([key, label, note]) => (
            <label className="toggle-row" key={key}>
              <div><strong>{label}</strong><span>{note}</span></div>
              <input
                type="checkbox"
                checked={Boolean(inputs[key as keyof IndiaInputs])}
                onChange={(event) => setInputs({ ...inputs, [key]: event.target.checked })}
              />
              <i />
            </label>
          ))}
          <div className="divider" />
          <span className="section-kicker">Financial inputs</span>
          <div className="compact-input-grid">
            {[
              ["initialSetupCost", "初期準備費", "億円", 100_000_000],
              ["capex", "現地設備投資", "億円", 100_000_000],
              ["year3Revenue", "3年目売上", "億円", 100_000_000],
              ["grossMargin", "粗利率", "%", 0.01],
              ["localHeadcount", "現地人員", "名", 1],
              ["dso", "回収日数", "日", 1],
            ].map(([key, label, unit, divisor]) => (
              <label className="field" key={String(key)}>
                <span>{label}</span>
                <div className="suffix-input">
                  <input
                    type="number"
                    value={Number(inputs[key as keyof IndiaInputs]) / Number(divisor)}
                    onChange={(event) => setInputs({ ...inputs, [key]: Number(event.target.value) * Number(divisor) })}
                  />
                  <small>{unit}</small>
                </div>
              </label>
            ))}
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading"><div><span className="section-kicker">10-year outlook</span><h2>インド事業の立上がり</h2></div><span className="unit-caption">億円</span></div>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="#9f8f7a" />
              <Bar dataKey="revenue" name="売上" fill="#cfc4dd" radius={[5, 5, 0, 0]} />
              <Line dataKey="ebitda" name="EBITDA" stroke="#c6903d" strokeWidth={2.5} dot={false} />
              <Line dataKey="cumulative" name="累積CF" stroke="#95514b" strokeWidth={3} dot={false} />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="india-milestones">
            <div><span>単年度黒字</span><strong>{assessment.operatingBreakEvenYear ?? "—"}</strong></div>
            <div><span>累積CF黒字</span><strong>{assessment.cashBreakEvenYear ?? "—"}</strong></div>
            <div><span>累積投資</span><strong>{formatYen(assessment.cumulativeInvestment)}</strong></div>
          </div>
        </section>
      </div>
      <div className="notice warning">
        <AlertCircle size={19} />
        <div><strong>判定ルール</strong><span>現地責任者、初期顧客仮説、重大規制、資金耐久力のいずれかが未充足の場合、総合点が高くてもConditional GoまたはNo-Goになります。</span></div>
      </div>
    </div>
  );
}

function ExportScreen({
  profile,
  baseline,
  results,
}: {
  profile: CompanyProfile;
  baseline: CompanyBaseline;
  results: ReturnType<typeof forecastScenario>[];
}) {
  const exportCards = [
    { icon: FileSpreadsheet, title: "統合Excelモデル", text: "全シナリオの財務三表、前提条件、監査情報", tag: ".xlsx", action: () => downloadResults(profile, results) },
    { icon: ClipboardList, title: "経営者向けサマリー", text: "5年後の姿、主要ギャップ、優先施策を1ページに集約", tag: "準備中", action: undefined },
    { icon: BriefcaseBusiness, title: "経営会議パック", text: "シナリオ比較、感応度、India判定のスライド構成", tag: "準備中", action: undefined },
  ];
  return (
    <div className="stack">
      <div className="export-grid">
        {exportCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`export-card ${!card.action ? "muted" : ""}`} key={card.title}>
              <div className="export-icon"><Icon size={26} /></div>
              <span className="export-tag">{card.tag}</span>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <button className="button secondary full-button" onClick={card.action} disabled={!card.action}>
                <ArrowDownToLine size={16} /> {card.action ? "ダウンロード" : "次期リリース"}
              </button>
            </article>
          );
        })}
      </div>
      <section className="panel export-preview">
        <div className="report-cover">
          <div className="mini-brand"><span>L</span> LAUNCHERS</div>
          <div>
            <span>STRATEGY SIMULATION REPORT</span>
            <h2>{profile.name}</h2>
            <p>{profile.baseYear + 1}—{profile.baseYear + profile.horizon} 事業成長シミュレーション</p>
          </div>
          <small>Prepared by Launchers · Model v0.1.0</small>
        </div>
        <div className="export-checklist">
          <span className="section-kicker">Included in export</span>
          <h2>追跡可能な意思決定記録</h2>
          {[
            "5シナリオの財務三表",
            "全前提の出典・承認状態",
            "貸借一致・CF整合性チェック",
            "感応度と目標逆算結果",
            "モデルバージョンと更新日",
          ].map((item) => <div key={item}><Check size={16} />{item}</div>)}
          <button className="button primary" onClick={() => downloadInputTemplate(profile, baseline)}>
            <Download size={16} /> 入力テンプレートも保存
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  LineChart as LineChartIcon,
  LockKeyhole,
  MessageCircle,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EBITDA_MULTIPLE,
  calculateQuickDiagnosis,
  type DiagnosisFinancials,
  type DiagnosisMetric,
  type DiagnosisPeriod,
  type QuickDiagnosisResult,
} from "./quickDiagnosis";
import { requestDiagnosisInsight } from "./ai/diagnosisClient";
import type { DiagnosisInsight } from "./ai/diagnosisSchema";

type FinancialDraft = Record<DiagnosisPeriod, Record<DiagnosisMetric, string>>;

const periods: Array<{ id: DiagnosisPeriod; label: string; note: string }> = [
  { id: "twoYearsAgo", label: "前々期", note: "2年前" },
  { id: "previousYear", label: "前期", note: "1年前" },
  { id: "latestYear", label: "直近期", note: "最新の決算期" },
];

const metrics: Array<{
  id: DiagnosisMetric;
  label: string;
  hint: string;
  allowNegative?: boolean;
}> = [
  { id: "revenue", label: "売上高", hint: "例：50,000" },
  { id: "operatingProfit", label: "営業利益", hint: "例：3,000", allowNegative: true },
  { id: "netIncome", label: "最終利益", hint: "例：2,000", allowNegative: true },
  { id: "cash", label: "現預金残高", hint: "例：8,000" },
  { id: "depreciation", label: "減価償却費", hint: "例：1,000" },
];

const emptyDraft = (): FinancialDraft => ({
  twoYearsAgo: {
    revenue: "",
    operatingProfit: "",
    netIncome: "",
    cash: "",
    depreciation: "",
  },
  previousYear: {
    revenue: "",
    operatingProfit: "",
    netIncome: "",
    cash: "",
    depreciation: "",
  },
  latestYear: {
    revenue: "",
    operatingProfit: "",
    netIncome: "",
    cash: "",
    depreciation: "",
  },
});

const sampleDraft: FinancialDraft = {
  twoYearsAgo: {
    revenue: "42000",
    operatingProfit: "3100",
    netIncome: "1900",
    cash: "7200",
    depreciation: "900",
  },
  previousYear: {
    revenue: "44000",
    operatingProfit: "3000",
    netIncome: "1750",
    cash: "7600",
    depreciation: "950",
  },
  latestYear: {
    revenue: "45000",
    operatingProfit: "2800",
    netIncome: "1600",
    cash: "7900",
    depreciation: "1000",
  },
};

const numberFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatManYen(value: number): string {
  return `${numberFormatter.format(Math.round(value))}万円`;
}

function formatRate(value: number | null): string {
  if (value === null) return "算定不可";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function buildLineUrl(companyName: string): string {
  const configuredUrl = import.meta.env.VITE_LINE_OFFICIAL_URL?.trim();
  const message = `${companyName ? `${companyName}の` : ""}企業価値簡易診断を完了しました。個別相談を希望します。`;
  if (!configuredUrl) return "https://line.me/R/";
  if (configuredUrl.includes("{message}")) {
    return configuredUrl.replace("{message}", encodeURIComponent(message));
  }
  if (configuredUrl.includes("/oaMessage/")) {
    return `${configuredUrl}${configuredUrl.includes("?") ? "&" : "?"}${encodeURIComponent(message)}`;
  }
  return configuredUrl;
}

function toFinancials(draft: FinancialDraft): DiagnosisFinancials {
  return Object.fromEntries(
    periods.map(({ id }) => [
      id,
      Object.fromEntries(
        metrics.map(({ id: metric }) => [metric, Number(draft[id][metric])]),
      ),
    ]),
  ) as DiagnosisFinancials;
}

export default function QuickDiagnosisApp() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [draft, setDraft] = useState<FinancialDraft>(emptyDraft);
  const [result, setResult] = useState<QuickDiagnosisResult | null>(null);
  const [error, setError] = useState("");
  const [aiInsight, setAiInsight] = useState<DiagnosisInsight | null>(null);
  const [aiModel, setAiModel] = useState("");
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const lineUrl = useMemo(() => buildLineUrl(companyName), [companyName]);

  function updateDraft(period: DiagnosisPeriod, metric: DiagnosisMetric, value: string) {
    setDraft((current) => ({
      ...current,
      [period]: { ...current[period], [metric]: value },
    }));
  }

  function loadAiInsight(calculated: QuickDiagnosisResult) {
    setAiState("loading");
    setAiInsight(null);
    setAiError("");
    const latest = calculated.projections[2];
    const year5 = calculated.projections[3];
    const year10 = calculated.projections[4];
    void requestDiagnosisInsight({
      industry: industry.trim(),
      growthRates: calculated.growthRates,
      currentEbitda: calculated.currentEbitda,
      companyValues: {
        current: calculated.companyValues[0].value,
        year5: calculated.companyValues[1].value,
        year10: calculated.companyValues[2].value,
      },
      projections: {
        latest: {
          revenue: latest.revenue,
          operatingProfit: latest.operatingProfit,
          netIncome: latest.netIncome,
        },
        year5: {
          revenue: year5.revenue,
          operatingProfit: year5.operatingProfit,
          netIncome: year5.netIncome,
        },
        year10: {
          revenue: year10.revenue,
          operatingProfit: year10.operatingProfit,
          netIncome: year10.netIncome,
        },
      },
    })
      .then(({ insight, model }) => {
        setAiInsight(insight);
        setAiModel(model);
        setAiState("ready");
      })
      .catch((caught) => {
        setAiError(caught instanceof Error ? caught.message : "GPT分析に失敗しました。");
        setAiState("error");
      });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    for (const period of periods) {
      for (const metric of metrics) {
        const value = draft[period.id][metric.id];
        if (value.trim() === "" || !Number.isFinite(Number(value))) {
          setError("3期分すべての項目を、数字で入力してください。");
          return;
        }
        if (!metric.allowNegative && Number(value) < 0) {
          setError(`${metric.label}は0以上の数字で入力してください。`);
          return;
        }
      }
    }

    const calculated = calculateQuickDiagnosis(toFinancials(draft));
    setResult(calculated);
    loadAiInsight(calculated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    setResult(null);
    setError("");
    setAiInsight(null);
    setAiState("idle");
    setAiError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return (
      <div className="quick-app">
        <QuickHeader compact />
        <main className="quick-main result-main">
          <button className="back-button" onClick={restart}>
            <ArrowLeft size={16} /> 入力を修正する
          </button>

          <section className="result-hero">
            <div>
              <span className="quick-kicker"><Sparkles size={14} /> 診断結果</span>
              <h1>{companyName || "御社"}の10年後を<br />簡易予測しました</h1>
              <p>過去3期の傾向をそのまま延伸した場合の試算です。</p>
            </div>
            <div className="value-highlight">
              <span>10年後の簡易企業価値</span>
              <strong>{formatManYen(result.companyValues[2].value)}</strong>
              <small>
                現在比 {result.year10ValueRatio === null
                  ? "算定不可"
                  : `${Math.round(result.year10ValueRatio * 100)}%`}
              </small>
            </div>
          </section>

          <section className="alarm-message">
            <span><TrendingUp size={20} /></span>
            <div>
              <small>10 YEARS FROM NOW</small>
              <h2>{result.message}</h2>
            </div>
          </section>

          <section className={`gpt-insight-panel ${aiState}`} aria-live="polite">
            <div className="gpt-insight-heading">
              <span className="gpt-mark"><Sparkles size={19} /></span>
              <div>
                <span className="quick-kicker">OPENAI ANALYSIS</span>
                <h2>GPTによる経営示唆</h2>
              </div>
              {aiModel && <small>{aiModel}</small>}
            </div>
            {aiState === "loading" && (
              <div className="gpt-loading">
                <LoaderCircle className="spin" size={22} />
                <div><strong>診断結果を分析しています</strong><span>数値は再計算せず、経営上の論点を整理します。</span></div>
              </div>
            )}
            {aiState === "error" && (
              <div className="gpt-error">
                <strong>GPT分析を表示できませんでした</strong>
                <span>{aiError}</span>
                <button type="button" onClick={() => loadAiInsight(result)}>再試行する</button>
              </div>
            )}
            {aiState === "ready" && aiInsight && (
              <div className="gpt-content">
                <h3>{aiInsight.headline}</h3>
                <p>{aiInsight.analysis}</p>
                <div className="gpt-focus-grid">
                  {aiInsight.focusPoints.map((point, index) => (
                    <div key={point}><span>0{index + 1}</span><p>{point}</p></div>
                  ))}
                </div>
                <blockquote>{aiInsight.consultationQuestion}</blockquote>
                <small>{aiInsight.disclaimer}</small>
              </div>
            )}
          </section>

          <section className="growth-grid" aria-label="年平均成長率">
            <GrowthCard label="売上高" value={result.growthRates.revenue} />
            <GrowthCard label="営業利益" value={result.growthRates.operatingProfit} />
            <GrowthCard label="最終利益" value={result.growthRates.netIncome} />
            <article className="growth-card ebitda-card">
              <span>直近期 簡易EBITDA</span>
              <strong>{formatManYen(result.currentEbitda)}</strong>
              <small>営業利益＋減価償却費</small>
            </article>
          </section>

          <section className="chart-grid">
            <article className="quick-panel wide-chart">
              <div className="quick-panel-heading">
                <div>
                  <span className="quick-kicker"><LineChartIcon size={14} /> TREND</span>
                  <h2>主要3指標の推移</h2>
                </div>
                <small>単位：万円</small>
              </div>
              <ResponsiveContainer width="100%" height={310}>
                <LineChart data={result.projections} margin={{ left: 8, right: 12, top: 10 }}>
                  <CartesianGrid vertical={false} stroke="#eadfe0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value: number) => compactFormatter.format(value)}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip formatter={(value) => formatManYen(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="売上高" stroke="#C41E3A" strokeWidth={3} />
                  <Line type="monotone" dataKey="operatingProfit" name="営業利益" stroke="#9a6b2f" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="netIncome" name="最終利益" stroke="#466b72" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </article>

            <article className="quick-panel value-chart">
              <div className="quick-panel-heading">
                <div>
                  <span className="quick-kicker"><Building2 size={14} /> VALUE</span>
                  <h2>簡易企業価値</h2>
                </div>
                <small>単位：万円</small>
              </div>
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={result.companyValues}>
                  <CartesianGrid vertical={false} stroke="#eadfe0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value: number) => compactFormatter.format(value)}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip formatter={(value) => formatManYen(Number(value))} />
                  <Bar dataKey="value" name="簡易企業価値" fill="#C41E3A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </section>

          <section className="formula-note">
            <strong>今回の計算方法</strong>
            <span>簡易企業価値 ＝ 現預金 ＋（営業利益 ＋ 減価償却費）× {EBITDA_MULTIPLE}倍</span>
            <small>現預金と減価償却費は直近期の値で固定し、利益のCAGRのみを延伸しています。</small>
          </section>

          <section className="consultation-cta">
            <div>
              <span className="quick-kicker">NEXT STEP</span>
              <h2>「なりたい10年後」との差を、<br />一緒に整理しませんか？</h2>
              <p>
                無料面談では、数字の背景と次の市場も含めて確認します。<br />Goだけでなく、No-Goも大切な経営判断です。
              </p>
            </div>
            <a className="line-button" href={lineUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={21} /> 個別相談を予約する <ArrowRight size={18} />
            </a>
          </section>

          <p className="result-disclaimer">
            本診断は概算値による簡易試算であり、会計・税務・投資判断を代替するものではありません。
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="quick-app">
      <QuickHeader />
      <main className="quick-main">
        <section className="quick-hero">
          <div className="quick-hero-copy">
            <span className="hero-badge">無料・登録不要・約2分</span>
            <p className="hero-overline">5年後・10年後の会社の姿を可視化</p>
            <h1>このままの延長線で、<br /><em>会社はどうなる？</em></h1>
            <p className="hero-lead">
              決算書を開かなくても大丈夫。記憶にある概算値から、
              売上・利益・企業価値の未来をその場で簡易診断します。
            </p>
            <div className="hero-points">
              <span><CheckCircle2 size={17} /> 過去3期の概算だけ</span>
              <span><CheckCircle2 size={17} /> すぐに結果表示</span>
              <span><CheckCircle2 size={17} /> ログイン不要</span>
            </div>
          </div>
          <div className="future-card" aria-hidden="true">
            <span>10 YEARS</span>
            <strong>会社の未来を<br />数字で見る</strong>
            <div className="future-bars"><i /><i /><i /><i /><i /></div>
            <small>現在 → 5年後 → 10年後</small>
          </div>
        </section>

        <section className="input-intro" id="diagnosis-form">
          <span className="step-number">01</span>
          <div>
            <span className="quick-kicker">ABOUT YOUR COMPANY</span>
            <h2>まず、会社について教えてください</h2>
            <p>会社名・業種は未入力でも診断できます。</p>
          </div>
        </section>

        <form onSubmit={submit}>
          <section className="quick-panel company-fields">
            <label>
              <span>会社名・ニックネーム <small>任意</small></span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="例：ランチャーズ製作所"
                autoComplete="organization"
              />
            </label>
            <label>
              <span>業種 <small>任意</small></span>
              <input
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="例：製造業"
              />
            </label>
          </section>

          <section className="input-intro finance-intro">
            <span className="step-number">02</span>
            <div>
              <span className="quick-kicker">FINANCIAL INPUT</span>
              <h2>過去3期の数字を入力してください</h2>
              <p>すべて万円単位。おおよその数字で構いません。</p>
            </div>
            <button
              className="sample-button"
              type="button"
              onClick={() => {
                setDraft(structuredClone(sampleDraft));
                setError("");
              }}
            >
              <RotateCcw size={14} /> サンプルを入力
            </button>
          </section>

          <div className="period-grid">
            {periods.map((period, index) => (
              <section className="period-card" key={period.id}>
                <div className="period-heading">
                  <span>0{index + 1}</span>
                  <div><h3>{period.label}</h3><small>{period.note}</small></div>
                </div>
                <div className="period-fields">
                  {metrics.map((metric) => (
                    <label key={metric.id}>
                      <span>{metric.label}</span>
                      <div className="money-input">
                        <input
                          required
                          type="number"
                          inputMode="decimal"
                          min={metric.allowNegative ? undefined : 0}
                          step="1"
                          value={draft[period.id][metric.id]}
                          onChange={(event) => updateDraft(period.id, metric.id, event.target.value)}
                          placeholder={metric.hint.replace("例：", "")}
                          aria-label={`${period.label}の${metric.label}（万円）`}
                        />
                        <span>万円</span>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="privacy-note">
            <LockKeyhole size={19} />
            <div>
              <strong>入力内容はご相談対応のためにのみ使用します</strong>
              <span>ログイン不要。財務数値は診断計算とGPT分析のために送信しますが、本アプリのデータベースには保存しません。</span>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="diagnose-button" type="submit">
            診断結果を見る <ArrowRight size={20} />
          </button>
          <p className="form-disclaimer">本診断は概算値による簡易予測です。精緻な財務分析は個別面談で行います。</p>
        </form>
      </main>
      <footer className="quick-footer">
        <div><span className="quick-logo-mark">L</span><strong>CAPITAL LAUNCHERS</strong></div>
        <span><ShieldCheck size={15} /> India Go / No-Go Support</span>
      </footer>
    </div>
  );
}

function QuickHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`quick-header ${compact ? "compact" : ""}`}>
      <a className="quick-logo" href="/" aria-label="Capital Launchers トップ">
        <span className="quick-logo-mark">L</span>
        <span><strong>CAPITAL LAUNCHERS</strong><small>INDIA GO / NO-GO SUPPORT</small></span>
      </a>
      <span className="header-label">企業価値簡易診断</span>
    </header>
  );
}

function GrowthCard({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? "unknown" : value > 0.005 ? "positive" : value < -0.005 ? "negative" : "flat";
  return (
    <article className={`growth-card ${tone}`}>
      <span>{label} CAGR</span>
      <strong>{formatRate(value)}</strong>
      <small>前々期から直近期まで</small>
    </article>
  );
}

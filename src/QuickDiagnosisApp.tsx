import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, LineChart as LineChartIcon,
  LoaderCircle, LockKeyhole, MessageCircle, RotateCcw, ShieldCheck,
  Sparkles, TrendingUp,
} from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  EBITDA_MULTIPLE, MONTE_CARLO_RUNS, PERFORMANCE_RATING_RATES,
  backcastFinancials, calculateQuickDiagnosis,
  type DiagnosisFinancials, type DiagnosisMetric, type DiagnosisPeriod,
  type PerformanceRating, type QuickDiagnosisResult,
} from "./quickDiagnosis";
import { requestDiagnosisInsight } from "./ai/diagnosisClient";
import type { DiagnosisInsight, DiagnosisInsightRequest } from "./ai/diagnosisSchema";

type FinancialDraft = Record<DiagnosisPeriod, Record<DiagnosisMetric, string>>;
type FinancialSource = "user" | "derived" | "edited";
type FinancialSources = Record<DiagnosisPeriod, Record<DiagnosisMetric, FinancialSource>>;
type MoneyUnit = "man" | "oku";
type ChoiceAnswer = "はい" | "いいえ" | "わからない" | "";
type QualitativeAnswers = {
  q1: ChoiceAnswer; q2: ChoiceAnswer; q3: ChoiceAnswer; q4: ChoiceAnswer; q5: string;
};

const periods: Array<{ id: DiagnosisPeriod; label: string; note: string }> = [
  { id: "twoYearsAgo", label: "前々期", note: "2年前" },
  { id: "previousYear", label: "前期", note: "1年前" },
  { id: "latestYear", label: "直近期", note: "ユーザー入力" },
];

const metrics: Array<{ id: DiagnosisMetric; label: string; hint: string; allowNegative?: boolean }> = [
  { id: "revenue", label: "売上高", hint: "50,000" },
  { id: "operatingProfit", label: "営業利益", hint: "3,000", allowNegative: true },
  { id: "netIncome", label: "最終利益", hint: "2,000", allowNegative: true },
  { id: "cash", label: "現預金残高", hint: "8,000" },
  { id: "depreciation", label: "減価償却費", hint: "1,000" },
];
const summaryMetrics: Array<{ id: "revenue" | "operatingProfit" | "netIncome"; label: string }> = [
  { id: "revenue", label: "売上高" },
  { id: "operatingProfit", label: "営業利益" },
  { id: "netIncome", label: "最終利益" },
];

const industries = ["製造業", "卸売業・小売業", "サービス業（IT・情報通信を含む）", "建設業", "その他"] as const;
const capitalRanges = ["300万円未満", "300万〜1,000万円", "1,000万〜3,000万円", "3,000万〜1億円", "1億円以上"] as const;
const revenueRanges = ["1億円未満", "1億〜3億円", "3億〜10億円", "10億〜30億円", "30億円以上"] as const;
const questions: Array<{ id: "q1" | "q2" | "q3" | "q4"; text: string }> = [
  { id: "q1", text: "5年後、10年後の自社の成長イメージは見えていますか？" },
  { id: "q2", text: "後継者が引き継ぐ事業の中身は、具体的に決まっていますか？" },
  { id: "q3", text: "今のままで、優秀な社員の給与・待遇を維持し続けられますか？" },
  { id: "q4", text: "新しい市場（海外を含む）への投資を検討したことがありますか？" },
];
const ratingLabels: Record<PerformanceRating, string> = {
  5: "絶好調", 4: "順調", 3: "横ばい", 2: "下降気味", 1: "思わしくない",
};

const emptyDraft = (): FinancialDraft => Object.fromEntries(
  periods.map(({ id }) => [id, Object.fromEntries(metrics.map(({ id: metric }) => [metric, ""]))]),
) as FinancialDraft;
const initialSources = (): FinancialSources => Object.fromEntries(
  periods.map(({ id }) => [id, Object.fromEntries(metrics.map(({ id: metric }) => [metric, id === "latestYear" ? "user" : "derived"]))]),
) as FinancialSources;
const sampleLatest: Record<DiagnosisMetric, string> = {
  revenue: "45000", operatingProfit: "2800", netIncome: "1600", cash: "7900", depreciation: "1000",
};

const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

function unitLabel(unit: MoneyUnit) { return unit === "man" ? "万円" : "億円"; }
function unitDivisor(unit: MoneyUnit) { return unit === "man" ? 1 : 10_000; }
function formatMoney(value: number, unit: MoneyUnit) {
  const converted = value / unitDivisor(unit);
  return `${unit === "man" ? numberFormatter.format(Math.round(converted)) : decimalFormatter.format(converted)}${unitLabel(unit)}`;
}
function displayInputValue(value: string, unit: MoneyUnit) {
  if (value === "") return "";
  const converted = Number(value) / unitDivisor(unit);
  return Number.isFinite(converted) ? String(Number(converted.toFixed(4))) : "";
}
function internalInputValue(value: string, unit: MoneyUnit) {
  if (value === "") return "";
  const converted = Number(value) * unitDivisor(unit);
  return Number.isFinite(converted) ? String(Math.round(converted * 1_000) / 1_000) : value;
}
function formatRate(value: number | null) {
  if (value === null) return "算定不可";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
function buildLineUrl(companyName: string): string | null {
  const configuredUrl = import.meta.env.VITE_LINE_OFFICIAL_URL?.trim();
  if (!configuredUrl || configuredUrl.includes("YOUR_LINE_ID") || configuredUrl === "https://line.me/R/") return null;
  const message = `${companyName ? `${companyName}の` : ""}企業価値簡易診断を完了しました。個別相談を希望します。`;
  return configuredUrl.includes("{message}")
    ? configuredUrl.replace("{message}", encodeURIComponent(message))
    : configuredUrl;
}
function toFinancials(draft: FinancialDraft): DiagnosisFinancials {
  return Object.fromEntries(periods.map(({ id }) => [id, Object.fromEntries(metrics.map(({ id: metric }) => [metric, Number(draft[id][metric])]))])) as DiagnosisFinancials;
}
function sourceLabel(source: FinancialSource) {
  return source === "derived" ? "自動算出" : source === "edited" ? "編集済み" : "入力値";
}
function validatePeriod(draft: FinancialDraft, periodIds: DiagnosisPeriod[]): string | null {
  for (const period of periods.filter(({ id }) => periodIds.includes(id))) {
    for (const metric of metrics) {
      const value = draft[period.id][metric.id];
      if (value.trim() === "" || !Number.isFinite(Number(value))) return `${period.label}の5項目を、数字で入力してください。`;
      if (!metric.allowNegative && Number(value) < 0) return `${metric.label}は0以上の数字で入力してください。`;
    }
  }
  return null;
}

export default function QuickDiagnosisApp() {
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [capitalRange, setCapitalRange] = useState<"" | (typeof capitalRanges)[number]>("");
  const [revenueRange, setRevenueRange] = useState<"" | (typeof revenueRanges)[number]>("");
  const [answers, setAnswers] = useState<QualitativeAnswers>({ q1: "", q2: "", q3: "", q4: "", q5: "" });
  const [performanceRating, setPerformanceRating] = useState<PerformanceRating | null>(null);
  const [moneyUnit, setMoneyUnit] = useState<MoneyUnit>("man");
  const [draft, setDraft] = useState<FinancialDraft>(emptyDraft);
  const [sources, setSources] = useState<FinancialSources>(initialSources);
  const [result, setResult] = useState<QuickDiagnosisResult | null>(null);
  const [error, setError] = useState("");
  const [aiInsight, setAiInsight] = useState<DiagnosisInsight | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const aiRequestVersion = useRef(0);
  const lineUrl = useMemo(() => buildLineUrl(companyName), [companyName]);

  function updateDraft(period: DiagnosisPeriod, metric: DiagnosisMetric, displayedValue: string, edited = false) {
    const value = internalInputValue(displayedValue, moneyUnit);
    setDraft((current) => ({ ...current, [period]: { ...current[period], [metric]: value } }));
    if (edited && period !== "latestYear") {
      setSources((current) => ({ ...current, [period]: { ...current[period], [metric]: "edited" } }));
    }
  }

  function prepareReview(event: FormEvent) {
    event.preventDefault();
    setError("");
    const validationError = validatePeriod(draft, ["latestYear"]);
    if (validationError) return setError(validationError);
    if (performanceRating === null) return setError("直近の業績評価を選択してください。");
    const latestYear = Object.fromEntries(metrics.map(({ id }) => [id, Number(draft.latestYear[id])])) as DiagnosisFinancials["latestYear"];
    const calculated = backcastFinancials(latestYear, performanceRating);
    setDraft(Object.fromEntries(periods.map(({ id }) => [id, Object.fromEntries(metrics.map(({ id: metric }) => [metric, String(calculated[id][metric])]))])) as FinancialDraft);
    setSources(initialSources());
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadAiInsight(calculated: QuickDiagnosisResult) {
    const requestVersion = aiRequestVersion.current + 1;
    aiRequestVersion.current = requestVersion;
    setAiState("loading");
    setAiInsight(null);
    setAiError("");
    const financials = toFinancials(draft);
    const [latest, year5, year10] = calculated.projections.slice(2);
    const historicalFinancials = Object.fromEntries(periods.map(({ id }) => [id, Object.fromEntries(metrics.map(({ id: metric }) => [metric, { value: financials[id][metric], source: sources[id][metric] }]))])) as DiagnosisInsightRequest["historicalFinancials"];
    void requestDiagnosisInsight({
      industry,
      capitalRange,
      revenueRange,
      performanceRating: performanceRating!,
      qualitativeAnswers: {
        q1: answers.q1 || undefined, q2: answers.q2 || undefined,
        q3: answers.q3 || undefined, q4: answers.q4 || undefined,
        q5: answers.q5.trim() || undefined,
      },
      historicalFinancials,
      growthRates: calculated.growthRates,
      currentEbitda: calculated.currentEbitda,
      companyValues: {
        current: calculated.companyValues[0].value,
        year5: calculated.companyValues[1].value,
        year10: calculated.companyValues[2].value,
      },
      projections: {
        latest: { revenue: latest.revenue, operatingProfit: latest.operatingProfit, netIncome: latest.netIncome },
        year5: { revenue: year5.revenue, operatingProfit: year5.operatingProfit, netIncome: year5.netIncome },
        year10: { revenue: year10.revenue, operatingProfit: year10.operatingProfit, netIncome: year10.netIncome },
      },
      simulation: {
        runs: calculated.simulation.runs,
        year5CompanyValue: calculated.simulation.year5.companyValue,
        year10CompanyValue: calculated.simulation.year10.companyValue,
        probabilityCompanyValueDeclines: calculated.simulation.probabilityCompanyValueDeclines,
        probabilityOperatingLoss: calculated.simulation.probabilityOperatingLoss,
      },
    }).then(({ insight }) => {
      if (aiRequestVersion.current !== requestVersion) return;
      setAiInsight(insight); setAiState("ready");
    }).catch((caught) => {
      if (aiRequestVersion.current !== requestVersion) return;
      setAiError(caught instanceof Error ? caught.message : "AI分析に失敗しました。"); setAiState("error");
    });
  }

  function confirmDiagnosis(event: FormEvent) {
    event.preventDefault();
    setError("");
    const validationError = validatePeriod(draft, periods.map(({ id }) => id));
    if (validationError) return setError(validationError);
    const calculated = calculateQuickDiagnosis(toFinancials(draft));
    setResult(calculated);
    loadAiInsight(calculated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    aiRequestVersion.current += 1;
    setResult(null); setStep("entry"); setError(""); setAiInsight(null);
    setAiState("idle"); setAiError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) return (
    <div className="quick-app">
      <QuickHeader compact />
      <main className="quick-main result-main">
        <button className="back-button" onClick={restart}><ArrowLeft size={16} /> 入力を修正する</button>
        <section className="result-hero">
          <span className="quick-kicker"><Sparkles size={14} /> 診断結果</span>
          <h1>貴社の企業価値の推移を<br />シミュレーションしてみました</h1>
          <p>確認いただいた3期分の数値をもとに、中央値と結果の幅を示しています。</p>
        </section>
        <HistorySummary draft={draft} sources={sources} unit={moneyUnit} />
        <section className="forecast-value-grid" aria-label="企業価値予測">
          <SimulationRangeCard label="5年後の簡易企業価値" range={result.simulation.year5.companyValue} unit={moneyUnit} />
          <SimulationRangeCard label="10年後の簡易企業価値" range={result.simulation.year10.companyValue} unit={moneyUnit} ratio={result.year10ValueRatio} />
        </section>
        <section className="alarm-message"><span><TrendingUp size={20} /></span><div><small>10年後の見通し</small><h2>{result.message}</h2></div></section>
        <section className="simulation-panel" aria-label="モンテカルロ・シミュレーション結果">
          <div className="simulation-heading"><div><span className="quick-kicker">確率シミュレーション</span><h2>{numberFormatter.format(result.simulation.runs)}回の確率シミュレーション</h2></div><small>AI不使用・同じ入力なら同じ結果</small></div>
          <p className="simulation-explanation">未来の数字は1つに決め打ちできないため、過去の変動の大きさをもとに1万通りの可能性を計算し、その中央値と上下10%の幅を示しています。</p>
          <div className="simulation-grid probability-grid">
            <article className="probability-card"><span>10年後に現在価値を下回る確率</span><strong>{formatProbability(result.simulation.probabilityCompanyValueDeclines)}</strong><small>現在の簡易企業価値未満となった割合</small></article>
            <article className="probability-card"><span>10年以内に営業赤字となる確率</span><strong>{formatProbability(result.simulation.probabilityOperatingLoss)}</strong><small>少なくとも1期、営業利益がマイナスとなった割合</small></article>
          </div>
        </section>
        <section className={`gpt-insight-panel ${aiState}`} aria-live="polite">
          <div className="gpt-insight-heading"><span className="gpt-mark"><Sparkles size={19} /></span><div><span className="quick-kicker">AIによる分析</span><h2>AIによる簡易分析</h2></div><small>AI</small></div>
          {aiState === "loading" && <div className="gpt-loading"><LoaderCircle className="spin" size={22} /><div><strong>診断結果を分析しています</strong><span>数値と任意回答から経営上の論点を整理します。</span></div></div>}
          {aiState === "error" && <div className="gpt-error"><strong>AI分析を表示できませんでした</strong><span>{aiError}</span><button type="button" onClick={() => loadAiInsight(result)}>再試行する</button></div>}
          {aiState === "ready" && aiInsight && <div className="gpt-content">
            <InsightSection title="フィードバック" text={aiInsight.feedback} />
            <div className="risk-list"><h3>リスク</h3>{aiInsight.risks.map((risk) => <p key={risk}>{risk}</p>)}</div>
            <InsightSection title="総評" text={aiInsight.summary} />
            <div className="rating-result"><div><span>総合評価</span><strong>{aiInsight.rating}/5</strong></div><div className="rating-dots" aria-label={`5段階中${aiInsight.rating}`}>{[1, 2, 3, 4, 5].map((value) => <i className={value <= aiInsight.rating ? "active" : ""} key={value} />)}</div><p>{aiInsight.ratingRationale}</p></div>
          </div>}
        </section>
        <p className="ai-disclaimer">本診断は概算値による簡易試算であり、会計・税務・投資判断を代替するものではありません。</p>
        <section className="growth-grid" aria-label="年平均成長率">
          <GrowthCard label="売上高" value={result.growthRates.revenue} />
          <GrowthCard label="営業利益" value={result.growthRates.operatingProfit} />
          <GrowthCard label="最終利益" value={result.growthRates.netIncome} />
          <article className="growth-card ebitda-card"><span>直近期 簡易キャッシュ創出力</span><strong>{formatMoney(result.currentEbitda, moneyUnit)}</strong><small>営業利益＋減価償却費</small></article>
        </section>
        <PerformanceChart result={result} sources={sources} unit={moneyUnit} />
        <CompanyValueChart result={result} unit={moneyUnit} />
        <section className="formula-note"><strong>今回の計算方法</strong><span>簡易企業価値 ＝ 現預金 ＋（営業利益 ＋ 減価償却費）× {EBITDA_MULTIPLE}倍</span><small>過去3期から傾向を推定し、{numberFormatter.format(MONTE_CARLO_RUNS)}経路を計算。表示範囲は結果の中央80%です。</small></section>
        <section className="consultation-cta">
          <span className="quick-kicker">次のステップ</span><h2>「なりたい10年後」との差を、<br />一緒に整理しませんか？</h2>
          <p>今回の診断は、「このまま何もしなければ」という前提での未来です。実際には、経営判断ひとつで数字は変わります。</p><p>たとえば、こんな選択肢が考えられます。</p>
          <div className="option-chips">{["成長市場への事業投資", "M&Aによる事業成長", "海外人材の活用", "中期事業計画の策定", "海外企業との業務提携", "AI活用による業務改善"].map((option) => <span key={option}>{option}</span>)}</div>
          <p>どれが御社に合うかは、数字だけでは判断できません。無料の個別相談で、診断結果の背景とあわせて一緒に整理します。<br /><strong>Goだけでなく、No-Goも大切な経営判断です。</strong></p>
          {lineUrl ? <a className="line-button" href={lineUrl} target="_blank" rel="noreferrer"><MessageCircle size={21} /> 個別相談を予約する <ArrowRight size={18} /></a> : <span className="line-button disabled" aria-disabled="true"><MessageCircle size={21} /> LINE公式アカウント準備中</span>}
        </section>
        <p className="result-disclaimer">本診断は概算値による簡易試算であり、会計・税務・投資判断を代替するものではありません。</p>
      </main>
    </div>
  );

  if (step === "review") return (
    <div className="quick-app"><QuickHeader compact /><main className="quick-main review-main">
      <button className="back-button" onClick={() => setStep("entry")}><ArrowLeft size={16} /> 直近期の入力に戻る</button>
      <section className="input-intro review-intro"><span className="step-number">03</span><div><span className="quick-kicker">自動算出＋確認</span><h1>過去2期の数値をご確認ください</h1><p>業績評価「{ratingLabels[performanceRating!]}」の年率 {formatRate(PERFORMANCE_RATING_RATES[performanceRating!])} を逆算。違う項目は上書きできます。</p></div></section>
      <MoneyUnitToggle value={moneyUnit} onChange={setMoneyUnit} />
      <form onSubmit={confirmDiagnosis}><div className="period-grid review-grid">{periods.map((period, index) => <FinancialPeriodCard key={period.id} period={period} index={index} draft={draft} sources={sources} unit={moneyUnit} onChange={(metric, value) => updateDraft(period.id, metric, value, true)} />)}</div>{error && <div className="form-error" role="alert">{error}</div>}<button className="diagnose-button" type="submit">確定してシミュレーションする <ArrowRight size={20} /></button></form>
    </main></div>
  );

  return (
    <div className="quick-app"><QuickHeader /><main className="quick-main">
      <section className="quick-hero"><div className="quick-hero-copy"><span className="hero-badge">無料・登録不要・約2分</span><p className="hero-overline">5年後・10年後の会社の姿を可視化</p><h1>このままの延長線で、<br /><em>会社はどうなる？</em></h1><p className="hero-lead">直近1期の概算値から、売上・利益・企業価値の未来をその場で簡易シミュレーションします。</p><div className="hero-points"><span><CheckCircle2 size={17} /> 直近1期だけ入力</span><span><CheckCircle2 size={17} /> すぐに結果表示</span><span><CheckCircle2 size={17} /> ログイン不要</span></div></div><div className="future-card" aria-hidden="true"><span>10 YEARS</span><strong>会社の未来を<br />数字で見る</strong><div className="future-bars"><i /><i /><i /><i /><i /></div><small>現在 → 5年後 → 10年後</small></div></section>
      <form onSubmit={prepareReview}>
        <section className="input-intro" id="diagnosis-form"><span className="step-number">01</span><div><span className="quick-kicker">会社情報</span><h2>まず、会社について教えてください</h2><p>会社情報と5つの質問は任意です。答えていただくとAI分析がより具体的になります。</p></div></section>
        <section className="quick-panel company-fields">
          <label><span>会社名・ニックネーム <small>任意</small></span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="例：ランチャーズ製作所" autoComplete="organization" /></label>
          <label><span>業種 <small>任意</small></span><select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">選択してください</option>{industries.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>資本金 <small>任意</small></span><select value={capitalRange} onChange={(event) => setCapitalRange(event.target.value as typeof capitalRange)}><option value="">選択してください</option>{capitalRanges.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>売上規模 <small>任意</small></span><select value={revenueRange} onChange={(event) => setRevenueRange(event.target.value as typeof revenueRange)}><option value="">選択してください</option>{revenueRanges.map((option) => <option key={option}>{option}</option>)}</select></label>
        </section>
        <section className="quick-panel question-panel"><div className="section-heading"><div><span className="quick-kicker">任意・5問</span><h2>今の課題感を教えてください</h2></div><p>回答内容は、後ほどのAI分析で具体的なフィードバックを作るために使われます。</p></div>
          {questions.map((question, index) => <fieldset className="choice-question" key={question.id}><legend><span>{index + 1}</span>{question.text}</legend><div role="group" aria-label={question.text}>{(["はい", "いいえ", "わからない"] as const).map((choice) => <button aria-pressed={answers[question.id] === choice} className={answers[question.id] === choice ? "selected" : ""} type="button" key={choice} onClick={() => setAnswers((current) => ({ ...current, [question.id]: current[question.id] === choice ? "" : choice }))}>{choice}</button>)}</div></fieldset>)}
          <label className="free-question"><span><b>5</b> 今、経営上いちばん気になっていることを教えてください <small>任意</small></span><textarea value={answers.q5} maxLength={500} onChange={(event) => setAnswers((current) => ({ ...current, q5: event.target.value }))} placeholder="例：後継者はいるが、承継後の事業の方向性を一緒に考えられていない…" /><small>{answers.q5.length}/500</small></label>
        </section>
        <section className="input-intro finance-intro"><span className="step-number">02</span><div><span className="quick-kicker">財務情報入力</span><h2>直近期の数字を入力してください</h2><p>おおよその数字で構いません。前々期・前期は次の画面で自動算出します。</p></div><button className="sample-button" type="button" onClick={() => { setDraft((current) => ({ ...current, latestYear: { ...sampleLatest } })); setPerformanceRating(4); setError(""); }}><RotateCcw size={14} /> サンプルを入力</button></section>
        <MoneyUnitToggle value={moneyUnit} onChange={setMoneyUnit} />
        <section className="period-card latest-input-card"><div className="period-heading"><span>01</span><div><h3>直近期</h3><small>最新の決算期</small></div></div><div className="period-fields">{metrics.map((metric) => <MoneyField key={metric.id} metric={metric} value={draft.latestYear[metric.id]} unit={moneyUnit} onChange={(value) => updateDraft("latestYear", metric.id, value)} />)}</div></section>
        <section className="performance-rating-panel"><div><span className="quick-kicker">必須</span><h2>直近の業績はいかがですか？</h2><p>選択した成長率の目安から、前期・前々期を単純計算で逆算します。</p></div><div className="rating-options" role="radiogroup" aria-label="直近の業績評価">{([5, 4, 3, 2, 1] as PerformanceRating[]).map((rating) => <button aria-checked={performanceRating === rating} className={performanceRating === rating ? "selected" : ""} role="radio" type="button" key={rating} onClick={() => setPerformanceRating(rating)}><strong>{rating}</strong><span>{ratingLabels[rating]}</span><small>{formatRate(PERFORMANCE_RATING_RATES[rating])}</small></button>)}</div></section>
        <div className="privacy-note"><LockKeyhole size={19} /><div><strong>入力内容は診断とAI分析のためにのみ使用します</strong><span>回答内容はOpenAI APIへ送信します。モデル学習には使用されず、本アプリのデータベースには保存しません。API側の取扱いはOpenAIの契約設定に従います。</span></div></div>
        {error && <div className="form-error" role="alert">{error}</div>}<button className="diagnose-button" type="submit">自動算出した過去2期を確認する <ArrowRight size={20} /></button><p className="form-disclaimer">本診断は概算値による簡易予測です。精緻な財務分析は個別面談で行います。</p>
      </form>
    </main><footer className="quick-footer"><div><span className="quick-logo-mark">L</span><strong>CAPITAL LAUNCHERS</strong></div><span><ShieldCheck size={15} /> インド進出判断支援</span></footer></div>
  );
}

function MoneyUnitToggle({ value, onChange }: { value: MoneyUnit; onChange: (value: MoneyUnit) => void }) {
  return <div className="unit-toggle" aria-label="金額の単位"><span>入力・表示単位</span><div><button aria-pressed={value === "man"} className={value === "man" ? "selected" : ""} type="button" onClick={() => onChange("man")}>万円</button><button aria-pressed={value === "oku"} className={value === "oku" ? "selected" : ""} type="button" onClick={() => onChange("oku")}>億円</button></div></div>;
}
function MoneyField({ metric, value, unit, onChange }: { metric: (typeof metrics)[number]; value: string; unit: MoneyUnit; onChange: (value: string) => void }) {
  return <label><span>{metric.label}</span><div className="money-input"><input required type="number" inputMode="decimal" min={metric.allowNegative ? undefined : 0} step={unit === "man" ? "1" : "0.0001"} value={displayInputValue(value, unit)} onChange={(event) => onChange(event.target.value)} placeholder={unit === "man" ? metric.hint.replaceAll(",", "") : String(Number(metric.hint.replaceAll(",", "")) / 10_000)} aria-label={`${metric.label}（${unitLabel(unit)}）`} /><span>{unitLabel(unit)}</span></div></label>;
}
function FinancialPeriodCard({ period, index, draft, sources, unit, onChange }: { period: (typeof periods)[number]; index: number; draft: FinancialDraft; sources: FinancialSources; unit: MoneyUnit; onChange: (metric: DiagnosisMetric, value: string) => void }) {
  return <section className={`period-card ${period.id === "latestYear" ? "confirmed" : "estimated"}`}><div className="period-heading"><span>0{index + 1}</span><div><h3>{period.label}</h3><small>{period.note}</small></div></div><div className="period-fields">{metrics.map((metric) => <div className="review-field" key={metric.id}><MoneyField metric={metric} value={draft[period.id][metric.id]} unit={unit} onChange={(value) => onChange(metric.id, value)} /><small className={`source-badge ${sources[period.id][metric.id]}`}>{sourceLabel(sources[period.id][metric.id])}</small></div>)}</div></section>;
}
function HistorySummary({ draft, sources, unit }: { draft: FinancialDraft; sources: FinancialSources; unit: MoneyUnit }) {
  return <section className="quick-panel history-summary"><div className="quick-panel-heading"><div><span className="quick-kicker">3年間のサマリー</span><h2>確認した業績推移</h2></div><small>単位：{unitLabel(unit)}</small></div><div className="summary-table" role="table"><div className="summary-row summary-header" role="row"><span role="columnheader" />{periods.map((period) => <span role="columnheader" key={period.id}>{period.label}<small>{period.id === "latestYear" ? "入力値" : "自動算出・編集可"}</small></span>)}</div>{summaryMetrics.map((metric) => <div className="summary-row" role="row" key={metric.id}><strong role="rowheader">{metric.label}</strong>{periods.map((period) => <span role="cell" key={period.id}>{formatMoney(Number(draft[period.id][metric.id]), unit)}<small className={`source-badge ${sources[period.id][metric.id]}`}>{sourceLabel(sources[period.id][metric.id])}</small></span>)}</div>)}</div></section>;
}
function PerformanceChart({ result, sources, unit }: { result: QuickDiagnosisResult; sources: FinancialSources; unit: MoneyUnit }) {
  const data = result.projections.map((point, index) => ({ label: point.label,
    historicalRevenue: index <= 2 ? point.revenue : undefined, forecastRevenue: index >= 2 ? point.revenue : undefined,
    historicalOperatingProfit: index <= 2 ? point.operatingProfit : undefined, forecastOperatingProfit: index >= 2 ? point.operatingProfit : undefined,
    historicalNetIncome: index <= 2 ? point.netIncome : undefined, forecastNetIncome: index >= 2 ? point.netIncome : undefined,
  }));
  const hasDerivedHistory = (["twoYearsAgo", "previousYear"] as DiagnosisPeriod[]).some((period) => summaryMetrics.some(({ id }) => sources[period][id] === "derived"));
  const divisor = unitDivisor(unit);
  return <section className="quick-panel wide-chart"><div className="quick-panel-heading"><div><span className="quick-kicker"><LineChartIcon size={14} /> 業績推移</span><h2>主要3指標の推移</h2></div><small>単位：{unitLabel(unit)}</small></div><ResponsiveContainer width="100%" height={330}><ComposedChart data={data} margin={{ left: 8, right: 14, top: 20 }}><CartesianGrid vertical={false} stroke="#e2e6ec" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value: number) => compactFormatter.format(value / divisor)} tickLine={false} axisLine={false} width={58} /><Tooltip formatter={(value) => formatMoney(Number(value), unit)} /><ReferenceLine x="直近期" stroke="#8b97a7" strokeDasharray="3 3" label={{ value: "現在", position: "top", fill: "#64748b", fontSize: 11 }} /><Line connectNulls type="monotone" dataKey="historicalRevenue" stroke="#17345f" strokeWidth={3} strokeDasharray={hasDerivedHistory ? "6 5" : undefined} dot={false} /><Line connectNulls type="monotone" dataKey="forecastRevenue" stroke="#17345f" strokeWidth={3} strokeDasharray="7 6" dot={{ r: 3 }} /><Line connectNulls type="monotone" dataKey="historicalOperatingProfit" stroke="#c79a3b" strokeWidth={2.5} strokeDasharray={hasDerivedHistory ? "6 5" : undefined} dot={false} /><Line connectNulls type="monotone" dataKey="forecastOperatingProfit" stroke="#c79a3b" strokeWidth={2.5} strokeDasharray="7 6" dot={{ r: 3 }} /><Line connectNulls type="monotone" dataKey="historicalNetIncome" stroke="#7b93a6" strokeWidth={2.5} strokeDasharray={hasDerivedHistory ? "6 5" : undefined} dot={false} /><Line connectNulls type="monotone" dataKey="forecastNetIncome" stroke="#7b93a6" strokeWidth={2.5} strokeDasharray="7 6" dot={{ r: 3 }} />{periods.map((period, periodIndex) => summaryMetrics.map((metric) => { const source = sources[period.id][metric.id]; return <ReferenceDot key={`${period.id}-${metric.id}`} x={period.label} y={result.projections[periodIndex][metric.id]} r={source === "user" ? 5 : 4} fill={source === "derived" ? "#ffffff" : source === "edited" ? "#c99b42" : "#17345f"} stroke={source === "derived" ? "#64748b" : "#ffffff"} strokeWidth={2} />; }))}</ComposedChart></ResponsiveContainer><div className="chart-legend"><span><i className="navy" />売上高</span><span><i className="gold" />営業利益</span><span><i className="gray" />最終利益</span></div><div className="chart-source-legend"><span><i className="derived" />自動算出</span><span><i className="edited" />編集済み</span><span><i className="user" />入力値</span></div><p className="chart-caption">過去2期の破線＝自動算出を含む履歴／現在から先の点線＝シミュレーション中央値</p></section>;
}
function CompanyValueChart({ result, unit }: { result: QuickDiagnosisResult; unit: MoneyUnit }) {
  const current = result.companyValues[0].value;
  const data = [
    { label: "現在", value: current, range: [current, current] },
    { label: "5年後", value: result.simulation.year5.companyValue.p50, range: [result.simulation.year5.companyValue.p10, result.simulation.year5.companyValue.p90] },
    { label: "10年後", value: result.simulation.year10.companyValue.p50, range: [result.simulation.year10.companyValue.p10, result.simulation.year10.companyValue.p90] },
  ];
  const divisor = unitDivisor(unit);
  return <section className="quick-panel value-chart"><div className="quick-panel-heading"><div><span className="quick-kicker">企業価値</span><h2>簡易企業価値の推移</h2></div><small>単位：{unitLabel(unit)}</small></div><ResponsiveContainer width="100%" height={300}><ComposedChart data={data} margin={{ left: 8, right: 20, top: 15 }}><CartesianGrid vertical={false} stroke="#e2e6ec" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value: number) => compactFormatter.format(value / divisor)} tickLine={false} axisLine={false} width={58} /><Tooltip formatter={(value) => Array.isArray(value) ? `${formatMoney(Number(value[0]), unit)}〜${formatMoney(Number(value[1]), unit)}` : formatMoney(Number(value), unit)} /><Area dataKey="range" stroke="none" fill="#dbe5f3" fillOpacity={0.65} /><Line type="monotone" dataKey="value" stroke="#17345f" strokeWidth={3} strokeDasharray="7 6" dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer><p className="chart-caption">点線＝シミュレーション中央値／薄い帯＝下位10%〜上位10%の範囲</p></section>;
}
function QuickHeader({ compact = false }: { compact?: boolean }) {
  return <header className={`quick-header ${compact ? "compact" : ""}`}><a className="quick-logo" href="/" aria-label="Capital Launchers トップ"><span className="quick-logo-mark">L</span><span><strong>CAPITAL LAUNCHERS</strong><small>インド進出判断支援</small></span></a><span className="header-label">企業価値簡易診断</span></header>;
}
function GrowthCard({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? "unknown" : value > 0.005 ? "positive" : value < -0.005 ? "negative" : "flat";
  return <article className={`growth-card ${tone}`}><span>{label}の年平均成長率</span><strong>{formatRate(value)}</strong><small>前々期から直近期まで</small></article>;
}
function InsightSection({ title, text }: { title: string; text: string }) { return <div className="insight-section"><h3>{title}</h3><p>{text}</p></div>; }
function formatProbability(value: number) { return `${(value * 100).toFixed(1)}%`; }
function SimulationRangeCard({ label, range, unit, ratio }: { label: string; range: { p10: number; p50: number; p90: number }; unit: MoneyUnit; ratio?: number | null }) {
  return <article className="simulation-range-card"><span>{label}</span><strong>{formatMoney(range.p50, unit)}</strong>{ratio !== undefined && <b>現在比 {ratio === null ? "算定不可" : `${Math.round(ratio * 100)}%`}</b>}<div><small>下位10% {formatMoney(range.p10, unit)}</small><i aria-hidden="true" /><small>上位10% {formatMoney(range.p90, unit)}</small></div></article>;
}

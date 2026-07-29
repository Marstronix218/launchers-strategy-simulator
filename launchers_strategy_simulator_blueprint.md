# Launchers Strategy Simulator
## 5年・10年事業計画／戦略策定シミュレーション 基本設計書

作成日: 2026-07-28

---

## 1. 結論

この構想は実現可能であり、Capital Launchersの営業フックとしても成立する。

ただし、製品の中心を「AIが将来の数字を当てるソフト」にしてはいけない。中心は、事業ドライバーに基づく監査可能な財務計算エンジンである。AIは、データ整理、勘定科目マッピング、前提条件の提案、外部環境の調査、シナリオ説明、戦略案の文章化に使う。

推奨する位置づけは次の通り。

> 過去実績、現在の事業構造、外部環境、経営目標をつなぎ、5年・10年後のPL・BS・CFと、目標達成に必要な戦略アクションを同時に可視化する経営診断・戦略策定プログラム

単なる予算管理SaaSとして競争するのではなく、以下のサービス導線を作る。

1. 無料のAs-Is経営診断
2. 5年・10年の複数シナリオ比較
3. 目標との差分と経営課題の特定
4. 国内改善、設備投資、新規事業、M&A、海外展開などの選択肢比較
5. インド進出シナリオのGo / No-Go判定
6. 実行支援、顧客開拓、現地パートナー探索へ接続

---

## 2. 推奨名称

### 正式名称

**Launchers Strategy Simulator**

### 日本語名称

**ランチャーズ事業成長シミュレーター**

### 営業用メッセージ

> 5年後、今のままで会社はどうなるのか。変えるべき数字を、実行可能な経営戦略に変える。

「ランチャーズオリジナル戦略策定シミュレーションプログラム」でも意味は通じるが、やや長い。対外的には「事業成長シミュレーター」、提案書内では「戦略策定シミュレーション・プログラム」と表現するのが分かりやすい。

---

## 3. 元案を活かすために修正すべき点

### 3.1 過去5年の決算書だけでは不十分

PL・BS・CFだけでも会社全体の将来財務は作れるが、部門別売上、人員、給与、設備投資などを動かすには、管理会計データが必要になる。

最低限、次のデータを収集する。

- 過去3〜5年のPL・BS・CF
- 部門別または事業別の売上・粗利
- 人員数、平均給与、採用・退職計画
- 設備投資実績、固定資産残高、耐用年数
- 借入残高、金利、返済予定
- 売掛金、在庫、買掛金の回転日数
- 税率、配当、追加借入の方針

### 3.2 10年後の数字は「予測」ではなく「条件付きシナリオ」

10年後の売上や利益を一点で予言することはできない。表示すべきなのは、前提条件を明示した複数シナリオである。

- As-Is: 現状延長
- Downside: 金利、人件費、原材料費、需要が悪化
- Domestic Improvement: 価格、生産性、原価、国内新規事業を改善
- India Entry: インド市場参入
- Target Backsolve: 目標から必要条件を逆算

### 3.3 インドを最初から結論にしない

インド進出を必然の結論として組み込むと、診断の中立性が疑われる。まず国内改善、自動化、新規事業、M&A、他地域を含む選択肢を比較し、その中でインドが合理的なら推奨する。

インドは「結論」ではなく、Launchersが強みを持つ独自の戦略モジュールとして実装する。

### 3.4 AIに財務計算をさせない

LLMにPL・BS・CFを直接計算させると、再現性、精度、監査性が不足する。計算は決定論的な数式エンジンで行い、AIは補助に限定する。

---

## 4. 顧客体験

### Step 1: データ投入

顧客は標準Excelテンプレートに過去実績と主要ドライバーを入力する。初期版では、自由形式PDFの自動読取より、標準ExcelとCSVを優先する。

### Step 2: データ整合性チェック

システムが以下を検証する。

- PL・BS・CFの期間一致
- BSの貸借一致
- CFと現預金増減の一致
- 勘定科目の符号
- 欠損値、異常値、単位の違い
- 部門合計と全社合計の一致

### Step 3: ドライバー設定

売上、人員、人件費、原価、設備投資、運転資本、借入、税率などを設定する。

### Step 4: As-Is生成

過去実績、直近計画、外部指標を基に現状延長シナリオを作る。AIが前提を提案しても、必ずユーザーが承認・修正する。

### Step 5: 複数シナリオ比較

スライダーまたは表で前提を変え、PL・BS・CF、資金残高、借入、主要KPIへの影響を即時表示する。

### Step 6: 目標から逆算

例:

- 5年後売上100億円
- EBITDAマージン10%
- 最低現金残高3億円
- ROIC 8%以上

これらを満たすために必要な、価格上昇率、生産性改善率、新規売上、人員計画、設備投資、資金調達を逆算する。

### Step 7: 戦略アクション化

システムが数値ギャップを、具体的な経営課題と施策候補に変換する。

### Step 8: インドGo / No-Go

国内施策だけでは目標達成が困難な場合などに、インド市場参入の財務効果、必要投資、リスク、組織準備度を評価する。

### Step 9: レポート出力

- 経営者向け1ページサマリー
- 5年・10年財務三表
- シナリオ比較
- 感応度分析
- 戦略ギャップ
- 優先施策
- India Go / No-Go判定
- 前提条件と出典一覧

---

## 5. 最小実用版の対象

### 推奨ターゲット

- 日本の中堅・中小企業
- 特に製造業、卸売、B2Bサービス
- 年商10億〜300億円程度
- 管理会計や中期計画がExcel中心
- 人手不足、賃金上昇、設備更新、国内市場停滞に直面
- 海外展開やインド進出を検討し始めている

### 初期版の粒度

- 年次モデル
- 過去5年＋将来10年
- 単体企業
- 最大10事業部門
- 最大5シナリオ
- 日本円
- インドシナリオのみINR・為替換算に対応

### 初期版では除外

- 連結会計
- 月次ローリングフォーキャスト
- 複雑な税効果会計
- リース会計
- 多段階の製造原価計算
- ERPとのリアルタイム連携
- ブラックボックス型AI予測
- 完全自動の投資判断

---

## 6. 財務モデル

### 6.1 売上

部門または事業単位で計算する。

```text
Revenue[t]
  = Revenue[t-1]
  × (1 + VolumeGrowth[t])
  × (1 + PriceGrowth[t])
  + NewBusinessRevenue[t]
  - LostRevenue[t]
```

顧客数と単価が取れる企業では、より具体的にする。

```text
Revenue[t] = Customers[t] × UnitsPerCustomer[t] × UnitPrice[t]
```

### 6.2 売上原価

```text
VariableCOGS[t] = Revenue[t] × VariableCOGSRate[t]
FixedManufacturingCost[t]
  = FixedManufacturingCost[t-1]
  × (1 + CostInflation[t] - ProductivityImprovement[t])
```

### 6.3 人員・人件費

```text
EndingFTE[t] = BeginningFTE[t] + Hires[t] - Exits[t]
AverageFTE[t] = (BeginningFTE[t] + EndingFTE[t]) / 2
AverageSalary[t] = AverageSalary[t-1] × (1 + SalaryGrowth[t])
PersonnelCost[t]
  = AverageFTE[t]
  × AverageSalary[t]
  × (1 + BenefitAndSocialInsuranceRate[t])
```

### 6.4 設備投資・減価償却

設備投資を以下に分ける。

- 維持更新投資
- 能力増強投資
- 成長投資
- IT・DX投資
- インド進出投資

```text
MaintenanceCapex[t] = Revenue[t] × MaintenanceCapexRate[t]
GrowthCapex[t] = UserDefinedSchedule[t]
TotalCapex[t] = MaintenanceCapex[t] + GrowthCapex[t]
```

減価償却は、既存資産と各年度の投資ビンテージ別に耐用年数を持って計算する。

```text
Depreciation[t]
  = ExistingAssetDepreciation[t]
  + Sum(CapexVintage[v] / UsefulLife[v])
```

### 6.5 運転資本

```text
AccountsReceivable[t] = Revenue[t] / 365 × DSO[t]
Inventory[t] = COGS[t] / 365 × DIO[t]
AccountsPayable[t] = COGS[t] / 365 × DPO[t]
NetWorkingCapital[t]
  = AccountsReceivable[t] + Inventory[t] - AccountsPayable[t]
```

### 6.6 借入・金利

```text
EndingDebt[t] = BeginningDebt[t] + NewBorrowing[t] - Repayment[t]
AverageDebt[t] = (BeginningDebt[t] + EndingDebt[t]) / 2
InterestExpense[t] = AverageDebt[t] × BorrowingRate[t] + Fees[t]
```

金利上昇は全借入に一律適用せず、固定金利、変動金利、借換時期を分ける。

### 6.7 税金

初期版では簡易計算とする。

```text
Tax[t] = max(PreTaxIncome[t], 0) × EffectiveTaxRate[t]
```

### 6.8 キャッシュフロー

```text
CFO[t]
  = NetIncome[t]
  + Depreciation[t]
  - ChangeInNetWorkingCapital[t]
  + OtherNonCashItems[t]

CFI[t] = -TotalCapex[t] + AssetSaleProceeds[t]

CFF[t]
  = NewBorrowing[t]
  - DebtRepayment[t]
  + EquityInjection[t]
  - Dividends[t]

EndingCash[t]
  = BeginningCash[t] + CFO[t] + CFI[t] + CFF[t]
```

### 6.9 貸借一致

各年度で次を満たさなければならない。

```text
Assets[t] = Liabilities[t] + Equity[t]
```

誤差が許容範囲を超えた場合、結果画面を表示せずエラーを出す。

---

## 7. 主要変数

| 領域 | 主要変数 |
|---|---|
| 売上 | 数量成長、価格上昇、新規顧客、顧客流出、新規事業、為替 |
| 原価 | 原材料価格、仕入価格、物流費、歩留まり、生産性、外注比率 |
| 人員 | 部門別FTE、採用、退職、平均給与、昇給率、賞与、社会保険 |
| 販管費 | 賃料、IT、広告、旅費、専門家費用、物価連動率 |
| 設備 | 維持投資、能力増強、DX、耐用年数、稼働開始時期 |
| 運転資本 | DSO、DIO、DPO、前受金、前払金 |
| 財務 | 固定・変動金利、返済、借換、新規借入、配当 |
| 税務 | 実効税率、繰越欠損金の簡易取扱い |
| 外部環境 | GDP、業界成長率、CPI、賃金、金利、為替、エネルギー価格 |
| インド | 市場成長、現地価格、数量、関税、物流、現地人件費、為替、税、立上げ費 |

---

## 8. シナリオ設計

### Scenario A: As-Is

現在の事業構造、過去トレンド、公開されているマクロ見通しを基にする。何もしないという意味ではなく、既存方針を継続した場合の基準線である。

### Scenario B: Downside

- 売上成長鈍化
- 人件費上昇
- 原材料費上昇
- 借入金利上昇
- 回収日数悪化
- 設備投資超過

### Scenario C: Domestic Improvement

- 値上げ
- 生産性向上
- 自動化
- 原価低減
- 不採算事業整理
- 国内新規顧客・新規事業

### Scenario D: India Entry

- 参入準備期間
- 初期投資
- 現地採用
- 売上立上がり
- 価格・粗利
- 為替
- 運転資本
- 関税・物流
- 追加資金

### Scenario E: Target Backsolve

経営目標から、必要なドライバー水準を逆算する。

目標例:

- 売上
- EBITDA
- 営業利益率
- ROIC
- フリーキャッシュフロー
- 現金残高
- 有利子負債倍率
- DSCR

---

## 9. 感応度分析と逆算

### 感応度分析

各変数を単独または組み合わせて変化させる。

- 売上成長率 ±1%、±3%、±5%
- 人件費上昇率 ±1%、±2%
- 金利 +0.5%、+1.0%、+2.0%
- DSO +10日、+20日
- 設備投資 ±10%、±20%
- 為替 ±10%

出力:

- EBITDAへの影響
- 営業利益への影響
- 現金残高への影響
- 最大資金不足額
- 投資余力
- 借入余力

### 逆算

単純な予測より重要な機能である。

例:

> 5年後に営業利益率8%を達成するためには、平均単価を何%、生産性を何%、新規売上をいくら改善する必要があるか。

初期版では、制約付きグリッドサーチまたは数値最適化で実装する。

制約例:

- 値上げは年5%以内
- 採用は年20名以内
- 設備投資は年間3億円以内
- 現金残高は1億円以上
- Debt / EBITDAは4倍以下

---

## 10. AIの担当範囲

### AIを使う機能

1. 勘定科目の自動マッピング候補
2. 欠損・異常値の説明候補
3. 顧客への追加質問の生成
4. 過去トレンドの要約
5. マクロ・業界前提の候補提示
6. シナリオの説明
7. 主要な変動要因の要約
8. 戦略ギャップの文章化
9. 施策候補の生成
10. India Go / No-Goの論点整理
11. 経営者向けレポート作成

### AIを使わない機能

1. 財務三表の計算
2. 貸借一致判定
3. 金利・減価償却・税金計算
4. 感応度計算
5. 逆算ロジック
6. KPI計算
7. Go / No-Goの最終決定

### AI利用の原則

- AIの提案と確定値を区別する
- すべての前提に作成者、作成日、出典、承認状態を持たせる
- AIが作った前提はユーザー承認前に計算へ反映しない
- AI文章には、根拠となる計算値と出典を紐づける
- 顧客データを外部AIへ送る範囲を最小化する

---

## 11. 外部データライブラリ

初期版では、リアルタイムAPI連携より、管理者が定期更新する前提テーブルでよい。

候補:

- 日本銀行「経済・物価情勢の展望」
- 内閣府「中長期の経済財政に関する試算」
- 厚生労働省「毎月勤労統計調査」
- 総務省統計局「消費者物価指数」
- 日本銀行「短観」
- 経済産業省「企業活動基本調査」「経済構造実態調査」
- 業界団体の需要見通し
- 顧客企業が保有する受注・案件・顧客データ

各前提には次を持たせる。

```text
VariableName
Value
Unit
ApplicableIndustry
ApplicableCompanySize
Geography
StartYear
EndYear
SourceName
SourcePublicationDate
RetrievedDate
ConfidenceLevel
Notes
```

---

## 12. India Go / No-Goモジュール

### 評価領域

1. 市場魅力度
2. 自社戦略との適合
3. 顧客・販路へのアクセス
4. 製品・価格の競争力
5. 現地化難易度
6. 人材・組織準備度
7. 規制・税務・法務
8. サプライチェーン
9. 財務リターン
10. 資金耐久力

### 財務入力

- 参入準備費
- 法人設立費
- 現地人員
- 営業・マーケティング費
- 倉庫・工場・設備
- 輸送費・関税
- 売上立上がり曲線
- 粗利率
- 売掛回収日数
- 為替レート
- 撤退費用

### 出力

- 5年・10年売上、利益、CF
- 累積投資額
- 最大資金需要
- 単年度黒字化時期
- 累積CF黒字化時期
- NPV、IRRの参考値
- 為替・売上・粗利の感応度
- Go / Conditional Go / No-Go
- 判定理由
- Goに必要な前提条件

### 判定上の重要ルール

総合点だけで決めない。以下の重大条件に抵触した場合は、点数が高くてもConditional GoまたはNo-Goとする。

- 最大資金需要を賄えない
- 現地責任者がいない
- 初期顧客仮説がない
- 法規制上の重大障害がある
- 重要品質要件を満たせない
- 国内事業の資金繰りを悪化させる

---

## 13. 画面構成

### 1. Project Setup

- 会社名
- 業種
- 基準年度
- 予測期間
- 通貨
- 部門

### 2. Data Import & Mapping

- Excel / CSVアップロード
- 勘定科目マッピング
- 単位・符号確認
- エラー一覧

### 3. Historical Dashboard

- 売上・利益推移
- 利益率
- FTE・人件費
- 運転資本
- 設備投資
- 借入・現金

### 4. Assumption Center

- 部門×年度×変数の前提表
- Base / Downside / Target
- 出典・承認状態
- 一括変更

### 5. Scenario Builder

- シナリオ複製
- スライダー
- 投資イベント追加
- 新規事業追加
- India Entry追加

### 6. Financial Statements

- PL
- BS
- CF
- 部門別PL
- 貸借チェック

### 7. Insight Dashboard

- シナリオ比較
- キャッシュ残高
- EBITDAブリッジ
- 感応度トルネード
- 損益分岐点
- 資金不足警告

### 8. Strategy Gap

- 目標との差分
- 必要なドライバー改善
- 優先施策
- 施策ごとの財務効果

### 9. India Go / No-Go

- 評価表
- 財務シナリオ
- リスク
- 条件付きGoの条件

### 10. Report Export

- Excel
- PDF
- PowerPoint用サマリー
- 前提一覧

---

## 14. 推奨開発方針

### Phase 0: 内部コンサルティング用プロトタイプ

顧客自身が自由に使うSaaSではなく、Launchers担当者が顧客と一緒に使うツールとして作る。

推奨技術:

- Python
- Streamlit
- pandasまたはPolars
- Pydantic
- Decimal
- Plotly
- openpyxl
- SQLiteまたはローカルファイル
- pytest

理由:

- 財務ロジックの検証を優先できる
- Excel入出力が容易
- 画面を短いコードで作れる
- 顧客ヒアリングのたびにモデルを修正しやすい
- SaaS認証、課金、権限管理を後回しにできる

### Phase 1: 顧客ポータル化

モデルが2〜3社で安定した後にWebアプリ化する。

推奨技術:

- Next.js frontend
- FastAPI backend
- PostgreSQLまたはSupabase
- オブジェクトストレージ
- テナント分離
- 監査ログ
- ロール権限
- 暗号化

---

## 15. 推奨コード構造

```text
launchers-strategy-simulator/
├── app.py
├── pages/
│   ├── 01_project_setup.py
│   ├── 02_data_import.py
│   ├── 03_historical_dashboard.py
│   ├── 04_assumptions.py
│   ├── 05_scenarios.py
│   ├── 06_financial_statements.py
│   ├── 07_insights.py
│   ├── 08_strategy_gap.py
│   ├── 09_india_go_no_go.py
│   └── 10_export.py
├── finance_engine/
│   ├── models.py
│   ├── revenue.py
│   ├── personnel.py
│   ├── costs.py
│   ├── capex.py
│   ├── depreciation.py
│   ├── working_capital.py
│   ├── debt.py
│   ├── tax.py
│   ├── statements.py
│   ├── validation.py
│   ├── sensitivity.py
│   └── goal_seek.py
├── ingestion/
│   ├── excel_template.py
│   ├── importer.py
│   ├── mapping.py
│   └── validation.py
├── strategy/
│   ├── gap_analysis.py
│   ├── action_library.py
│   └── india_scorecard.py
├── ai/
│   ├── interface.py
│   ├── mapping_assistant.py
│   ├── assumption_assistant.py
│   └── narrative_generator.py
├── reports/
│   ├── excel_export.py
│   ├── pdf_export.py
│   └── executive_summary.py
├── sample_data/
├── tests/
├── pyproject.toml
├── README.md
└── .env.example
```

---

## 16. データモデル

主要エンティティ:

- Company
- BusinessUnit
- Period
- Account
- ActualValue
- DriverDefinition
- AssumptionSet
- AssumptionValue
- Scenario
- ForecastValue
- AssetClass
- CapexEvent
- DebtInstrument
- HeadcountPlan
- ExternalBenchmark
- StrategicTarget
- StrategicAction
- IndiaEntryPlan
- SourceReference
- AuditLog

各数値に最低限必要な属性:

```text
company_id
business_unit_id
scenario_id
period
metric
value
unit
source
status
created_by
created_at
updated_at
```

---

## 17. 品質要件

### 計算品質

- 同じ入力では常に同じ結果
- BSが一致
- 現預金の増減がCFと一致
- 期末残高が翌期首へ正しく繰り越される
- シナリオ間で実績値は変わらない
- 金額計算にDecimalを使用
- 丸めは表示時に行う

### テスト

最低限、次のテストを作る。

1. 売上成長計算
2. 人員ロールフォワード
3. 人件費計算
4. Capexと減価償却
5. DSO / DIO / DPO
6. 借入と金利
7. PL・BS・CF連動
8. 貸借一致
9. シナリオ複製
10. 感応度分析
11. 目標逆算
12. Excel入出力

### 説明可能性

すべての結果から、以下へ遡れること。

```text
出力数値
→ 計算式
→ 使用した前提
→ 前提の出典
→ 変更者
→ 変更日時
```

---

## 18. 無料診断から有料案件への導線

### 無料: Launchers 5-Year As-Is Check

顧客提出:

- 過去3〜5年の決算
- 部門別売上
- 人員・人件費
- 設備投資
- 借入

Launchers提出:

- As-Is 5年財務
- Downsideシナリオ
- 主要リスク5項目
- キャッシュ不足時期
- 重要ドライバー感応度
- 経営者向け1ページサマリー

### 有料1: Target Strategy Design

- 目標財務
- 目標からの逆算
- 国内改善策
- 新規事業案
- 投資計画
- 経営会議用資料

### 有料2: India Go / No-Go

- 市場調査
- 顧客仮説
- 競合・価格
- 参入モデル
- 財務シナリオ
- Go / No-Go

### 有料3: Execution Support

- 現地パートナー探索
- 顧客開拓
- PoC
- 拠点設立
- 採用
- 月次モニタリング

---

## 19. 営業時の説明

### 良い説明

> 過去の決算をグラフ化するだけではなく、人件費、金利、設備投資、価格、数量、運転資本を変えた場合に、5年後・10年後の利益とキャッシュがどう変わるかを可視化します。そのうえで、目標を達成するために必要な施策を逆算し、国内改善、新規事業、海外展開を比較します。

### 避ける説明

> AIが御社の10年後を正確に予測します。

### 信頼を高める説明

> 数字はすべて前提条件付きのシミュレーションです。計算式、前提、出典を確認でき、経営者がその場で条件を変更できます。

---

## 20. Codexに渡すマスタープロンプト

以下をそのままCodexへ渡し、Phase 0の内部用プロトタイプを作る。

```text
You are building a production-quality internal financial strategy simulation prototype called “Launchers Strategy Simulator.”

Goal:
Build a locally runnable Streamlit application that imports five years of historical company data, accepts driver assumptions, produces an integrated 10-year profit-and-loss statement, balance sheet, and cash-flow statement, compares scenarios, runs sensitivity analysis, and converts target financial goals into required operating assumptions.

Core principle:
Do not use an LLM for financial calculations. All calculations must be deterministic, auditable, reproducible, and covered by tests. AI features must be optional and isolated behind an interface. The app must work fully without an AI API key.

Target user:
A consultant working interactively with a Japanese mid-sized company, initially in manufacturing, wholesale, or B2B services.

Tech stack:
- Python 3
- Streamlit
- pandas or Polars
- Pydantic models
- Python Decimal for monetary calculations
- Plotly for charts
- openpyxl for Excel import/export
- pytest
- SQLite or JSON/Parquet for local prototype persistence

Repository requirements:
- Use the directory structure described in the product blueprint.
- Include a complete README with setup and run instructions.
- Include pyproject.toml.
- Include .env.example.
- Include sample data for a fictional Japanese manufacturing company.
- Include a command or script that generates the input Excel template.
- Include meaningful type hints, docstrings, validation, and error messages.

MVP features:
1. Project setup
   - Company name
   - Industry
   - Base fiscal year
   - Forecast horizon: 5 or 10 years
   - Currency
   - Business units

2. Excel import
   Required sheets:
   - Historical_PL
   - Historical_BS
   - Historical_CF
   - Business_Units
   - Headcount
   - Capex_Assets
   - Debt
   - Assumptions

3. Data validation
   - Required columns
   - Duplicate periods
   - Invalid signs
   - Missing values
   - Balance sheet balance check
   - Cash-flow reconciliation
   - Business-unit totals versus company totals
   - Display clear blocking and non-blocking errors

4. Historical dashboard
   - Revenue
   - Gross profit
   - EBITDA
   - Operating profit
   - Net income
   - Cash
   - Debt
   - Headcount
   - Personnel cost
   - Capex
   - DSO, DIO, DPO

5. Assumption center
   Inputs by scenario, business unit, and forecast year:
   - Volume growth
   - Price growth
   - New-business revenue
   - Variable COGS ratio
   - Cost inflation
   - Productivity improvement
   - Beginning and ending FTE
   - Salary growth
   - Benefits and social insurance rate
   - SG&A inflation
   - Maintenance capex ratio
   - Growth capex schedule
   - Useful life by asset class
   - DSO, DIO, DPO
   - Borrowing rate
   - New borrowing
   - Debt repayment
   - Effective tax rate
   - Dividends

6. Scenarios
   Include default scenarios:
   - As-Is
   - Downside
   - Domestic Improvement
   - India Entry
   - Target Backsolve
   Allow scenario cloning and editing.

7. Deterministic finance engine
   Implement pure functions for:
   - Revenue
   - COGS
   - Personnel
   - SG&A
   - Capex
   - Depreciation by asset vintage
   - Working capital
   - Debt and interest
   - Tax
   - P&L
   - Balance sheet
   - Cash flow
   - KPI calculations
   - Balance validation

8. KPIs
   - Revenue CAGR
   - Gross margin
   - EBITDA and EBITDA margin
   - Operating margin
   - Net margin
   - Free cash flow
   - ROIC
   - Net debt / EBITDA
   - DSCR
   - Minimum cash balance
   - Break-even revenue

9. Scenario comparison dashboard
   - Revenue
   - EBITDA
   - Operating profit
   - Free cash flow
   - Ending cash
   - Debt
   - Capex
   Use line charts, waterfall or bridge charts where appropriate, and comparison tables.

10. Sensitivity analysis
    Allow the user to define ranges for:
    - Revenue growth
    - Price growth
    - Salary growth
    - Borrowing rate
    - Capex
    - DSO
    - Exchange rate for India scenario
    Display impact on EBITDA, free cash flow, and minimum cash.

11. Goal seek
    Let the user enter targets such as:
    - Year-5 revenue
    - EBITDA margin
    - Minimum cash
    - ROIC
    Use constrained grid search or an optimization library to find feasible combinations of:
    - Price growth
    - Volume growth
    - Productivity improvement
    - New-business revenue
    - FTE plan
    - Capex
    Show multiple feasible solutions and explain trade-offs.

12. Strategy gap screen
    Calculate the difference between As-Is and Target.
    Map numerical gaps to a rule-based action library:
    - Pricing
    - Productivity
    - Procurement
    - Automation
    - Headcount redesign
    - Working-capital improvement
    - Domestic new business
    - M&A
    - India entry
    AI-generated narrative is optional and must never change calculated values.

13. India Go / No-Go screen
    Inputs:
    - Entry preparation period
    - Initial setup cost
    - Local headcount and salary
    - Sales ramp
    - Local price and gross margin
    - Logistics and tariff
    - Capex
    - DSO
    - Exchange rate
    - Tax
    Outputs:
    - Revenue, EBITDA, and cash flow
    - Cumulative investment
    - Peak funding need
    - Operating break-even year
    - Cash break-even year
    - NPV and IRR reference values
    - Sensitivity to sales, gross margin, and FX
    - Go, Conditional Go, or No-Go based on configurable rules

14. Export
    - Export all assumptions and statements to Excel
    - Export scenario comparison tables
    - Export an executive-summary worksheet
    - Include source and audit fields

Data and audit requirements:
- Each assumption must have source_name, source_date, confidence, status, created_by, and updated_at.
- AI-suggested assumptions must remain in “suggested” status until approved.
- Scenario results must be reproducible from saved assumptions.
- Store formulas and model version in exports.

Testing requirements:
Create unit tests for all calculation modules and integration tests for:
- A balanced three-statement model
- Cash-flow reconciliation
- Capex and depreciation roll-forward
- Debt and interest roll-forward
- Working-capital changes
- Scenario cloning
- Sensitivity output
- Goal-seek feasibility
- Excel import/export round trip

Acceptance criteria:
- The sample company imports without error.
- The application generates 10 forecast years.
- Assets equal liabilities plus equity for every year within a one-yen tolerance.
- Ending cash reconciles to the cash-flow statement.
- Changing a driver updates all related statements.
- The app can run with no AI API key.
- All tests pass.

Implementation order:
1. Define schemas and sample data.
2. Build and test the finance engine.
3. Build Excel template and importer.
4. Build Streamlit pages.
5. Add scenario comparison and sensitivity.
6. Add goal seek.
7. Add strategy gap and India module.
8. Add export.
9. Add optional AI interface last.

Do not start by building authentication, billing, multi-tenancy, ERP integrations, or a polished SaaS design. Prioritize financial correctness, traceability, and a usable consultant-led workflow.
```

---

## 21. 最初に顧客と作る際の進め方

1. 1社を選ぶ
2. NDAとデータ取扱いを確認する
3. 標準Excelテンプレートを渡す
4. 5年実績を取り込む
5. 経営者・経理・営業・製造から主要ドライバーを確認する
6. As-Isを作る
7. Downsideを作る
8. 目標を設定する
9. 必要条件を逆算する
10. 国内改善とインド進出を比較する
11. 経営会議形式でレビューする
12. 不足機能と不自然な計算を記録し、モデルを修正する

最初の目的は、ソフトを完成させることではない。経営者が「この数字なら議論できる」「この前提なら変えたい」と反応するモデルを作ることである。

---

## 22. 成功判定

初期検証では、次を確認する。

- 顧客が過去データを準備できるか
- どのデータが毎回欠けるか
- 経営者が実際に動かしたい変数は何か
- As-Is結果に納得感があるか
- シナリオ変更が経営議論を生むか
- 目標逆算が意思決定に役立つか
- India Go / No-Goへ自然につながるか
- 無料診断から有料支援へ進む理由が生まれるか

---

## 23. 最終的な差別化

既存の予算管理ソフトと異なる価値は、計算機能そのものではない。

1. 日本の中堅企業向けに短時間で立ち上げる
2. 5年・10年のAs-Isを明示する
3. 目標から必要条件を逆算する
4. 財務と戦略アクションをつなぐ
5. 国内改善と海外展開を比較する
6. インド進出を独立したGo / No-Goモジュールで評価する
7. 結果をLaunchersの実行支援へつなぐ

この設計なら、ソフト販売ではなく、経営対話を始めるための独自メソッドとして機能する。

# Capital Launchers 企業価値簡易診断

LINE登録後にスマートフォンから利用するPhase 0向けの簡易診断です。過去3期の売上高・営業利益・最終利益・現預金・減価償却費（万円）から傾向と変動幅を推定し、10,000経路のモンテカルロ・シミュレーションで5年後・10年後の主要指標と簡易企業価値を表示します。ログインや会員登録は不要です。

簡易企業価値は次の固定式で計算します。

```text
簡易EBITDA = 営業利益 + 減価償却費
簡易企業価値 = 現預金 + 簡易EBITDA × 3
```

将来値はGPTでは生成しません。入力値から売上成長率、営業利益率、最終利益率、減価償却率、現金転換率を推定し、観測期間が3期と短いことを考慮した保守的な変動幅を加えてブラウザ内で計算します。同じ入力からは同じ結果を再現でき、結果画面には中央値、P10〜P90、企業価値低下確率、10年以内の営業赤字確率を表示します。CAGRは過去実績の参考値として併記します。

公式LINE CTAは `.env.local` の `VITE_LINE_OFFICIAL_URL` で設定します。URL内の `{message}` は、診断完了後の定型メッセージに置き換わります。

```dotenv
VITE_LINE_OFFICIAL_URL=https://line.me/R/oaMessage/YOUR_LINE_ID/?{message}
```

診断後のGPT経営示唆は、計算済みの分布と確率をVercel Function `/api/diagnosis-insight` からOpenAI Responses APIへ渡して解釈します。GPTは予測値を計算・変更しません。APIキーはブラウザへ渡さず、`.env.local`（本番ではVercel Environment Variables）のサーバー専用変数として設定してください。

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-sol
```

OpenAIへのリクエストは `store: false` で送信し、本アプリのデータベースにも診断値を保存しません。会社名はGPTへ送信せず、任意入力された業種と計算済みの診断数値だけを送信します。

## 既存の戦略シミュレーター

日本の中堅企業向けに、過去実績・事業ドライバー・経営目標をつなぎ、5年・10年の財務と戦略アクションを可視化する事業成長シミュレーターです。赤を基調とした管理画面に、Supabaseの認証・永続化・企業分離と、OpenAIによる経営レビューを統合しています。

## 実装範囲

- 決定論的な財務計算（PL・BS・CF、貸借チェック、感応度、目標逆算）
- Supabase Authによるメール／パスワード認証
- 組織・会社・プロジェクト・シナリオ・計算実行の永続保存
- 組織単位のRow Level Security（RLS）
- Excel原本のprivate Storage保存と検証結果の記録
- サーバー側での再計算、入力ハッシュ、計算履歴、監査ログ
- OpenAI Responses APIによる構造化された経営レビュー
- AI提案と確定計算の分離（AIは財務数値を再計算しません）
- Supabase未設定時のデモモード
- Vercel FunctionsとSPA配信の設定

## アーキテクチャ

```text
Browser (React / Vite)
  ├─ Supabase Auth
  ├─ Supabase Database + RLS
  ├─ Supabase private Storage
  └─ /api/*
       ├─ forecast.ts ─ deterministic finance engine ─ DB history
       ├─ ai.ts ─ authenticated OpenAI review ─ AI suggestion history
       └─ diagnosis-insight.ts ─ anonymous diagnosis ─ OpenAI Responses API
```

秘密鍵はブラウザへ渡しません。`SUPABASE_SECRET_KEY` と `OPENAI_API_KEY` はVercel Functionsだけが参照します。

## ローカル実行

必要環境はNode.js 20以降です。

```bash
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` はPhase 0画面とローカル用GPT APIを同時に起動します。`.env.local` の `OPENAI_API_KEY` はViteのブラウザ環境変数には変換せず、ローカルAPIのサーバープロセスだけが読み込みます。

`OPENAI_API_KEY` を設定しない場合も確定計算の診断結果は表示できますが、GPT経営示唆は利用できません。

## Supabaseセットアップ

1. Supabaseでプロジェクトを作成します。
2. SQL Editorで [初期マイグレーション](./supabase/migrations/202607290001_initial_schema.sql) を実行します。
3. AuthenticationのEmail providerを有効にします。
4. `.env.local` にProject URLとPublishable keyを設定します。

マイグレーションには、全テーブル、RLSポリシー、初回ワークスペース作成RPC、原子的な保存RPC、private Storage bucketが含まれます。

ローカルのブラウザ用変数:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

サーバー用変数:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-sol
```

`SUPABASE_SECRET_KEY` と `OPENAI_API_KEY` に `VITE_` を付けないでください。付けるとクライアントバンドルへ露出します。

## Vercelへデプロイ

リポジトリをGitHub等へpushし、VercelでImportします。VercelのProject Settingsで `.env.example` と同じ6変数をDevelopment / Preview / Productionへ登録してください。

```bash
npx vercel
npx vercel --prod
```

フレームワーク、ビルド、Vercel Functionsの実行時間、SPA rewriteは [vercel.json](./vercel.json) に設定済みです。Supabase AuthenticationのSite URLとRedirect URLsには、Vercelの本番URLと必要なPreview URLを登録します。

## 検証

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 主なファイル

```text
api/
├── forecast.ts              # サーバー確定計算と履歴保存
└── ai.ts                    # OpenAI構造化レビュー
server/
├── auth.ts                  # JWT検証とプロジェクト権限確認
└── types.ts                 # Vercel互換の最小HTTP型
src/
├── ai/schema.ts             # AI入出力スキーマ
├── finance/                 # 決定論的な財務計算
├── ingestion/excel.ts       # Excel取込・検証・出力
├── platform/auth.tsx        # 認証境界
├── platform/repository.ts   # Supabase保存・読込・Storage
├── platform/api.ts          # Vercel APIクライアント
├── App.tsx                  # 画面と統合フロー
└── styles.css               # 赤テーマとレスポンシブUI
supabase/migrations/
└── 202607290001_initial_schema.sql
```

## 運用上の注意

- AI出力は`ai_suggestions`へ「提案」として保存され、計算前提へ自動反映されません。
- VercelとSupabase双方のログ保持、バックアップ、MFA、メンバー招待フローは組織の運用方針に合わせて設定してください。
- ERP連携、連結会計、承認ワークフロー、請求・課金は現スコープ外です。

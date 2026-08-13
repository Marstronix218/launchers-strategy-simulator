# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-08-12
- Primary product surfaces: 認証、無料簡易診断、プロジェクト準備、シミュレーション、戦略・レポート
- Evidence reviewed: `README.md`, `launchers_strategy_simulator_blueprint.md`, `src/App.tsx`, `src/styles.css`, `src/platform/auth.tsx`, `src/data/sample.ts`

## Brand
- Personality: 信頼できる経営参謀。落ち着きがあり、数値根拠を簡潔に示す。
- Trust signals: 決定論的な計算、貸借一致、出典・承認状態、クラウド保存状態、AIと確定計算の分離。
- Avoid: AIが数値を決めたように見せる表現、専門語だけの案内、初回から全機能を同じ重要度で見せること。

## Product goals
- Goals: 過去実績・事業ドライバー・経営目標をつなぎ、5年・10年の意思決定を支援する。
- Non-goals: 会計・税務・投資判断の代替、ERP・連結会計・承認ワークフローの提供。
- Success signals: 初回ユーザーが会社情報→財務データ→前提→結果の順番を理解し、自力で診断結果まで到達できる。

## Personas and jobs
- Primary personas: 日本の中堅企業の経営者、経営企画・財務責任者、支援するコンサルタント。
- User jobs: 自社データを整え、前提を合意し、複数シナリオと資金リスクを比較し、経営会議用の資料を作る。
- Key contexts of use: 初回の試用、計画策定、前提更新、経営会議前のレビュー。

## Information architecture
- Primary navigation: 準備、シミュレーション、戦略の3群。
- Core routes/screens: 診断、設定、取込、実績、前提、シナリオ、財務三表、インサイト、ギャップ、India判定、出力。
- Content hierarchy: 初回は「4ステップのかんたんスタート」を主導線とし、サイドバーは全機能へ戻る補助導線とする。

## Design principles
- Principle 1: 次の一手を常に1つ明示し、全体の中の現在地と完了条件を併記する。
- Principle 2: サンプルデータと自社データ、デモとクラウド保存を見た目と言葉の両方で区別する。
- Tradeoffs: 熟練者の自由な画面移動は維持しつつ、初回ガイドは折りたたみ可能にする。

## Visual language
- Color: 既存の赤・クリーム・紙色を継承。進行中は赤、完了は落ち着いた緑、未着手は中立色。
- Typography: `DM Sans` と `Noto Sans JP`。ページ見出しは既存のGeorgia系を維持。
- Spacing/layout rhythm: 8px前後の倍数を基本に、ガイドは既存パネルと同じ角丸・余白に合わせる。
- Shape/radius/elevation: 8–15pxの角丸、弱い影。オンボーディングだけをモーダルで遮断しない。
- Motion: 既存の短いhover・drawer遷移のみ。進行に不要なアニメーションは追加しない。
- Imagery/iconography: `lucide-react` の線画アイコンを再利用する。

## Components
- Existing components to reuse: `.panel`, `.button`, `StatusPill`, `notice`, Lucide icons。
- New/changed components: 折りたたみ可能な `OnboardingGuide`、サンプルデータ表示、画面ごとの次アクション。
- Variants and states: 未着手、現在、完了、入力エラーで続行不可、全完了。
- Token/component ownership: 色・余白は `src/styles.css` の既存CSS変数を使用し、新しいデザインシステム層は作らない。

## Accessibility
- Target standard: WCAG 2.1 AAを目標とする。
- Keyboard/focus behavior: ステップは実buttonとし、折りたたみ・次へもキーボード操作可能にする。
- Contrast/readability: 状態を色だけに依存させず、番号・チェック・状態文言を併記する。
- Screen-reader semantics: ガイドに`aria-label`、進捗に`role="progressbar"`、状態更新に`aria-live`を使う。
- Reduced motion and sensory considerations: 意味のある情報をアニメーションだけで伝えない。

## Responsive behavior
- Supported breakpoints/devices: 320px以上のスマートフォン、タブレット、デスクトップ。
- Layout adaptations: デスクトップは4ステップ横並び、狭い画面は縦並び。主CTAはモバイルで全幅。
- Touch/hover differences: タップ領域は最低39px程度を維持し、hoverなしでも状態が分かる。

## Interaction states
- Loading: 既存のクラウド・取込ローディングを使い、次へを無効化する。
- Empty: Excel未取込時はサンプルで続けられることと、自社データ取込の違いを説明する。
- Error: 取込エラーがある場合は前提確認への続行を止め、修正行動を示す。
- Success: 完了ステップをチェック表示し、結果到達時にガイド完了を伝える。
- Disabled: 理由が近接テキストから分かるようにする。
- Offline/slow network, if applicable: デモではブラウザ内のみ、クラウドでは保存・AIが有効と明示する。

## Content voice
- Tone: 短く具体的で、初めての利用者にも専門用語を補足する。
- Terminology: 「前提条件」は「将来予測に使う前提」と補足し、「サンプル」「自社データ」を統一して使う。
- Microcopy rules: CTAは「確認する」だけでなく対象と結果を含める。所要時間と完了後に得られるものを先に示す。

## Implementation constraints
- Framework/styling system: React 19、TypeScript、単一CSS、既存コンポーネント構成。
- Design-token constraints: `--forest`, `--forest-2`, `--paper`, `--line`, `--muted`など既存変数を優先する。
- Performance constraints: 新規依存や画像を追加せず、ガイドは軽量なReact/CSSで実装する。
- Compatibility constraints: デモモードとSupabase接続モードの双方で同じ導線を使えること。
- Test/screenshot expectations: 進捗判定は純粋関数でテストし、typecheck・lint・unit test・buildを通す。

## Open questions
- [ ] サインアップ後の確認メール完了からガイドへ戻る計測 / Product / 初回到達率の分析に影響

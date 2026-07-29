import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  AIInsightSchema,
  AIReviewRequestSchema,
  type AIReviewMode,
} from "../src/ai/schema";
import {
  AuthError,
  authenticateRequest,
  requireProjectAccess,
} from "../server/auth";
import type { VercelRequest, VercelResponse } from "../server/types";

const MODE_INSTRUCTIONS: Record<AIReviewMode, string> = {
  account_mapping:
    "勘定科目の意味と候補マッピングを示す。確信できない項目は追加質問に回す。",
  anomaly_explanation:
    "異常値や欠損の可能性を、提示された数値と期間比較だけから説明する。",
  scenario_narrative:
    "シナリオの主要変動要因、リスク、経営上の含意を数値に紐づけて説明する。",
  strategy_actions:
    "As-Isと目標の差を埋める施策候補を、優先順位と財務的なつながり付きで提案する。",
  india_review:
    "インド参入のGo/Conditional Go/No-Goに関する論点を整理する。最終判定は行わない。",
  executive_summary:
    "経営者向けに結論、主要数値、重要リスク、次の意思決定を簡潔にまとめる。",
};

const SYSTEM_PROMPT = `Role: 日本の中堅企業を支援する財務戦略アナリスト。

Goal: 提供された確定済み計算結果を、経営判断に使える日本語の洞察へ変換する。

Success criteria:
- 観察事実と提案を明確に分ける
- 各観察は入力内の具体的な数値または状態を根拠にする
- 不足情報は推測せず、followUpQuestionsに入れる
- recommendationsは実行可能で、financialLinkに財務指標との関係を書く

Constraints:
- 財務数値を再計算、変更、補完しない
- 提供されていない市場データ、企業事実、出典を作らない
- AI出力は提案であり、承認前に計算へ反映しない
- 最終的な投資判断、融資判断、Go/No-Go判定を行わない

Output:
- 指定された構造化スキーマに厳密に従う
- 日本語で、経営会議にそのまま提示できる簡潔な文体にする`;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const auth = await authenticateRequest(request);
    const input = AIReviewRequestSchema.parse(request.body);
    const access = await requireProjectAccess(auth, input.projectId);
    const serializedContext = JSON.stringify(input.context);
    if (serializedContext.length > 80_000) {
      return response.status(413).json({
        error: "AI review context is too large. Send only the required metrics.",
      });
    }
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openaiKey) {
      return response.status(503).json({
        error: "OPENAI_API_KEY is not configured on the server.",
      });
    }
    const openai = new OpenAI({ apiKey: openaiKey });
    const safetyIdentifier = createHash("sha256")
      .update(auth.user.id)
      .digest("hex");
    const result = await openai.responses.parse({
      model,
      reasoning: { effort: "medium" },
      store: false,
      max_output_tokens: 2200,
      safety_identifier: safetyIdentifier,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Task: ${MODE_INSTRUCTIONS[input.mode]}

User note:
${input.userNote || "なし"}

Approved calculation context:
${serializedContext}`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(AIInsightSchema, "strategy_insight"),
        verbosity: "medium",
      },
      metadata: {
        project_id: input.projectId,
        review_mode: input.mode,
        prompt_version: "strategy-insight-v1",
      },
    });
    const insight = result.output_parsed;
    if (!insight) {
      return response.status(502).json({
        error: "The AI response did not match the required output schema.",
      });
    }

    let scenarioId: string | null = null;
    if (input.scenarioExternalId) {
      const { data: scenario } = await auth.admin
        .from("scenarios")
        .select("id")
        .eq("project_id", input.projectId)
        .eq("external_id", input.scenarioExternalId)
        .maybeSingle();
      scenarioId = scenario?.id ?? null;
    }
    const { data: suggestionId, error: suggestionError } = await auth.admin.rpc(
      "record_ai_suggestion",
      {
        p_organization_id: access.organizationId,
        p_project_id: input.projectId,
        p_scenario_id: scenarioId,
        p_suggestion_type: input.mode,
        p_model: result.model,
        p_prompt_version: "strategy-insight-v1",
        p_input_summary: {
          contextKeys: Object.keys(input.context),
          userNoteProvided: Boolean(input.userNote),
          responseId: result.id,
          usage: result.usage,
        },
        p_output: insight,
        p_created_by: auth.user.id,
      },
    );
    if (suggestionError || !suggestionId) {
      throw suggestionError ?? new Error("AI suggestion transaction failed.");
    }
    return response.status(200).json({
      suggestionId,
      model: result.model,
      insight,
    });
  } catch (caught) {
    if (caught instanceof AuthError) {
      return response.status(caught.status).json({ error: caught.message });
    }
    if (caught instanceof z.ZodError) {
      return response.status(400).json({
        error: "Invalid AI review request.",
        issues: caught.issues,
      });
    }
    console.error("AI endpoint failed", caught);
    return response.status(500).json({
      error: "AI review could not be recorded. Check the server logs.",
    });
  }
}

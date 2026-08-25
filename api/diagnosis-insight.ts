import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  DiagnosisInsightRequestSchema,
  DiagnosisInsightSchema,
} from "../src/ai/diagnosisSchema";
import {
  formatDiagnosisPromptInput,
  normalizeDiagnosisInsight,
} from "../server/diagnosisFormatting";
import type { VercelRequest, VercelResponse } from "../server/types";

const MAX_REQUESTS_PER_MINUTE = 5;
const requestWindows = new Map<string, { count: number; resetsAt: number }>();

const SYSTEM_PROMPT = `あなたは日本の中堅・中小企業オーナーを支援する経営アナリストです。

提供された数値は、過去3期のCAGRを機械的に5年後・10年後へ延伸した簡易診断結果です。
計算済みの数値を変更・再計算せず、経営者が次の面談で確認すべき論点へ変換してください。

必須条件:
- 日本語で簡潔に書く
- 事実と提案を分ける
- 入力にない市場データ、企業情報、原因を作らない
- 危機感を煽りすぎず、具体的な問いを残す
- 金額は1万円単位に四捨五入し、3桁カンマ付きの整数で書く（例: 63,537万円）
- 金額に小数点以下を表示しない
- 成長率は小数第1位までのパーセントで書く
- 投資・融資・海外進出の最終判断は行わない
- 簡易診断であり、専門家による確認が必要だと明示する`;

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function requestIdentity(request: VercelRequest): string {
  const forwardedFor = headerValue(request.headers["x-forwarded-for"]);
  const address = forwardedFor.split(",")[0]?.trim() || "anonymous";
  return createHash("sha256").update(address).digest("hex");
}

function isSameOrigin(request: VercelRequest): boolean {
  const origin = headerValue(request.headers.origin);
  const host = headerValue(request.headers.host);
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isRateLimited(identity: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(identity);
  if (!current || current.resetsAt <= now) {
    requestWindows.set(identity, { count: 1, resetsAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  response.setHeader("Cache-Control", "no-store");
  if (!isSameOrigin(request)) {
    return response.status(403).json({ error: "Cross-origin requests are not allowed." });
  }

  const identity = requestIdentity(request);
  if (isRateLimited(identity)) {
    return response.status(429).json({
      error: "短時間の利用上限に達しました。1分ほど待ってから再度お試しください。",
    });
  }

  try {
    const serializedBody = JSON.stringify(request.body ?? {});
    if (serializedBody.length > 12_000) {
      return response.status(413).json({ error: "診断データが大きすぎます。" });
    }
    const input = DiagnosisInsightRequestSchema.parse(request.body);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return response.status(503).json({
        error: "GPT分析がサーバーで設定されていません。",
      });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";
    const openai = new OpenAI({ apiKey, maxRetries: 1, timeout: 45_000 });
    const result = await openai.responses.parse({
      model,
      store: false,
      max_output_tokens: 1000,
      safety_identifier: identity,
      instructions: SYSTEM_PROMPT,
      input: `以下の整形済み簡易診断結果を分析してください。数値を再計算せず、表記も維持してください。\n${formatDiagnosisPromptInput(input)}`,
      text: {
        format: zodTextFormat(DiagnosisInsightSchema, "diagnosis_insight"),
      },
    });
    const parsedInsight = result.output_parsed;
    if (!parsedInsight) {
      return response.status(502).json({
        error: "GPTの回答を診断結果として読み取れませんでした。",
      });
    }
    const insight = normalizeDiagnosisInsight(parsedInsight);

    return response.status(200).json({
      insight,
      model: result.model,
      responseId: result.id,
    });
  } catch (caught) {
    if (caught instanceof z.ZodError) {
      return response.status(400).json({
        error: "診断データの形式が正しくありません。",
        issues: caught.issues,
      });
    }
    console.error("Diagnosis insight endpoint failed", caught);
    return response.status(500).json({
      error: "GPT分析を完了できませんでした。しばらくしてから再度お試しください。",
    });
  }
}

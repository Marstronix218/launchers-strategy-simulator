import {
  DiagnosisInsightSchema,
  type DiagnosisInsight,
  type DiagnosisInsightRequest,
} from "./diagnosisSchema";

export async function requestDiagnosisInsight(
  input: DiagnosisInsightRequest,
): Promise<{ insight: DiagnosisInsight; model: string }> {
  const response = await fetch("/api/diagnosis-insight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    insight?: unknown;
    model?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? `GPT分析に失敗しました（${response.status}）。`);
  }
  return {
    insight: DiagnosisInsightSchema.parse(payload.insight),
    model: payload.model ?? "OpenAI",
  };
}

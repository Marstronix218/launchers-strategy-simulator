import type { CompanyBaseline, CompanyProfile, Scenario, ScenarioResult } from "../types";
import { AIInsightSchema, type AIInsight, type AIReviewMode } from "../ai/schema";

async function postJson<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }
  return payload as T;
}

export async function runAuthoritativeForecast(
  token: string,
  input: {
    projectId: string;
    profile: CompanyProfile;
    baseline: CompanyBaseline;
    scenario: Scenario;
  },
): Promise<{ runId: string; result: ScenarioResult }> {
  return postJson("/api/forecast", token, input);
}

export async function requestAIReview(
  token: string,
  input: {
    projectId: string;
    scenarioExternalId?: string;
    mode: AIReviewMode;
    context: Record<string, unknown>;
    userNote?: string;
  },
): Promise<{ suggestionId: string; model: string; insight: AIInsight }> {
  const payload = await postJson<{
    suggestionId: string;
    model: string;
    insight: unknown;
  }>("/api/ai", token, input);
  return {
    ...payload,
    insight: AIInsightSchema.parse(payload.insight),
  };
}

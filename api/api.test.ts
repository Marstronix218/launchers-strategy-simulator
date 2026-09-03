import { describe, expect, it } from "vitest";
import { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";
import aiHandler from "./ai";
import diagnosisInsightHandler, { mapDiagnosisInsightError } from "./diagnosis-insight";
import forecastHandler from "./forecast";
import type { VercelRequest, VercelResponse } from "../server/types";

function createResponseRecorder() {
  const state: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const response: VercelResponse = {
    status(code) {
      state.status = code;
      return response;
    },
    json(body) {
      state.body = body;
      return response;
    },
    setHeader(name, value) {
      state.headers[name] = value;
    },
  };
  return { response, state };
}

function validDiagnosisBody() {
  const period = (source: "user" | "derived" | "edited") => ({
    revenue: { value: 45_000, source },
    operatingProfit: { value: 2_800, source },
    netIncome: { value: 1_600, source },
    cash: { value: 9_000, source },
    depreciation: { value: 1_000, source },
  });
  return {
    industry: "製造業",
    capitalRange: "1,000万〜3,000万円",
    revenueRange: "3億〜10億円",
    performanceRating: 4,
    qualitativeAnswers: { q1: "はい", q5: "利益率を改善したい" },
    historicalFinancials: {
      twoYearsAgo: period("derived"),
      previousYear: period("edited"),
      latestYear: period("user"),
    },
    growthRates: { revenue: 0.07, operatingProfit: 0.03, netIncome: 0.02 },
    currentEbitda: 3_800,
    companyValues: { current: 19_300, year5: 23_000, year10: 27_000 },
    projections: {
      latest: { revenue: 45_000, operatingProfit: 2_800, netIncome: 1_600 },
      year5: { revenue: 52_000, operatingProfit: 3_000, netIncome: 1_800 },
      year10: { revenue: 60_000, operatingProfit: 3_400, netIncome: 2_100 },
    },
    simulation: {
      runs: 10_000,
      year5CompanyValue: { p10: 18_000, p50: 23_000, p90: 30_000 },
      year10CompanyValue: { p10: 19_000, p50: 27_000, p90: 40_000 },
      probabilityCompanyValueDeclines: 0.2,
      probabilityOperatingLoss: 0.1,
    },
  };
}

describe("Vercel API boundaries", () => {
  it("rejects non-POST forecast requests", async () => {
    const { response, state } = createResponseRecorder();
    await forecastHandler(
      { method: "GET", headers: {} } satisfies VercelRequest,
      response,
    );
    expect(state.status).toBe(405);
    expect(state.headers.Allow).toBe("POST");
  });

  it("requires a bearer session before AI access", async () => {
    const { response, state } = createResponseRecorder();
    await aiHandler(
      { method: "POST", headers: {}, body: {} } satisfies VercelRequest,
      response,
    );
    expect(state.status).toBe(401);
    expect(state.body).toEqual({ error: "Authentication required." });
  });

  it("rejects non-POST anonymous diagnosis insight requests", async () => {
    const { response, state } = createResponseRecorder();
    await diagnosisInsightHandler(
      { method: "GET", headers: {} } satisfies VercelRequest,
      response,
    );
    expect(state.status).toBe(405);
    expect(state.headers.Allow).toBe("POST");
  });

  it("validates anonymous diagnosis data before calling OpenAI", async () => {
    const { response, state } = createResponseRecorder();
    await diagnosisInsightHandler(
      { method: "POST", headers: {}, body: {} } satisfies VercelRequest,
      response,
    );
    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({
      error: "診断データの形式が正しくありません。",
    });
  });

  it("returns a validated structured insight on the successful OpenAI path", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const { response, state } = createResponseRecorder();
    try {
      await diagnosisInsightHandler(
        { method: "POST", headers: { host: "localhost" }, body: validDiagnosisBody() } satisfies VercelRequest,
        response,
        {
          parseResponse: async () => ({
            output_parsed: {
              feedback: "売上成長と利益率の両立条件を確認してください。",
              risks: ["投資の先行で現預金が減少する可能性があります。"],
              summary: "成長速度と資金余力を合わせて判断する局面です。",
              rating: 4,
              ratingRationale: "成長基調を維持しつつ改善余地もあるためです。",
            },
            model: "test-model",
            id: "resp_test",
          }),
        },
      );
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({
      model: "test-model",
      responseId: "resp_test",
      insight: { rating: 4 },
    });
  });

  it("maps OpenAI timeouts to a gateway timeout without leaking details", () => {
    expect(mapDiagnosisInsightError(new APIConnectionTimeoutError())).toEqual({
      status: 504,
      code: "AI_UPSTREAM_TIMEOUT",
      error: "AI分析が時間内に完了しませんでした。もう一度お試しください。",
    });
  });

  it("maps connection and rate-limit errors to temporary unavailability", () => {
    expect(mapDiagnosisInsightError(new APIConnectionError({ message: "secret", cause: undefined }))).toMatchObject({
      status: 503,
      code: "AI_UPSTREAM_UNAVAILABLE",
    });
    expect(mapDiagnosisInsightError(new APIError(429, { code: "rate_limit_exceeded" }, "secret", new Headers()))).toMatchObject({
      status: 503,
      code: "AI_UPSTREAM_UNAVAILABLE",
    });
  });

  it("maps other OpenAI failures to a bad gateway and internal failures to 500", () => {
    expect(mapDiagnosisInsightError(new APIError(500, {}, "secret", new Headers()))).toMatchObject({
      status: 502,
      code: "AI_UPSTREAM_ERROR",
    });
    expect(mapDiagnosisInsightError(new Error("local failure"))).toMatchObject({
      status: 500,
      code: "AI_INTERNAL_ERROR",
    });
  });
});

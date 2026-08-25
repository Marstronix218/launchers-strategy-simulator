import { describe, expect, it } from "vitest";
import aiHandler from "./ai";
import diagnosisInsightHandler from "./diagnosis-insight";
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
});

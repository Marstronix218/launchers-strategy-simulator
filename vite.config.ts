import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import diagnosisInsightHandler from "./api/diagnosis-insight";
import type { VercelResponse } from "./server/types";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 12_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function localDiagnosisApi(): Plugin {
  return {
    name: "local-diagnosis-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/diagnosis-insight", async (request, response, next) => {
        try {
          const body = request.method === "POST" ? await readJsonBody(request) : undefined;
          let statusCode = 200;
          const apiResponse: VercelResponse = {
            status(code) {
              statusCode = code;
              return apiResponse;
            },
            json(payload) {
              response.statusCode = statusCode;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.end(JSON.stringify(payload));
              return apiResponse;
            },
            setHeader(name, value) {
              response.setHeader(name, value);
            },
          };
          await diagnosisInsightHandler(
            { method: request.method, headers: request.headers, body },
            apiResponse,
          );
        } catch (caught) {
          if (caught instanceof SyntaxError) {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: "JSON形式が正しくありません。" }));
            return;
          }
          if (caught instanceof Error && caught.message === "REQUEST_TOO_LARGE") {
            response.statusCode = 413;
            response.end(JSON.stringify({ error: "診断データが大きすぎます。" }));
            return;
          }
          next(caught);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverEnvironment = loadEnv(mode, process.cwd(), "");
  process.env.OPENAI_API_KEY ||= serverEnvironment.OPENAI_API_KEY;
  process.env.OPENAI_MODEL ||= serverEnvironment.OPENAI_MODEL;

  return {
    plugins: [react(), localDiagnosisApi()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ["recharts"],
            icons: ["lucide-react"],
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
    },
  };
});

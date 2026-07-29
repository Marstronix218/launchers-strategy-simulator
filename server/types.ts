import type { IncomingHttpHeaders } from "node:http";

// Kept framework-neutral so helper modules are not exposed as API routes.

export interface VercelRequest {
  method?: string;
  headers: IncomingHttpHeaders;
  body?: unknown;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  setHeader(name: string, value: string): void;
}

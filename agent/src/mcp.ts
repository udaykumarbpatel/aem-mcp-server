import { randomUUID } from "node:crypto";
import { fetch } from "undici";

const DEFAULT_BASE = "http://localhost:3001";

interface CallOptions {
  idempotencyKey?: string;
}

async function call<T>(tool: string, data: unknown, options: CallOptions = {}): Promise<T> {
  const baseUrl = process.env.MCP_BASE ?? DEFAULT_BASE;
  const response = await fetch(`${baseUrl}/${tool}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP call failed (${response.status}): ${text}`);
  }

  if (response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface CreatePageInput {
  parentPath: string;
  name: string;
  title: string;
  template: string;
  properties?: Record<string, unknown>;
}

export interface UpdatePageInput {
  path: string;
  properties: Record<string, unknown>;
}

export interface DeletePageInput {
  path: string;
  softDelete: boolean;
}

export interface PublishPageInput {
  path: string;
  activate: boolean;
  scheduleAt?: string | null;
}

export async function createPageWithTemplate(input: CreatePageInput, idempotencyKey?: string) {
  return call("createPageWithTemplate", input, { idempotencyKey: idempotencyKey ?? randomUUID() });
}

export async function updatePageProperties(input: UpdatePageInput, idempotencyKey?: string) {
  return call("updatePageProperties", input, { idempotencyKey: idempotencyKey ?? randomUUID() });
}

export async function deletePage(input: DeletePageInput, idempotencyKey?: string) {
  return call("deletePage", input, { idempotencyKey: idempotencyKey ?? randomUUID() });
}

export async function publishPage(input: PublishPageInput, idempotencyKey?: string) {
  return call("publishPage", input, { idempotencyKey: idempotencyKey ?? randomUUID() });
}

export { call as callMcp };

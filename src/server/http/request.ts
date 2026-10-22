import { ApiError } from "./errors";

export function assertSameOrigin(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("ORIGIN_REJECTED", 403, "Open CarbonShift and try this action again.");
  }
}
export async function readBody(request: Request, maximumBytes = 16384): Promise<string> {
  if (Number(request.headers.get("content-length")) > maximumBytes) throw new ApiError("BODY_TOO_LARGE", 413, "This request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("MALFORMED_JSON", 400, "Send a valid JSON request.");
  const bytes: Uint8Array[] = []; let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 8000);
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximumBytes) { void reader.cancel().catch(() => {}); throw new ApiError("BODY_TOO_LARGE", 413, "This request is too large."); }
      bytes.push(chunk.value);
    }
    const combined = new Uint8Array(length); let offset = 0;
    for (const chunk of bytes) { combined.set(chunk, offset); offset += chunk.byteLength; }
    if (timedOut) throw new ApiError("REQUEST_TIMEOUT", 408, "The request took too long. Please try again.", true);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(combined); }
    catch { throw new ApiError("MALFORMED_JSON", 400, "Send a valid JSON request."); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ApiError("INVALID_CONTENT_TYPE", 415, "Send a JSON request.");
  const body = await readBody(request);
  try { return JSON.parse(body) as unknown; }
  catch { throw new ApiError("MALFORMED_JSON", 400, "Send a valid JSON request."); }
}

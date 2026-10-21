import { GridError } from "./errors";
import { GRID_POLICY, type GridRequest } from "./provider";

export type GridFetch = (url: string, options: RequestInit) => Promise<Response>;

async function deadline<T>(work: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new GridError("GRID_TIMEOUT", "The grid data request exceeded its time limit.", true));
      controller.abort();
    }, milliseconds);
  });
  try { return await Promise.race([work(controller.signal), timeout]); }
  finally { clearTimeout(timer); controller.abort(); }
}

function retryAfter(response: Response, nowMs: number): number | null {
  const value = response.headers.get("retry-after");
  if (value === null) return null;
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - nowMs;
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" || response.body === null) {
    void response.body?.cancel().catch(() => {});
    throw new GridError("INVALID_GRID_RESPONSE", "The grid provider did not return a JSON response.");
  }
  const size = response.headers.get("content-length");
  if (size !== null && Number(size) > GRID_POLICY.maximumBodyBytes) {
    void response.body.cancel().catch(() => {});
    throw new GridError("GRID_RESPONSE_TOO_LARGE", "The grid response exceeded the supported size.");
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > GRID_POLICY.maximumBodyBytes) {
        void reader.cancel().catch(() => {});
        throw new GridError("GRID_RESPONSE_TOO_LARGE", "The grid response exceeded the supported size.");
      }
      chunks.push(chunk.value);
    }
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
  catch { throw new GridError("INVALID_GRID_RESPONSE", "The grid provider returned invalid JSON data."); }
}

async function readOnce(request: GridRequest, fetcher: GridFetch, signal: AbortSignal, nowMs: () => number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(request.url, { method: "GET", headers: { Accept: "application/json" }, redirect: "error", cache: "no-store", credentials: "omit", signal });
  } catch { throw new GridError("GRID_UNAVAILABLE", "The national grid service could not be reached.", true); }
  // A non-cooperative transport may resolve after its attempt already timed out.
  if (signal.aborted) {
    void response.body?.cancel().catch(() => {});
    throw new GridError("GRID_TIMEOUT", "The grid response arrived after its time limit.", true);
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    const transient = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new GridError(response.status === 429 ? "GRID_RATE_LIMITED" : "GRID_HTTP_ERROR", "The national grid service could not complete the request.", transient, response.status, retryAfter(response, nowMs()));
  }
  try { return await readJson(response, signal); }
  catch (error) {
    if (error instanceof GridError) throw error;
    throw new GridError("GRID_UNAVAILABLE", "The grid response was interrupted.", true);
  }
}

export async function fetchNationalResponse(request: GridRequest, fetcher: GridFetch, nowMs: () => number): Promise<unknown> {
  return deadline(async (totalSignal) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await deadline((attemptSignal) => readOnce(request, fetcher, AbortSignal.any([totalSignal, attemptSignal]), nowMs), GRID_POLICY.attemptTimeoutMs);
      } catch (error) {
        if (!(error instanceof GridError) || !error.retryable || attempt === 1 || totalSignal.aborted ||
          (error.retryAfterMs !== null && error.retryAfterMs > GRID_POLICY.maximumRetryAfterMs)) throw error;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, error.retryAfterMs ?? GRID_POLICY.retryDelayMs);
          totalSignal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
    }
    throw new GridError("GRID_UNAVAILABLE", "The national grid service is unavailable.", true);
  }, GRID_POLICY.totalTimeoutMs);
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { createGridClient } from "@/server/grid/client";
import { GRID_POLICY } from "@/server/grid/provider";
import { FORECAST_RANGE, GRID_NOW, providerResponse } from "../fixtures/grid-provider";

afterEach(() => { vi.useRealTimers(); });
const clock = () => Date.parse(GRID_NOW);
describe("M03.04 bounded failures and retries (T05)", () => {
  it.each([408, 429, 500, 502, 503, 504])("retries transient HTTP %i once, then succeeds", async (status) => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse({ error: "untrusted-body" }, { status })).mockResolvedValueOnce(providerResponse());
    const client = createGridClient({ fetcher, nowMs: clock });
    const operation = client.getForecast(FORECAST_RANGE);
    await vi.advanceTimersByTimeAsync(250);
    expect((await operation).snapshot.intervals).toHaveLength(8); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 404, 422])("does not retry permanent HTTP %i or expose its body", async (status) => {
    const fetcher = vi.fn(async () => providerResponse({ error: "private-provider-message" }, { status }));
    const error = await createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    expect(error).toMatchObject({ code: "GRID_HTTP_ERROR", httpStatus: status, retryable: false });
    expect(JSON.stringify(error)).not.toContain("private-provider-message"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds transport failure to two attempts, and a later request may recover", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("private socket detail")).mockRejectedValueOnce(new Error("private socket detail")).mockResolvedValueOnce(providerResponse());
    const client = createGridClient({ fetcher, nowMs: clock });
    const failed = client.getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(250);
    const error = await failed;
    expect(error).toMatchObject({ code: "GRID_UNAVAILABLE", retryable: true }); expect(JSON.stringify(error)).not.toContain("private socket detail");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await client.getForecast(FORECAST_RANGE)).snapshot.intervals).toHaveLength(8); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("times out even if the fetch implementation ignores abort", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string, options: RequestInit) => { signals.push(options.signal!); return new Promise<Response>(() => {}); });
    const operation = createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(8000); expect(fetcher).toHaveBeenCalledTimes(1); expect(signals[0]!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(8250);
    expect(await operation).toMatchObject({ code: "GRID_TIMEOUT" }); expect(fetcher).toHaveBeenCalledTimes(2); expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("includes a stalled body in the attempt timeout and cancels its stream", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json" } }));
    const operation = createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(GRID_POLICY.totalTimeoutMs);
    expect(await operation).toMatchObject({ code: "GRID_TIMEOUT" }); expect(fetcher).toHaveBeenCalledTimes(2); expect(cancel).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a late response whose headers arrive after abort", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve) => {
      options.signal!.addEventListener("abort", () => resolve(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json" } })), { once: true });
    }));
    const operation = createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(GRID_POLICY.totalTimeoutMs);
    expect(await operation).toMatchObject({ code: "GRID_TIMEOUT" });
    expect(cancel).toHaveBeenCalledTimes(2);
  });
  it("honors short Retry-After without waiting beyond the total budget", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse({}, { status: 429, headers: { "retry-after": "2" } })).mockResolvedValueOnce(providerResponse());
    const operation = createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE);
    await vi.advanceTimersByTimeAsync(1999); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await operation; expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("returns a long Retry-After failure instead of retrying early or hanging", async () => {
    const fetcher = vi.fn(async () => providerResponse({}, { status: 429, headers: { "retry-after": "3600" } }));
    await expect(createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "GRID_RATE_LIMITED", retryAfterMs: 3600000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["json", "html", "schema", "utf8"])("does not retry malformed %s responses", async (kind) => {
    const body = kind === "utf8" ? new Uint8Array([0xff, 0xff]) : kind === "html" ? "<html>private response</html>" : "{broken JSON";
    const fetcher = vi.fn(async () => kind === "schema" ? providerResponse({ data: "private" }) : new Response(body, { headers: { "content-type": kind === "html" ? "text/html" : "application/json" } }));
    await expect(createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "INVALID_GRID_RESPONSE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])("bounds oversized responses, content-length present: %s", async (header) => {
    const body = "x".repeat(GRID_POLICY.maximumBodyBytes + 1);
    const fetcher = vi.fn(async () => new Response(body, { headers: { "content-type": "application/json", ...(header ? { "content-length": String(body.length) } : {}) } }));
    await expect(createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "GRID_RESPONSE_TOO_LARGE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not substitute an expired cached forecast during an outage", async () => {
    vi.useFakeTimers();
    let time = clock();
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse()).mockRejectedValue(new Error("offline"));
    const client = createGridClient({ fetcher, nowMs: () => time });
    const prior = await client.getForecast(FORECAST_RANGE); time += 31 * 60000;
    const operation = client.getForecast(FORECAST_RANGE).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(250);
    expect(await operation).toMatchObject({ code: "GRID_UNAVAILABLE" }); expect(fetcher).toHaveBeenCalledTimes(3);
    expect(prior.snapshot.retrievedAtUtc).toBe(GRID_NOW);
  });
  it("coalesces a failing flight without allocating extra retries", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const client = createGridClient({ fetcher, nowMs: clock });
    const operations = Array.from({ length: 8 }, () => client.getForecast(FORECAST_RANGE).catch((error: unknown) => error));
    await vi.advanceTimersByTimeAsync(250);
    expect((await Promise.all(operations)).every((error) => typeof error === "object" && error !== null && "code" in error && error.code === "GRID_UNAVAILABLE")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

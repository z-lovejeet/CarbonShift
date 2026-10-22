import { afterEach, expect, it, vi } from "vitest";
import { readBody, readJson } from "@/server/http/request";
afterEach(() => vi.useRealTimers());
it("cancels a stalled body and returns a timeout instead of accepting partial JSON", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{}")); }, cancel });
  const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  const reading = readBody(request);
  const assertion = expect(reading).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", status: 408 });
  await vi.advanceTimersByTimeAsync(8000);
  await assertion;
  expect(cancel).toHaveBeenCalledOnce();
});
it("rejects invalid UTF-8 and exact byte overflow", async () => {
  const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0xff]) });
  await expect(readJson(request)).rejects.toMatchObject({ code: "MALFORMED_JSON" });
  await expect(readBody(new Request("http://localhost", { method: "POST", body: "éé" }),3)).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
});

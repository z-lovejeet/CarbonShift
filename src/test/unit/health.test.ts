import { expect, it } from "vitest";
import { GET } from "../../app/api/v1/health/route";

it("returns uncached liveness with a generated request ID and no configuration details", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["data", "requestId"]);
  expect(body.data).toEqual({ status: "ok" });
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  const another = await GET().json();
  expect(another.requestId).not.toBe(body.requestId);
});

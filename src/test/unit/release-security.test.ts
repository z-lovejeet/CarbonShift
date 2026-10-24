import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/schema";
import { authorizeMaintenance, runMaintenance } from "@/server/maintenance";
import { securityHeaders } from "@/config/security-headers";

describe("release maintenance boundary", () => {
  const secret = "a".repeat(32);
  const request = (value?: string) => new Request("https://example.invalid/api/internal/maintenance", { headers: value ? { authorization: value } : {} });
  it("requires a configured exact bearer credential, including byte-length differences", () => {
    expect(() => authorizeMaintenance(request(), null)).toThrow("not configured");
    for (const value of [undefined, `Bearer ${"b".repeat(32)}`, `Bearer ${"é".repeat(32)}`, secret]) {
      expect(() => authorizeMaintenance(request(value), secret)).toThrow("credential is required");
    }
    expect(() => authorizeMaintenance(request(`Bearer ${secret}`), secret)).not.toThrow();
  });
  it("forwards dry-run/apply explicitly and hides database errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { busy: false, applied: false }, error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    expect(await runMaintenance(client, false)).toMatchObject({ busy: false });
    expect(rpc).toHaveBeenLastCalledWith("cs_retention", { p_apply: false });
    await runMaintenance(client, true);
    expect(rpc).toHaveBeenLastCalledWith("cs_retention", { p_apply: true });
    rpc.mockResolvedValue({ data: null, error: { message: "private-database-canary" } });
    await expect(runMaintenance(client, true)).rejects.toThrow("Maintenance could not be completed");
  });
});

it("limits production connections and framing while permitting the local verifier worker", () => {
  const headers = Object.fromEntries(securityHeaders(false).map(({ key, value }) => [key, value]));
  const csp = headers["Content-Security-Policy"]!;
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("worker-src 'self' blob:");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
  expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(securityHeaders(true).some((h) => h.key === "Strict-Transport-Security")).toBe(false);
});

it("permits only the configured public Auth origin and supported OAuth redirect destinations", () => {
  const csp = securityHeaders(false, "https://auth.example.invalid").find((h) => h.key === "Content-Security-Policy")!.value;
  expect(csp).toContain("form-action 'self' https://auth.example.invalid https://accounts.google.com https://github.com;");
  expect(csp).not.toContain("*");
  for (const invalid of ["https://name:private-canary@auth.example.invalid", "https://auth.example.invalid/?private-canary=1", "malformed-private-canary"]) {
    const invalidCsp = securityHeaders(false, invalid).find((h) => h.key === "Content-Security-Policy")!.value;
    expect(invalidCsp).toContain("form-action 'self';");
    expect(invalidCsp).not.toContain("private-canary");
  }
});

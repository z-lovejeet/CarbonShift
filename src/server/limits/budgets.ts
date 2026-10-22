import "server-only";
import { createHash, createHmac } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import type { AiPolicy } from "@/config/ai-policy";

export type Budget = { key: string; metric: "requests" | "input_tokens" | "output_tokens" | "total_tokens"; amount: number; limit: number; expiresAt: string };
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export const subject = (secret: string, scope: string, value: string) => createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function windowBounds(nowUtc: string, window: "rolling_60s" | "rolling_24h" | "calendar_day", zone: string | null) {
  const instant = Temporal.Instant.from(nowUtc);
  if (window !== "calendar_day") return { suffix: window, expiresAt: instant.add({ seconds: window === "rolling_60s" ? 60 : 86400 }).toString() };
  if (!zone) throw new Error("Calendar quota requires a timezone");
  const local = instant.toZonedDateTimeISO(zone);
  return { suffix: local.toPlainDate().toString(), expiresAt: local.startOfDay().add({ days: 1 }).toInstant().toString() };
}
export function requestBudget(key: string, limit: number, nowUtc: string, seconds: number): Budget {
  return { key: digest(key), metric: "requests", amount: 1, limit, expiresAt: Temporal.Instant.from(nowUtc).add({ seconds }).toString() };
}
export function dailyBudget(key: string, limit: number, nowUtc: string): Budget {
  const bounds = windowBounds(nowUtc, "calendar_day", "UTC");
  return { key: digest(`${key}:${bounds.suffix}`), metric: "requests", amount: 1, limit, expiresAt: bounds.expiresAt };
}
export function memberBudgets(actor: string, nowUtc: string): Budget[] {
  return [requestBudget(`ai-member-minute:${actor}`, 5, nowUtc, 60), dailyBudget(`ai-member-day:${actor}`, 20, nowUtc)];
}
/** UTF-8 bytes overestimate ordinary text tokenization; fixed overhead covers JSON/schema/messages. */
export function tokenReservation(input: string, schema: string, outputCap: number) {
  const inputTokens = Buffer.byteLength(input, "utf8") + Buffer.byteLength(schema, "utf8") + 1024;
  return { input_tokens: inputTokens, output_tokens: outputCap, total_tokens: inputTokens + outputCap };
}
export function providerBudgets(policy: AiPolicy, model: AiPolicy["models"][number], tokens: ReturnType<typeof tokenReservation>, nowUtc: string): Budget[] {
  return [dailyBudget("ai-application-attempts", 200, nowUtc), ...model.bucketIds.map((id) => {
    const b = policy.buckets.find((item) => item.id === id)!;
    if (!b || b.appLimit === null || b.providerLimit === null || !b.verifiedAtUtc) throw new Error("Unverified provider budget");
    const bounds = windowBounds(nowUtc, b.window, b.resetTimezone);
    return { key: digest(`ai:${b.provider}:${b.scopeAlias}:${b.id}:${b.metric}:${b.window}:${bounds.suffix}`), metric: b.metric,
      amount: b.metric === "requests" ? 1 : tokens[b.metric], limit: Math.min(b.appLimit, b.providerLimit), expiresAt: bounds.expiresAt };
  })];
}

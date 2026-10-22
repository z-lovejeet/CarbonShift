import { z } from "zod";

export const providerSchema = z.enum(["google", "github"]);
export function allowedDestination(value: unknown): string {
  if (value === null || value === undefined) return "/app";
  if (typeof value !== "string" || value.trim() !== value) return "/login";
  return /^\/(?:login|app(?:\/settings|\/plan\/new|\/plans\/[0-9a-f-]{36})?)$/.test(value) ? value : "/login";
}

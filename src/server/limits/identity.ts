import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { subject } from "./budgets";
const COOKIE = "cs-request-browser";
export function browserIdentity(cookie: string | null, secret: string) {
  const raw = cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  const [candidate, signature] = raw?.split(".") ?? [];
  const valid = candidate && /^[0-9a-f-]{36}$/.test(candidate) && signature && /^[0-9a-f]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(subject(secret, "browser-cookie", candidate), "hex"));
  const id = valid ? candidate : randomUUID();
  return { id, value: `${COOKIE}=${id}.${subject(secret, "browser-cookie", id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` };
}
export function normalizedIp(raw: string | null): string | null {
  if (!raw || raw.length > 80 || raw.includes(",") || !isIP(raw)) return null;
  if (isIP(raw) === 4) return raw;
  const value = new URL(`http://[${raw}]/`).hostname.slice(1, -1).toLowerCase();
  const mapped = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) { const n = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16); return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join("."); }
  return value;
}

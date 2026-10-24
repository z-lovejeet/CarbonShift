import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { DomainError, parseDomain } from "./errors";
import { METHOD } from "./method";
import { utcInstantSchema } from "./schemas/primitives";

export function epochSeconds(utc: string): number {
  return Date.parse(parseDomain(utcInstantSchema, utc)) / 1000;
}

export function utcFromSeconds(seconds: number): string {
  if (!Number.isSafeInteger(seconds)) throw new DomainError("INVALID_INPUT", "Expected whole safe Unix seconds.");
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) throw new DomainError("INVALID_TIME_WINDOW", "Time is outside the supported calendar.");
  return parseDomain(utcInstantSchema, date.toISOString().replace(".000Z", "Z"));
}

export function addSeconds(utc: string, seconds: number): string {
  return utcFromSeconds(epochSeconds(utc) + seconds);
}

export function ceilHalfHour(utc: string): string {
  return utcFromSeconds(Math.ceil(epochSeconds(utc) / METHOD.intervalSeconds) * METHOD.intervalSeconds);
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const [as, ae, bs, be] = [aStart, aEnd, bStart, bEnd].map(epochSeconds) as [number, number, number, number];
  if (as >= ae || bs >= be) throw new DomainError("INVALID_TIME_WINDOW", "Intervals must have positive length.");
  return as < be && ae > bs;
}

const localDateTimeSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  offsetChoice: z.enum(["earlier", "later"]).nullable().default(null),
});

/** Explicit London entry; neither host locale nor Temporal's shift-through-gap default is used. */
export function resolveLondonTime(input: unknown): string {
  const value = parseDomain(localDateTimeSchema, input, "INVALID_LOCAL_TIME");
  let plain: Temporal.PlainDateTime;
  try { plain = Temporal.PlainDateTime.from(`${value.date}T${value.time}`, { overflow: "reject" }); }
  catch { throw new DomainError("INVALID_LOCAL_TIME", "Enter a valid London date and time."); }
  const earlier = plain.toZonedDateTime(METHOD.timezone, { disambiguation: "earlier" });
  const later = plain.toZonedDateTime(METHOD.timezone, { disambiguation: "later" });
  if (!earlier.toPlainDateTime().equals(plain) || !later.toPlainDateTime().equals(plain)) {
    throw new DomainError("NONEXISTENT_LOCAL_TIME", "This London time does not exist because the clocks move forward.");
  }
  if (!earlier.equals(later) && value.offsetChoice === null) {
    throw new DomainError("AMBIGUOUS_LOCAL_TIME", "Choose the earlier or later occurrence of this London time.");
  }
  return (value.offsetChoice === "later" ? later : earlier).toInstant().toString({ smallestUnit: "second" });
}

export function londonTime(utc: string): { date: string; time: string; offset: string; timezone: typeof METHOD.timezone } {
  parseDomain(utcInstantSchema, utc);
  const local = Temporal.Instant.from(utc).toZonedDateTimeISO(METHOD.timezone);
  return { date: local.toPlainDate().toString(), time: local.toPlainTime().toString({ smallestUnit: "minute" }), offset: local.offset, timezone: METHOD.timezone };
}

export function precommitCutoff(baselineStartUtc: string, selectedStartUtc: string): string {
  return utcFromSeconds(Math.min(epochSeconds(baselineStartUtc), epochSeconds(selectedStartUtc)));
}

export function comparisonExpiry(createdAtUtc: string, baselineStartUtc: string, selectedStartUtc: string): string {
  const expiry = Math.min(epochSeconds(createdAtUtc) + METHOD.comparisonLifetimeSeconds,
    epochSeconds(precommitCutoff(baselineStartUtc, selectedStartUtc)) - METHOD.operationalBufferSeconds);
  if (expiry <= epochSeconds(createdAtUtc)) throw new DomainError("COMPARISON_EXPIRED", "Choose a later window to allow time to review this comparison.");
  return utcFromSeconds(expiry);
}

export function assertAcceptanceTime(input: { createdAtUtc: string; expiresAtUtc: string; baselineStartUtc: string; selectedStartUtc: string }, nowUtc: string): void {
  const now = epochSeconds(nowUtc);
  if (now < epochSeconds(input.createdAtUtc) || now >= epochSeconds(input.expiresAtUtc) ||
    now > epochSeconds(precommitCutoff(input.baselineStartUtc, input.selectedStartUtc)) - METHOD.operationalBufferSeconds) {
    throw new DomainError("COMPARISON_EXPIRED", "Refresh and review the comparison before accepting it.");
  }
}

/** Calendar boundaries rather than a fixed 24-hour addition, preserving London DST. */
export function londonDayBounds(date: string): { startUtc: string; endUtc: string } {
  let day: Temporal.PlainDate;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date");
    day = Temporal.PlainDate.from(date, { overflow: "reject" });
  } catch { throw new DomainError("INVALID_LOCAL_TIME", "Choose a valid London calendar day."); }
  return { startUtc: resolveLondonTime({ date: day.toString(), time: "00:00" }),
    endUtc: resolveLondonTime({ date: day.add({ days: 1 }).toString(), time: "00:00" }) };
}

export function halfHourCoverage(startUtc: string, endUtc: string): { fromUtc: string; toUtc: string } {
  const start = epochSeconds(startUtc), end = epochSeconds(endUtc);
  if (start >= end) throw new DomainError("INVALID_TIME_WINDOW", "End time must follow the start.");
  return { fromUtc: utcFromSeconds(Math.floor(start / 1800) * 1800), toUtc: utcFromSeconds(Math.ceil(end / 1800) * 1800) };
}

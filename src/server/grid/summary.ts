import "server-only";
import { unstable_cache } from "next/cache";
import { gridClient } from "./index";
import { epochSeconds, utcFromSeconds } from "@/domain/time";

const cachedForecast = unstable_cache(async () => {
  const from = Math.floor(Date.now() / 1_800_000) * 1800;
  try {
    const record = await gridClient.getForecast({ fromUtc: utcFromSeconds(from), toUtc: utcFromSeconds(from + 86400) });
    return { available: true as const, record };
  } catch {
    return { available: false as const };
  }
}, ["carbonshift-household-grid-outlook-v3"], { revalidate: 300 });

/** Re-select the current interval after the cached read, including half-hour boundaries. */
export async function householdGridSummary() {
  const cached = await cachedForecast();
  if (!cached.available) return cached;
  const now = Math.floor(Date.now() / 1000);
  const first = Math.floor(now / 1800) * 1800;
  const intervals = cached.record.snapshot.intervals.filter((interval) =>
    epochSeconds(interval.fromUtc) >= first && epochSeconds(interval.toUtc) <= first + 86400);
  const current = intervals.find((interval) => epochSeconds(interval.fromUtc) <= now && epochSeconds(interval.toUtc) > now);
  if (!current) return { available: false as const };
  const lowest = intervals.filter((interval) => interval.forecastGPerKwh !== null)
    .sort((a, b) => a.forecastGPerKwh! - b.forecastGPerKwh! || a.fromUtc.localeCompare(b.fromUtc))[0];
  return { available: true as const, current, intervals, lowest, retrievedAtUtc: cached.record.snapshot.retrievedAtUtc, sourceUrl: cached.record.snapshot.sourceUrl, attribution: cached.record.attribution };
}

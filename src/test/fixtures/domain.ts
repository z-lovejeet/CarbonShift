/** Authored synthetic values for isolated tests, never a live response. */
export const NOW = "2026-10-21T06:00:00Z";
export const SNAPSHOT_ID = "68aacb8b-fd83-4be4-afb8-d83ade365c36";
export const SNAPSHOT_HASH = `0x${"a".repeat(64)}`;
export const REPORT_ID = "ca95beba-9493-4f07-8d29-58bc31e4207a";
export function constraints() {
  return {
    geography: "GB_NATIONAL" as const, timezone: "Europe/London" as const,
    earliestStartUtc: "2026-10-21T07:00:00Z", deadlineUtc: "2026-10-21T11:00:00Z",
    durationMinutes: 60 as const, energyWh: 1000, energyBasis: "user_estimate" as const,
    blockedIntervals: [] as { startUtc: string; endUtc: string }[],
    baselineStartUtc: "2026-10-21T07:00:00Z", baselineOrigin: "user_selected" as const, confirmedAtUtc: NOW,
  };
}
export function snapshot(factors: (number | null)[] = [300, 340, 260, 220, 100, 140, 280, 300]) {
  const start = Date.parse("2026-10-21T07:00:00Z");
  const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
  return {
    geography: "GB_NATIONAL" as const, sourceUrl: "https://api.carbonintensity.org.uk/intensity/2026-10-21T07:00Z/fw48h",
    retrievedAtUtc: NOW, providerIssuedAtUtc: null, license: "CC BY 4.0",
    intervals: factors.map((factor, i) => ({ fromUtc: iso(start + i * 1800000), toUtc: iso(start + (i + 1) * 1800000), forecastGPerKwh: factor, actualGPerKwh: factor })),
  };
}
export function candidate() {
  return { startUtc: "2026-10-21T07:00:00Z", endUtc: "2026-10-21T08:00:00Z", energyWhBins: [500, 500], factorGPerKwh: [300, 340], estimatedMg: 320000, rank: 7 };
}
export function comparison() {
  return {
    constraints: constraints(), forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: SNAPSHOT_HASH,
    baseline: candidate(), selected: { ...candidate(), startUtc: "2026-10-21T09:00:00Z", endUtc: "2026-10-21T10:00:00Z", factorGPerKwh: [100, 140], estimatedMg: 120000, rank: 1 },
    alternatives: [], differenceMg: 200000, differencePercent: 62.5,
    methodVersion: "carbonshift-gb-uniform-v1" as const, createdAtUtc: NOW, expiresAtUtc: "2026-10-21T06:05:00Z",
  };
}

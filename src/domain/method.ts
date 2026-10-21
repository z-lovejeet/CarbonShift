/** Versioned accounting assumptions, never a measured appliance profile. */
export const METHOD = Object.freeze({
  version: "carbonshift-gb-uniform-v1",
  geography: "GB_NATIONAL",
  timezone: "Europe/London",
  intervalSeconds: 1800,
  intervalMinutes: 30,
  minimumEnergyWh: 50,
  maximumEnergyWh: 5000,
  maximumProfileBins: 6,
  durationsMinutes: Object.freeze([30, 60, 90, 120, 150, 180] as const),
  maximumBlocks: 4,
  horizonSeconds: 48 * 3600,
  operationalBufferSeconds: 10 * 60,
  comparisonLifetimeSeconds: 5 * 60,
  maximumForecastAgeSeconds: 30 * 60,
  resultStartExtensionSeconds: 24 * 3600,
  maximumAlternatives: 3,
} as const);

/** Freeze freshly constructed values; callers' input objects are never frozen. */
export function freezeDomain<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDomain(child);
    Object.freeze(value);
  }
  return value;
}

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DomainError } from "../src/domain/errors";
import { createComparison } from "../src/domain/scheduling";
import { addSeconds, ceilHalfHour, epochSeconds, utcFromSeconds } from "../src/domain/time";
import { createGridClient } from "../src/server/grid/client";
import { GridError } from "../src/server/grid/errors";

const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || arguments_.some((argument) => argument !== "--capture")) {
  console.error("Usage: pnpm check:grid [--capture]"); process.exitCode = 1;
} else {
  try {
    const now = () => utcFromSeconds(Math.floor(Date.now() / 1000));
    const startedAtUtc = now();
    const fromUtc = ceilHalfHour(addSeconds(startedAtUtc, 30 * 60));
    const forecastRequest = { fromUtc, toUtc: addSeconds(fromUtc, 6 * 3600) };
    const client = createGridClient(); // Real server clock and fetch; no fixture or CLI clock override.
    const forecast = await client.getForecast(forecastRequest);
    const comparisonClockUtc = now();
    const comparison = createComparison({
      constraints: {
        geography: "GB_NATIONAL", timezone: "Europe/London", earliestStartUtc: forecastRequest.fromUtc, deadlineUtc: forecastRequest.toUtc,
        durationMinutes: 60, energyWh: 1000, energyBasis: "illustrative_default", blockedIntervals: [],
        baselineStartUtc: forecastRequest.fromUtc, baselineOrigin: "earliest_feasible_confirmed", confirmedAtUtc: comparisonClockUtc,
      },
      snapshot: forecast.snapshot, forecastSnapshotId: forecast.id, forecastSnapshotHash: forecast.hash,
    }, comparisonClockUtc);
    const actualToUtc = utcFromSeconds(Math.floor(epochSeconds(comparisonClockUtc) / 1800) * 1800 - 2 * 3600);
    const actualRequest = { fromUtc: addSeconds(actualToUtc, -2 * 3600), toUtc: actualToUtc };
    const actual = await client.getActual(actualRequest);
    const evidence = {
      fixtureVersion: "neso-national-recorded-v1", dataOrigin: "recorded_public_provider_normalized_snapshot", replayOnly: true,
      label: "Historical national provider snapshots for isolated replay. Cycle duration/energy are authored assumptions, not appliance measurements or achieved climate impact. Never use this file as a live fallback.",
      startedAtUtc, completedAtUtc: now(), forecastRequest, actualRequest, forecast, actual, comparison,
    };
    if (arguments_.includes("--capture")) {
      const directory = resolve("src/fixtures/grid"); await mkdir(directory, { recursive: true });
      // Freeze a new version rather than silently replacing an earlier captured fixture.
      await writeFile(resolve(directory, "neso-national-recorded-v1.json"), JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
    }
    console.log(JSON.stringify({
      status: "passed", startedAtUtc, completedAtUtc: evidence.completedAtUtc,
      forecast: { sourceUrl: forecast.snapshot.sourceUrl, retrievedAtUtc: forecast.snapshot.retrievedAtUtc, providerIssuedAtUtc: forecast.snapshot.providerIssuedAtUtc, intervals: forecast.snapshot.intervals.length, requiredFromUtc: forecastRequest.fromUtc, requiredToUtc: forecastRequest.toUtc, completeRequiredForecast: true, hash: forecast.hash },
      actual: actual === null ? { status: "empty_series" } : { sourceUrl: actual.snapshot.sourceUrl, intervals: actual.snapshot.intervals.length, availableActualFactors: actual.snapshot.intervals.filter((interval) => interval.actualGPerKwh !== null).length },
      assumedCycleComparison: { energyWh: 1000, durationMinutes: 60, baselineStartUtc: comparison.baseline.startUtc, selectedStartUtc: comparison.selected.startUtc, baselineMg: comparison.baseline.estimatedMg, selectedMg: comparison.selected.estimatedMg, differenceMg: comparison.differenceMg, evidenceBasis: "Live forecast factors; illustrative assumed energy; no appliance operation or measured avoided emissions." },
      captured: arguments_.includes("--capture"),
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", code: error instanceof GridError || error instanceof DomainError ? error.code : "GRID_CHECK_FAILED", message: error instanceof GridError || error instanceof DomainError ? error.message : "Grid check or evidence capture failed; no success is recorded." }));
    process.exitCode = 1;
  }
}

import { NOW, snapshot } from "./domain";

/** Authored provider-shaped response; deliberately never imported by server code. */
export const GRID_NOW = NOW;
export const FORECAST_RANGE = { fromUtc: "2026-10-21T07:00:00Z", toUtc: "2026-10-21T11:00:00Z" };
export function providerPayload(factors: (number | null)[] = [300, 340, 260, 220, 100, 140, 280, 300]) {
  return { data: snapshot(factors).intervals.map((interval) => ({
    from: interval.fromUtc.replace(":00Z", "Z"), to: interval.toUtc.replace(":00Z", "Z"),
    intensity: { forecast: interval.forecastGPerKwh, actual: interval.actualGPerKwh, index: "authored" },
  })) };
}
export function providerResponse(input: unknown = providerPayload(), init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(input), { headers: { "content-type": "application/json" }, ...init });
}

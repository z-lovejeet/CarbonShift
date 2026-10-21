import { DomainError } from "@/domain/errors";
import { assertForecastFreshness, requireForecastCoverage } from "@/domain/grid";
import { epochSeconds, utcFromSeconds } from "@/domain/time";
import { buildGridRequest, GRID_POLICY, parseGridRange, parseNationalResponse, type GridRange, type GridRequest } from "./provider";
import { createGridSnapshotRecord, type GridSnapshotRecord } from "./snapshot";
import { fetchNationalResponse, type GridFetch } from "./transport";

export type GridClientDependencies = { fetcher?: GridFetch; nowMs?: () => number };

/** Internal seam for isolated tests. Product callers use the server-only entry point. */
export function createGridClient(dependencies: GridClientDependencies = {}) {
  const fetcher = dependencies.fetcher ?? ((url, options) => fetch(url, options));
  const nowMs = dependencies.nowMs ?? (() => Date.now());
  const nowUtc = () => utcFromSeconds(Math.floor(nowMs() / 1000));
  const cache = new Map<string, GridSnapshotRecord>();
  const inFlight = new Map<string, Promise<GridSnapshotRecord | null>>();
  async function load(request: GridRequest): Promise<GridSnapshotRecord | null> {
    const response = await fetchNationalResponse(request, fetcher, nowMs);
    const snapshot = parseNationalResponse(response, { kind: request.kind, fromUtc: request.fromUtc, toUtc: request.toUtc }, nowUtc());
    if (request.kind === "forecast") {
      if (snapshot === null) throw new DomainError("INCOMPLETE_GRID_COVERAGE", "No forecast intervals are available for the requested window.");
      assertForecastFreshness(snapshot, nowUtc());
      requireForecastCoverage(snapshot, request.fromUtc, request.toUtc);
    }
    return snapshot === null ? null : createGridSnapshotRecord(snapshot);
  }
  function read(request: GridRequest): Promise<GridSnapshotRecord | null> {
    const cached = cache.get(request.key);
    if (cached) {
      const ageMs = nowMs() - epochSeconds(cached.snapshot.retrievedAtUtc) * 1000;
      if (ageMs < 0) return Promise.reject(new DomainError("FUTURE_GRID_SNAPSHOT", "The server clock precedes this snapshot's retrieval time."));
      if (ageMs < GRID_POLICY.cacheLifetimeMs) {
        cache.delete(request.key); cache.set(request.key, cached);
        return Promise.resolve(cached);
      }
      cache.delete(request.key);
    }
    const pending = inFlight.get(request.key);
    if (pending) return pending;
    const operation = load(request).then((record) => {
      if (record !== null) {
        if (cache.size >= GRID_POLICY.maximumCacheEntries) cache.delete(cache.keys().next().value!);
        cache.set(request.key, record);
      }
      return record;
    }).finally(() => { inFlight.delete(request.key); });
    inFlight.set(request.key, operation);
    return operation;
  }
  return {
    async getForecast(range: GridRange): Promise<GridSnapshotRecord> {
      const record = await read(buildGridRequest({ ...parseGridRange(range), kind: "forecast" }));
      if (record === null) throw new DomainError("INCOMPLETE_GRID_COVERAGE", "No forecast intervals are available.");
      return record;
    },
    async getActual(range: GridRange): Promise<GridSnapshotRecord | null> {
      return read(buildGridRequest({ ...parseGridRange(range), kind: "actual" }));
    },
  };
}

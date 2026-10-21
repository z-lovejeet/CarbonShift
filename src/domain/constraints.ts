import { DomainError, parseDomain } from "./errors";
import { freezeDomain, METHOD } from "./method";
import { confirmedConstraintsSchema, type ConfirmedConstraintsV1 } from "./schemas";
import { epochSeconds, overlaps, utcFromSeconds } from "./time";

export function normalizeConstraints(input: unknown): ConfirmedConstraintsV1 {
  const value = parseDomain(confirmedConstraintsSchema, input);
  value.blockedIntervals.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return freezeDomain(value);
}

/** Clock-sensitive feasibility is separate from structural validation for historical replay. */
export function feasibleStarts(input: unknown, nowUtc: string): readonly string[] {
  const constraints = normalizeConstraints(input);
  const now = epochSeconds(nowUtc);
  const deadline = epochSeconds(constraints.deadlineUtc);
  if (epochSeconds(constraints.confirmedAtUtc) > now) throw new DomainError("INVALID_TIME_WINDOW", "Confirmation cannot be in the future.");
  if (deadline > now + METHOD.horizonSeconds) throw new DomainError("OUTSIDE_PLANNING_HORIZON", "Deadline exceeds the 48-hour elapsed planning horizon.");
  const first = Math.ceil(Math.max(epochSeconds(constraints.earliestStartUtc), now + METHOD.operationalBufferSeconds) / METHOD.intervalSeconds) * METHOD.intervalSeconds;
  const starts: string[] = [];
  for (let start = first; start + constraints.durationMinutes * 60 <= deadline; start += METHOD.intervalSeconds) {
    const startUtc = utcFromSeconds(start), endUtc = utcFromSeconds(start + constraints.durationMinutes * 60);
    if (!constraints.blockedIntervals.some((block) => overlaps(startUtc, endUtc, block.startUtc, block.endUtc))) starts.push(startUtc);
  }
  if (starts.length === 0) throw new DomainError("NO_FEASIBLE_CANDIDATE", "No complete cycle fits the confirmed window and blocked periods.");
  return Object.freeze(starts);
}

/** Coverage starts before block filtering; a missing blocked span still invalidates planning. */
export function planningCoverageStart(constraints: ConfirmedConstraintsV1, nowUtc: string): string {
  return utcFromSeconds(Math.ceil(Math.max(epochSeconds(constraints.earliestStartUtc), epochSeconds(nowUtc) + METHOD.operationalBufferSeconds) / METHOD.intervalSeconds) * METHOD.intervalSeconds);
}

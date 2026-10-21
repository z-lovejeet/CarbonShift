import { createHash, randomUUID } from "node:crypto";
import { normalizeGridSnapshot } from "@/domain/grid";
import { freezeDomain } from "@/domain/method";
import type { GridSnapshotV1 } from "@/domain/schemas";
import { GRID_POLICY } from "./provider";

export type GridSnapshotRecord = {
  id: string; hash: string; snapshot: GridSnapshotV1; attribution: string;
};

/** Storage digest over the schema's fixed field projection, not a public receipt proof. */
export function hashGridSnapshot(input: unknown): string {
  const snapshot = normalizeGridSnapshot(input);
  return `0x${createHash("sha256").update("CarbonShift:grid-snapshot:v1\n").update(JSON.stringify(snapshot), "utf8").digest("hex")}`;
}

export function createGridSnapshotRecord(input: unknown): GridSnapshotRecord {
  const snapshot = normalizeGridSnapshot(input);
  return freezeDomain({ id: randomUUID(), hash: hashGridSnapshot(snapshot), snapshot, attribution: GRID_POLICY.attribution });
}

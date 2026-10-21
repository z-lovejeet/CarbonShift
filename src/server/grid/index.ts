import "server-only";
import { createGridClient } from "./client";

/** Shared per server process. The live clock/transport cannot be supplied by request JSON. */
export const gridClient = createGridClient();
export type { GridRange } from "./provider";
export type { GridSnapshotRecord } from "./snapshot";
export { GridError } from "./errors";

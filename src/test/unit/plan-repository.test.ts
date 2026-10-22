import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { createPlanRepository } from "@/server/plans/repository";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { createComparison } from "@/domain/scheduling";
import { NOW, constraints, snapshot } from "../fixtures/domain";
const owner = "9d343c67-c744-4327-9a32-52991bc0a988", id = "4c343c67-c744-4327-9a32-52991bc0a988";
const record = createGridSnapshotRecord(snapshot());
const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
const row = { id, owner_id: owner, comparison_id: id, mode: "live", status: "accepted", version: 1, accepted_at: NOW, accepted_payload: comparison };
const transport = vi.fn<typeof fetch>();
const client = createClient<Database>("https://isolated.supabase.test", "sb_publishable_fixture", { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
const repository = createPlanRepository(client, client, owner);
beforeEach(() => {
  transport.mockReset().mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes("/rpc/cs_read_private_plan") ? { plan: row, forecastSnapshot: record.snapshot, forecastHash: record.hash, reports: [], revisions: [] } : url.includes("/grid_snapshots?") ? [{ snapshot: record.snapshot, digest: record.hash }] : [];
    return Response.json(body);
  });
});
it("hydrates only the validated allowlisted plan and immutable snapshot", async () => {
  const data = await repository.detail(id);
  expect(data.comparison).toEqual(comparison);
  expect(data.forecastSnapshot).toEqual(record.snapshot);
  expect(data).not.toHaveProperty("owner_id");
  expect(String(transport.mock.calls[0]![0])).toContain("/rpc/cs_read_private_plan");
  expect(JSON.parse(String(transport.mock.calls[0]![1]?.body))).toEqual({ p_plan: id });
});
it("denies a cross-owner row even if a privileged or faulty reader returned it", async () => {
  transport.mockResolvedValue(Response.json({ plan: { ...row, owner_id: id }, forecastSnapshot: record.snapshot, forecastHash: record.hash, reports: [], revisions: [] }));
  await expect(repository.detail(id)).rejects.toMatchObject({ status: 404 });
});
it("does not elevate an acceptance after an empty user-scoped owner lookup", async () => {
  await expect(repository.accept(id, 1, "key-12345", "a".repeat(64))).rejects.toMatchObject({ status: 404 });
  expect(transport).toHaveBeenCalledOnce();
  expect(String(transport.mock.calls[0]![0])).not.toContain("/rpc/");
});
it("rejects a corrupted persisted snapshot digest", async () => {
  transport.mockResolvedValue(Response.json({ plan: row, forecastSnapshot: record.snapshot, forecastHash: "0x" + "b".repeat(64), reports: [], revisions: [] }));
  await expect(repository.detail(id)).rejects.toMatchObject({ status: 503 });
});
it("rejects altered snapshot content before a privileged write", async () => {
  await expect(repository.saveComparison(id, { ...record, hash: "0x" + "b".repeat(64) }, comparison)).rejects.toMatchObject({ status: 503 });
  expect(transport).not.toHaveBeenCalled();
});
it("rejects unsafe pagination cursor fields before constructing filters", async () => {
  const cursor = Buffer.from(JSON.stringify({ acceptedAtUtc: NOW, id: "x),owner_id.neq.someone" })).toString("base64url");
  await expect(repository.page(20, cursor)).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(transport).not.toHaveBeenCalled();
});
it("maps database outages without exposing backend details", async () => {
  transport.mockResolvedValue(Response.json({ code: "XX000", message: "private-database-canary" }, { status: 500 }));
  await expect(repository.detail(id)).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE", status: 503 });
});

it("returns an owner-only comparison plus its original snapshot without exposing row ownership", async () => {
  transport.mockImplementation(async (input) => Response.json(String(input).includes("/comparisons?") ? [{ id, owner_id: owner, version: 1, payload: comparison }] : [{ snapshot: record.snapshot, digest: record.hash }]));
  const result = await repository.comparison(id);
  expect(result.comparison).toMatchObject({ ...comparison, id, version: 1 });expect(result.forecastSnapshot).toEqual(record.snapshot);expect(result.comparison).not.toHaveProperty("owner_id");
  expect(String(transport.mock.calls[0]![0])).toContain("owner_id=eq." + owner);
});
it("denies a foreign comparison row before reading its snapshot", async () => {
  transport.mockResolvedValue(Response.json([{ id, owner_id: id, version: 1, payload: comparison }]));
  await expect(repository.comparison(id)).rejects.toMatchObject({ status: 404 });expect(transport).toHaveBeenCalledOnce();
});

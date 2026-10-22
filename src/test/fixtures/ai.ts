import type { ConstraintSuggestion } from "@/contracts/ai";
import type { AiStore } from "@/server/ai/store";
import { randomUUID } from "node:crypto";
import { vi } from "vitest";
export function suggestionFixture(): ConstraintSuggestion {
  return { schemaVersion: 1, earliestLocal: { date: null, time: null, offsetChoice: null }, deadlineLocal: { date: "2026-10-23", time: "12:00", offsetChoice: null }, baselineLocal: { date: null, time: null, offsetChoice: null }, blockedLocal: [], durationMinutes: null,
    questions: [{ field: "earliestLocal", code: "missing", messageKey: "complete_field" }, { field: "durationMinutes", code: "missing", messageKey: "complete_field" }],
    sourceSpans: [{ field: "deadlineLocal", start: 0, end: 24 }], unsupportedRequests: [] };
}
export function aiStoreFixture() {
  return { begin: vi.fn<AiStore["begin"]>().mockImplementation(async () => ({ id: randomUUID(), deadline: new Date(Date.now() + 22000).toISOString() })),
    reserve: vi.fn<AiStore["reserve"]>().mockResolvedValue({ id: randomUUID(), attempt: 1 }), finishAttempt: vi.fn<AiStore["finishAttempt"]>().mockResolvedValue(), finishTask: vi.fn<AiStore["finishTask"]>().mockResolvedValue() };
}

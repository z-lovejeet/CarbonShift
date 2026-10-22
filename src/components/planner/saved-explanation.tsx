"use client";
import type { ComparisonDocument } from "@/contracts/planning";
import { aiApi } from "@/lib/ai-api";
import { ExplanationPanel } from "./explanation-panel";
export function SavedExplanation({ comparison, available }: { comparison: ComparisonDocument; available: boolean }) {
  return <ExplanationPanel comparison={comparison} request={available ? aiApi.explanation : undefined} />;
}

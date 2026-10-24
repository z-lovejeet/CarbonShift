import type { Database as Generated } from "./database.types";
export type { Json } from "./database.types";

// PostgreSQL allows NULL for these function arguments. The CLI generator does not
// encode argument nullability, so correct only the explicitly nullable RPC inputs.
type Functions = Generated["public"]["Functions"];
type NullableArgs<F extends { Args: object }, K extends keyof F["Args"]> = Omit<F, "Args"> & {
  Args: Omit<F["Args"], K> & { [P in K]: F["Args"][P] | null };
};
type Corrections = {
  cs_schedule_report_commit: NullableArgs<Functions["cs_schedule_report_commit"], "p_report">;
  cs_publication_preview: NullableArgs<Functions["cs_publication_preview"], "p_result">;
  cs_publication_consent: NullableArgs<Functions["cs_publication_consent"], "p_revision">;
  cs_ledger_observe: NullableArgs<Functions["cs_ledger_observe"], "p_code" | "p_block" | "p_block_hash">;
};
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions"> & { Functions: Omit<Functions, keyof Corrections> & Corrections };
};

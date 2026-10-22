import { z } from "zod";
import { candidates, parseAiPolicy, type AiPolicy } from "./ai-policy";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export class ConfigurationError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`Invalid configuration. Check: ${[...new Set(fields)].join(", ")}. Values are omitted.`);
    this.name = "ConfigurationError";
  }
}

const text = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);
const flag = text.refine((value) => value === undefined || value === "true" || value === "false")
  .transform((value) => value === "true");

function safeUrl(value: string, originOnly: boolean): boolean {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && local)) &&
      !url.username && !url.password && !url.hash &&
      (!originOnly || ((url.pathname === "/" || !url.pathname) && !url.search));
  } catch { return false; }
}

const origin = text.refine((value) => value === undefined || safeUrl(value, true));
const rpcUrl = text.refine((value) => value === undefined || safeUrl(value, false));
const chainId = text.refine((value) => value === undefined || value === "11155111");
const address = text.refine((value) => value === undefined ||
  (/^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value)));
const block = text.refine((value) => value === undefined ||
  (/^\d+$/.test(value) && Number.isSafeInteger(Number(value))))
  .transform((value) => value === undefined ? undefined : Number(value));
const hmac = text.refine((value) => value === undefined || value.length >= 32);
const keyOrder = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
const signingKey = text.refine((value) => value === undefined ||
  (/^0x[0-9a-fA-F]{64}$/.test(value) && BigInt(value) > 0n && BigInt(value) < keyOrder));

const ledgerFields = {
  LEDGER_ENABLED: flag,
  SEPOLIA_RPC_URL: rpcUrl,
  LEDGER_CHAIN_ID: chainId,
  LEDGER_CONTRACT_ADDRESS: address,
  LEDGER_DEPLOYMENT_BLOCK: block,
};

const webSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: origin,
  NEXT_PUBLIC_SUPABASE_URL: origin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: text.refine((value) => value === undefined ||
    (value.startsWith("sb_publishable_") && value.length > "sb_publishable_".length)),
  SUPABASE_SECRET_KEY: text,
  RATE_LIMIT_HMAC_SECRET: hmac,
  AI_ENABLED: flag,
  GEMINI_API_KEY: text,
  GROQ_API_KEY: text,
  AI_POLICY_JSON: text,
  PRIVACY_CONTACT: text,
  ...ledgerFields,
}).superRefine((data, ctx) => {
  const missing = (field: keyof typeof data) => {
    if (data[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message: "Required for this capability" });
  };
  const database = data.NEXT_PUBLIC_SUPABASE_URL !== undefined ||
    data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined || data.SUPABASE_SECRET_KEY !== undefined;
  if (database || data.AI_ENABLED || data.LEDGER_ENABLED) {
    missing("NEXT_PUBLIC_SUPABASE_URL");
    missing("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    missing("RATE_LIMIT_HMAC_SECRET");
    if (data.NODE_ENV === "production") {
      missing("APP_ORIGIN");
      if (data.APP_ORIGIN && !data.APP_ORIGIN.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_ORIGIN"], message: "HTTPS required" });
      }
    }
  }
  if (data.AI_ENABLED) {
    for (const field of ["SUPABASE_SECRET_KEY", "GROQ_API_KEY", "AI_POLICY_JSON"] as const) missing(field);
  }
  if (data.LEDGER_ENABLED) {
    for (const field of ["SUPABASE_SECRET_KEY", "SEPOLIA_RPC_URL", "LEDGER_CHAIN_ID",
      "LEDGER_CONTRACT_ADDRESS", "LEDGER_DEPLOYMENT_BLOCK"] as const) missing(field);
  }
});

const workerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: origin,
  SUPABASE_SECRET_KEY: text,
  LEDGER_PRIVATE_KEY: signingKey,
  ...ledgerFields,
}).superRefine((data, ctx) => {
  if (!data.LEDGER_ENABLED) ctx.addIssue({ code: "custom", path: ["LEDGER_ENABLED"], message: "Worker must be explicitly enabled" });
  for (const field of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "LEDGER_PRIVATE_KEY", "SEPOLIA_RPC_URL",
    "LEDGER_CHAIN_ID", "LEDGER_CONTRACT_ADDRESS", "LEDGER_DEPLOYMENT_BLOCK"] as const) {
    if (data[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message: "Required for the worker" });
  }
});

function parse<T>(schema: z.ZodType<T>, source: EnvironmentSource): T {
  const result = schema.safeParse(source);
  if (!result.success) throw new ConfigurationError(result.error.issues.map((issue) => String(issue.path[0] ?? "environment")));
  return result.data;
}

export function parseWebEnvironment(source: EnvironmentSource) {
  const publicFields = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  const forbidden = Object.keys(source).filter((key) => key.startsWith("NEXT_PUBLIC_") && !publicFields.has(key) && source[key]);
  if (source.LEDGER_PRIVATE_KEY?.trim()) throw new ConfigurationError(["LEDGER_PRIVATE_KEY (worker only)"]);
  if (forbidden.length) throw new ConfigurationError(forbidden.map((name) => /^[A-Z0-9_ ()]+$/.test(name) ? name : "UNRECOGNIZED_PUBLIC_VARIABLE"));
  const data = parse(webSchema, source);
  let aiPolicy: AiPolicy | undefined;
  if (data.AI_ENABLED) {
    const legacy = ["AI_CONSTRAINT_PRIMARY_MODEL", "AI_CONSTRAINT_FALLBACK_MODEL", "AI_EXPLANATION_PRIMARY_MODEL", "AI_EXPLANATION_FALLBACK_MODEL"];
    if (legacy.some((key) => source[key]?.trim())) throw new ConfigurationError(["AI_POLICY_JSON (remove legacy model fields)"]);
    try {
      aiPolicy = parseAiPolicy(data.AI_POLICY_JSON!);
      if (["constraints", "explanation"].some((role) => candidates(aiPolicy!, role as "constraints" | "explanation").length === 0)) throw new Error();
      if (aiPolicy.models.some((m) => m.enabled && m.id.startsWith("gemini-")) && !data.GEMINI_API_KEY) throw new Error();
      if (data.NODE_ENV === "production" && aiPolicy.profile === "eligible_free_development") throw new Error();
    } catch { throw new ConfigurationError(["AI_POLICY_JSON"]); }
  }
  return Object.freeze({
    nodeEnv: data.NODE_ENV,
    appOrigin: data.APP_ORIGIN ? new URL(data.APP_ORIGIN).origin : data.NODE_ENV === "production" ? null : "http://127.0.0.1:3000",
    database: data.NEXT_PUBLIC_SUPABASE_URL ? Object.freeze({
      configured: true as const,
      url: data.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      secretKey: data.SUPABASE_SECRET_KEY ?? null,
    }) : Object.freeze({ configured: false as const }),
    ai: data.AI_ENABLED ? Object.freeze({
      enabled: true as const,
      geminiApiKey: data.GEMINI_API_KEY ?? null,
      groqApiKey: data.GROQ_API_KEY!,
      policy: aiPolicy!,
    }) : Object.freeze({ enabled: false as const }),
    ledger: data.LEDGER_ENABLED ? Object.freeze({
      enabled: true as const,
      rpcUrl: data.SEPOLIA_RPC_URL!,
      chainId: 11155111 as const,
      contractAddress: data.LEDGER_CONTRACT_ADDRESS!,
      deploymentBlock: data.LEDGER_DEPLOYMENT_BLOCK!,
    }) : Object.freeze({ enabled: false as const }),
    rateLimitHmacSecret: data.RATE_LIMIT_HMAC_SECRET ?? null,
    privacyContact: data.PRIVACY_CONTACT ?? null,
  });
}

export function parseWorkerEnvironment(source: EnvironmentSource) {
  const data = parse(workerSchema, source);
  return Object.freeze({
    databaseUrl: data.NEXT_PUBLIC_SUPABASE_URL!,
    databaseSecretKey: data.SUPABASE_SECRET_KEY!,
    rpcUrl: data.SEPOLIA_RPC_URL!,
    chainId: 11155111 as const,
    contractAddress: data.LEDGER_CONTRACT_ADDRESS!,
    deploymentBlock: data.LEDGER_DEPLOYMENT_BLOCK!,
    privateKey: data.LEDGER_PRIVATE_KEY!,
  });
}

export type WebEnvironment = ReturnType<typeof parseWebEnvironment>;
export type WorkerEnvironment = ReturnType<typeof parseWorkerEnvironment>;

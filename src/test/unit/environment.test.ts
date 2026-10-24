import { describe, expect, it } from "vitest";
import { ConfigurationError, parseWebEnvironment, parseWorkerEnvironment } from "../../config/environment";
import { policyFixture } from "../fixtures/ai-policy";

const database = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_authored_test",
  SUPABASE_SECRET_KEY: "authored-private-database-canary",
  RATE_LIMIT_HMAC_SECRET: "authored-test-hmac-with-at-least-32-characters",
};
const ai = {
  ...database, AI_ENABLED: "true", GEMINI_API_KEY: "authored-gemini-canary", GROQ_API_KEY: "authored-groq-canary",
  AI_POLICY_JSON: JSON.stringify(policyFixture()),
};
const ledger = {
  ...database, LEDGER_ENABLED: "true", LEDGER_CHAIN_ID: "11155111", SEPOLIA_RPC_URL: "https://rpc.example.test/credential",
  LEDGER_CONTRACT_ADDRESS: `0x${"1".repeat(40)}`, LEDGER_DEPLOYMENT_BLOCK: "0",
};
const worker = { ...ledger, LEDGER_PRIVATE_KEY: `0x${"0".repeat(63)}1` };

describe("web configuration boundaries", () => {
  it("runs the foundation without any service credentials", () => {
    const env = parseWebEnvironment({});
    expect(env.database.configured).toBe(false);
    expect(env.ai.enabled).toBe(false);
    expect(env.ledger.enabled).toBe(false);
  });
  it("does not treat the string false as enabled", () => {
    expect(parseWebEnvironment({ AI_ENABLED: "false", LEDGER_ENABLED: "false" }).ai.enabled).toBe(false);
  });
  it("rejects ambiguous feature flags", () => {
    expect(() => parseWebEnvironment({ AI_ENABLED: "yes" })).toThrow(ConfigurationError);
  });
  it("does not demand a production origin for the public foundation alone", () => {
    expect(parseWebEnvironment({ NODE_ENV: "production" }).appOrigin).toBeNull();
  });
  it("requires a production HTTPS origin before account-backed capabilities", () => {
    expect(() => parseWebEnvironment({ ...database, NODE_ENV: "production" })).toThrow("APP_ORIGIN");
    expect(() => parseWebEnvironment({ ...database, NODE_ENV: "production", APP_ORIGIN: "http://localhost:3000" })).toThrow("APP_ORIGIN");
    expect(() => parseWebEnvironment({ ...database, NODE_ENV: "production", APP_ORIGIN: "invalid-private-origin-canary" })).toThrow(ConfigurationError);
    expect(parseWebEnvironment({ ...database, NODE_ENV: "production", APP_ORIGIN: "https://carbonshift.example" }).appOrigin).toBe("https://carbonshift.example");
  });
  it.each(["https://site.test/path", "https://site.test?secret=canary", "https://user:password@site.test", "http://remote.test"])("rejects an unsafe origin", (APP_ORIGIN) => {
    expect(() => parseWebEnvironment({ APP_ORIGIN })).toThrow(ConfigurationError);
  });
  it("requires the complete database pair and quota secret", () => {
    expect(() => parseWebEnvironment({ NEXT_PUBLIC_SUPABASE_URL: database.NEXT_PUBLIC_SUPABASE_URL })).toThrow(ConfigurationError);
  });
  it("rejects a privileged key in the publishable-key field", () => {
    expect(() => parseWebEnvironment({ ...database, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_canary" })).toThrow(ConfigurationError);
  });
  it("requires credentials and a qualified strict routing policy when AI is enabled", () => {
    expect(() => parseWebEnvironment({ AI_ENABLED: "true" })).toThrow("GROQ_API_KEY");
    expect(parseWebEnvironment(ai).ai.enabled).toBe(true);
  });
  it("rejects legacy model fields instead of keeping two routing authorities", () => {
    expect(() => parseWebEnvironment({ ...ai, AI_CONSTRAINT_PRIMARY_MODEL: "gemini-latest" })).toThrow(ConfigurationError);
    expect(() => parseWebEnvironment({ ...ai, AI_CONSTRAINT_PRIMARY_MODEL: "openai/gpt-oss-120b" })).toThrow(ConfigurationError);
  });
  it("does not return credentials for disabled AI", () => {
    expect(JSON.stringify(parseWebEnvironment({ GEMINI_API_KEY: "never-return-this-canary" }))).not.toContain("never-return-this-canary");
  });
  it("rejects a signer or any unapproved public variable in the web environment", () => {
    expect(() => parseWebEnvironment(worker)).toThrow(ConfigurationError);
    expect(() => parseWebEnvironment({ NEXT_PUBLIC_GEMINI_API_KEY: "canary" })).toThrow(ConfigurationError);
  });
  it("accepts Vercel's injected public observability field without allowing arbitrary public keys", () => {
    const injected = { VERCEL: "1", NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG: "{}" };
    expect(() => parseWebEnvironment(injected)).not.toThrow();
    expect(() => parseWebEnvironment({ ...injected, VERCEL: undefined })).not.toThrow();
    expect(() => parseWebEnvironment({ ...injected, NEXT_PUBLIC_VERCEL_SECRET_KEY: "canary" })).toThrow(ConfigurationError);
  });
  it("never returns the actual invalid credential in an error", () => {
    try { parseWebEnvironment({ ...ledger, SEPOLIA_RPC_URL: "invalid-private-rpc-canary" }); }
    catch (error) { expect(String(error)).not.toContain("invalid-private-rpc-canary"); return; }
    throw new Error("Expected invalid RPC to be rejected");
  });
  it("keeps chain IDs pinned and deployment block zero valid", () => {
    expect(() => parseWebEnvironment({ ...ledger, LEDGER_CHAIN_ID: "1" })).toThrow(ConfigurationError);
    const result = parseWebEnvironment(ledger);
    expect(result.ledger.enabled && result.ledger.deploymentBlock).toBe(0);
  });
  it.each(["-1", "1.5", "9007199254740992"])("rejects invalid deployment block", (LEDGER_DEPLOYMENT_BLOCK) => {
    expect(() => parseWebEnvironment({ ...ledger, LEDGER_DEPLOYMENT_BLOCK })).toThrow(ConfigurationError);
  });
});

describe("worker configuration boundaries", () => {
  it("fails usefully when the worker is unconfigured", () => {
    expect(() => parseWorkerEnvironment({})).toThrow("LEDGER_PRIVATE_KEY");
  });
  it("accepts the authored local fixture without connecting or signing", () => {
    const env = parseWorkerEnvironment(worker);
    expect(env.chainId).toBe(11155111);
    expect(env).not.toHaveProperty("GEMINI_API_KEY");
    expect(Object.isFrozen(env)).toBe(true);
  });
  it.each(["0x123", `0x${"0".repeat(64)}`, `0x${"f".repeat(64)}`])("rejects invalid signing-key material", (LEDGER_PRIVATE_KEY) => {
    expect(() => parseWorkerEnvironment({ ...worker, LEDGER_PRIVATE_KEY })).toThrow(ConfigurationError);
  });
});

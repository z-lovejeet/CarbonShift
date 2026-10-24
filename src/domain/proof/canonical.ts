import canonicalize from "canonicalize";
import { sha256 } from "@noble/hashes/sha2.js";
import { methodDescriptorSchema, planManifestSchema, proofBundleSchema, resultManifestSchema } from "./schemas";

export const MAX_BUNDLE_BYTES = 256 * 1024;
const encoder = new TextEncoder();
function unicode(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Malformed Unicode.");
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new Error("Malformed Unicode.");
  }
}
/** Reject coercion, accessors, unsafe numbers and ambiguous object values before JCS or schemas. */
export function assertProofJson(input: unknown): void {
  const seen = new Set<object>(); let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 50000 || depth > 32) throw new Error("Proof JSON is too complex.");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") { if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new Error("Use safe integer JSON numbers."); return; }
    if (typeof value === "string") { unicode(value); if (value.length > MAX_BUNDLE_BYTES) throw new Error("String too large."); return; }
    if (typeof value !== "object" || seen.has(value)) throw new Error("Use acyclic plain JSON values.");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error("Use plain JSON objects.");
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1) throw new Error("Sparse or extended arrays are not JSON.");
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string") throw new Error("Symbol fields are not JSON.");
      unicode(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !("value" in descriptor) || (array && !/^(0|[1-9]\d*)$/.test(key))) throw new Error("Accessors and hidden fields are not JSON.");
      visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
  };
  visit(input, 0);
}
export function canonicalJson(input: unknown): string {
  assertProofJson(input);
  const output = canonicalize(input);
  if (output === undefined || encoder.encode(output).length > MAX_BUNDLE_BYTES) throw new Error("Proof JSON exceeds the size limit.");
  return output;
}
function digest(kind: "plan" | "result" | "method", input: unknown): string {
  return `0x${Array.from(sha256(encoder.encode(`CarbonShift:${kind}:v1\n${canonicalJson(input)}`)), (v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function hashPlan(input: unknown): string { assertProofJson(input); return digest("plan", planManifestSchema.parse(input)); }
export function hashResult(input: unknown): string { assertProofJson(input); return digest("result", resultManifestSchema.parse(input)); }
export function hashMethod(input: unknown): string { assertProofJson(input); return digest("method", methodDescriptorSchema.parse(input)); }
export function exportProofBundle(input: unknown): string { assertProofJson(input); return canonicalJson(proofBundleSchema.parse(input)); }

/** Bounded JSON parser preserves duplicate-key and numeric-lexeme evidence JSON.parse discards. */
export function parseProofJson(text: string, maximumBytes = MAX_BUNDLE_BYTES): unknown {
  if (text.length > maximumBytes || encoder.encode(text).length > maximumBytes) throw new Error("Bundle exceeds 256 KiB.");
  let cursor = 0;
  const whitespace = () => { while (/[\t\n\r ]/.test(text[cursor] ?? "!")) cursor++; };
  const string = (): string => {
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === "\\") { cursor++; continue; }
      if (char === '"') { const value = JSON.parse(text.slice(start, cursor)) as string; unicode(value); return value; }
    }
    throw new Error("Unterminated JSON string.");
  };
  const value = (depth: number): unknown => {
    if (depth > 32) throw new Error("Bundle nesting limit exceeded.");
    whitespace(); const char = text[cursor];
    if (char === '"') return string();
    if (char === "{" || char === "[") {
      cursor++; whitespace(); const array = char === "[", end = array ? "]" : "}";
      const object: Record<string, unknown> = Object.create(null), items: unknown[] = [], keys = new Set<string>();
      if (text[cursor] === end) { cursor++; return array ? items : object; }
      while (cursor < text.length) {
        whitespace(); let key = "";
        if (!array) {
          if (text[cursor] !== '"') throw new Error("Expected a JSON key.");
          key = string(); if (keys.has(key)) throw new Error("Duplicate JSON key."); keys.add(key);
          whitespace(); if (text[cursor++] !== ":") throw new Error("Expected colon.");
        }
        const child = value(depth + 1); if (array) items.push(child); else object[key] = child;
        whitespace(); const separator = text[cursor++]; if (separator === end) return array ? items : object;
        if (separator !== ",") throw new Error("Expected comma.");
      }
      throw new Error("Unterminated JSON container.");
    }
    const token = /^[^\s,\]}]+/.exec(text.slice(cursor))?.[0];
    if (!token) throw new Error("Expected JSON value."); cursor += token.length;
    if (token === "null") return null; if (token === "true") return true; if (token === "false") return false;
    if (!/^-?(0|[1-9]\d*)$/.test(token)) throw new Error("Use integer JSON numeric lexemes.");
    const number = Number(token); if (!Number.isSafeInteger(number) || Object.is(number, -0)) throw new Error("Unsafe JSON number.");
    return number;
  };
  const input = value(0); whitespace(); if (cursor !== text.length) throw new Error("Trailing JSON content.");
  assertProofJson(input); return input;
}

export function importProofBundle(text: string) { return proofBundleSchema.parse(parseProofJson(text)); }

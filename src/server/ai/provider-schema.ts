/** Providers compile shape constraints; server validation retains all numeric/length bounds. */
export function providerShape(schema: Record<string, unknown>): Record<string, unknown> {
  const localBounds = new Set(["$schema", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "pattern"]);
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object" && "const" in value) return { type: typeof value.const === "number" ? "integer" : typeof value.const, enum: [value.const] };
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !localBounds.has(key)).map(([key, child]) => [key, visit(child)]));
    return value;
  }
  return visit(schema) as Record<string, unknown>;
}

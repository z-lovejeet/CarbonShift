import { posix } from "node:path";
import ts from "typescript";

const publicVariables = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
const backendPackages = ["server-only", "@google/genai", "groq-sdk", "viem/accounts"];

function isProcessEnv(node: ts.Node): boolean {
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
    node.expression.text === "process" && node.name.text === "env";
}

/** Inspect executable imports transitively, so a client-side barrel cannot hide a secret module. */
export function inspectImportBoundaries(files: ReadonlyMap<string, string>): string[] {
  const parsed = new Map([...files].map(([name, text]) => [name, ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)]));
  const errors = new Set<string>();
  const resolve = (from: string, target: string) => {
    const base = target.startsWith("@/") ? `src/${target.slice(2)}` :
      target.startsWith(".") ? posix.normalize(posix.join(posix.dirname(from), target)) : null;
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((name) => parsed.has(name)) ?? null;
  };
  for (const [entry, tree] of parsed) {
    const first = tree.statements[0];
    if (!first || !ts.isExpressionStatement(first) || !ts.isStringLiteral(first.expression) || first.expression.text !== "use client") continue;
    const visited = new Set<string>();
    const visit = (name: string, chain: string[]) => {
      if (visited.has(name)) return;
      visited.add(name);
      if (name.startsWith("src/server/") || name.startsWith("src/worker/") || name.startsWith("src/config/ai-") || name === "src/config/environment.ts") {
        errors.add(`Client imports backend configuration: ${chain.join(" -> ")}`);
        return;
      }
      const source = parsed.get(name);
      if (!source) return;
      const dependency = (specifier: string) => {
        if (specifier.startsWith("node:") || backendPackages.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`))) {
          errors.add(`Client imports server-only dependency in ${name}`);
        }
        const next = resolve(name, specifier);
        if (next) visit(next, [...chain, next]);
      };
      const walk = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          const clause = node.importClause;
          const named = clause?.namedBindings;
          const onlyNamedTypes = !clause?.name && named && ts.isNamedImports(named) && named.elements.every((item) => item.isTypeOnly);
          if (!clause?.isTypeOnly && !onlyNamedTypes && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
        } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          dependency(node.moduleSpecifier.text);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteral(argument)) dependency(argument.text);
          else errors.add(`Client has an unanalyzable dynamic import in ${name}`);
        } else if (isProcessEnv(node)) {
          const parent = node.parent;
          const key = ts.isPropertyAccessExpression(parent) ? parent.name.text :
            ts.isElementAccessExpression(parent) && parent.argumentExpression && ts.isStringLiteral(parent.argumentExpression) ? parent.argumentExpression.text : null;
          if (!key || !publicVariables.has(key)) errors.add(`Client reads unapproved environment configuration in ${name}`);
        }
        ts.forEachChild(node, walk);
      };
      walk(source);
    };
    visit(entry, [entry]);
  }
  return [...errors];
}

/** Domain imports stay inside the domain or explicitly selected pure libraries. */
export function inspectDomainPurity(files: ReadonlyMap<string, string>): string[] {
  const errors = new Set<string>();
  for (const [name, text] of files) {
    if (!name.startsWith("src/domain/")) continue;
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const dependency = (specifier: string) => {
      const target = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` :
        specifier.startsWith(".") ? posix.normalize(posix.join(posix.dirname(name), specifier)) : null;
      if (target?.startsWith("src/domain/") || specifier === "zod" ||
        (specifier === "@js-temporal/polyfill" && name === "src/domain/time.ts") ||
        (["canonicalize", "@noble/hashes/sha2.js"].includes(specifier) && ["src/domain/proof/canonical.ts", "src/domain/proof/v2/canonical.ts"].includes(name))) return;
      errors.add(`Domain imports an impure/unapproved dependency in ${name}: ${specifier}`);
    };
    const walk = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        errors.add(`Domain has a dynamic import/require in ${name}`);
      }
      if (ts.isIdentifier(node) && ["fetch", "process", "window", "document", "navigator", "localStorage", "globalThis", "XMLHttpRequest", "WebSocket"].includes(node.text) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
        errors.add(`Domain reads an ambient capability (${node.text}) in ${name}`);
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
        ((node.expression.text === "Date" && node.name.text === "now") || (node.expression.text === "Math" && node.name.text === "random") || (node.expression.text === "Temporal" && node.name.text === "Now"))) {
        errors.add(`Domain reads an ambient clock/random source in ${name}`);
      }
      if ((ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date" && !node.arguments?.length) ||
        (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date")) errors.add(`Domain reads the ambient date in ${name}`);
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  return [...errors];
}

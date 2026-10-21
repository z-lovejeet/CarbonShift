import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([".next/**", "node_modules/**", "contracts/artifacts/**", "contracts/cache/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["src/**/*.tsx"],
    plugins: { "@next/next": next, "react-hooks": hooks },
    rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules, ...hooks.configs.recommended.rules },
  },
);

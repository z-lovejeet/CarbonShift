import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  outputDir: "test-results/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://127.0.0.1:3100/api/v1/health",
    reuseExistingServer: false,
    timeout: 30_000,
    env: { APP_ORIGIN: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", RATE_LIMIT_HMAC_SECRET: "", AI_ENABLED: "false", LEDGER_ENABLED: "false", GRID_PUBLIC_SUMMARY_ENABLED: "false", LEDGER_HOUSEHOLD_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" },
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Critical end-to-end tests (auth + inbox). Requires a running dev server and the
 * seeded demo database. Start the app first (npm run dev) — the config reuses an
 * already-running server, or starts one via node if needed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

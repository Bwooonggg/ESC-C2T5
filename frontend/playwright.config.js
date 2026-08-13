import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./test/e2e",
    fullyParallel: true,
    workers: 2,
    retries: process.env.CI ? 2 : 0,
    reporter: [["list"]],
    use: {
        baseURL: "http://127.0.0.1:5173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],
    webServer: {
        command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
        env: { VITE_USE_STUBS: "true" },
    },
});
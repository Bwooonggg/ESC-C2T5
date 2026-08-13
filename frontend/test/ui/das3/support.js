import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Builder, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(currentDirectory, "../../..");
const viteEntry = path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js");
const artifactDirectory = path.join(currentDirectory, "artifacts");

export const baseUrl = process.env.DAS3_UI_BASE_URL ?? "http://127.0.0.1:5173";
export const backendUrl = process.env.DAS3_UI_BACKEND_URL ?? "http://localhost:2024";

export const testEmail = process.env.DAS3_UI_TEST_EMAIL;
export const testPassword = process.env.DAS3_UI_TEST_PASSWORD;

let viteProcess;
let viteOutput = "";

async function waitForFrontend(timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (viteProcess?.exitCode !== null) {
            throw new Error(`Vite exited before becoming ready.\n${viteOutput}`);
        }

        try {
            const response = await fetch(baseUrl);
            if (response.ok) return;
        } catch {
            // Vite has not opened the port yet.
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for ${baseUrl}.\n${viteOutput}`);
}

async function waitForBackend(timeoutMs = 5_000) {
    try {
        await fetch(backendUrl, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        throw new Error(
            `Could not reach the LangGraph backend at ${backendUrl}. ` +
                `Start it (e.g. \`langgraph dev\`) before running this suite, ` +
                `or set DAS3_UI_BACKEND_URL if it runs elsewhere.\n${error}`,
        );
    }
}

export async function startPreviewFrontend() {
    if (viteProcess) return;

    await waitForBackend();

    if (!testEmail || !testPassword) {
        throw new Error(
            "DAS3_UI_TEST_EMAIL / DAS3_UI_TEST_PASSWORD must be set to a seeded " +
                "Supabase account with worksheet access, since this suite runs " +
                "against real auth (not stubs).",
        );
    }

    const url = new URL(baseUrl);
    viteProcess = spawn(
        process.execPath,
        [
            viteEntry,
            "--host",
            url.hostname,
            "--port",
            url.port || "5173",
            "--strictPort",
        ],
        {
            cwd: frontendDirectory,
            // Deliberately VITE_USE_STUBS: "false" — full-integration run against
            // the real Supabase auth + the real /api/worksheet LangGraph backend.
            env: { ...process.env, VITE_USE_STUBS: "false" },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        },
    );

    viteProcess.stdout.on("data", (chunk) => { viteOutput += chunk.toString(); });
    viteProcess.stderr.on("data", (chunk) => { viteOutput += chunk.toString(); });

    await waitForFrontend();
}

export async function stopPreviewFrontend() {
    if (!viteProcess) return;

    const processToStop = viteProcess;
    viteProcess = undefined;
    processToStop.kill();

    if (processToStop.exitCode === null) {
        await Promise.race([
            new Promise((resolve) => processToStop.once("exit", resolve)),
            new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
    }
}

export async function createChromeDriver() {
    const options = new chrome.Options();
    options.addArguments("--window-size=1440,1100", "--disable-gpu");
    if (process.env.DAS3_UI_HEADED !== "true") options.addArguments("--headless=new");

    return new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();
}

export async function findVisible(driver, locator, timeoutMs = 10_000) {
    const element = await driver.wait(until.elementLocated(locator), timeoutMs);
    await driver.wait(until.elementIsVisible(element), timeoutMs);
    return element;
}

export async function waitForText(driver, locator, expected, timeoutMs = 10_000) {
    const element = await findVisible(driver, locator, timeoutMs);
    await driver.wait(async () => (await element.getText()).includes(expected), timeoutMs);
    return element;
}

export async function waitForValue(driver, element, expected, timeoutMs = 10_000) {
    await driver.wait(async () => (await element.getAttribute("value")) === expected, timeoutMs);
}

export async function saveFailureEvidence(driver, testTitle) {
    await mkdir(artifactDirectory, { recursive: true });
    const safeTitle = testTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = path.join(artifactDirectory, `${timestamp}-${safeTitle}`);

    const [screenshot, currentUrl] = await Promise.all([
        driver.takeScreenshot(),
        driver.getCurrentUrl(),
    ]);
    await Promise.all([
        writeFile(`${prefix}.png`, screenshot, "base64"),
        writeFile(`${prefix}.txt`, `URL: ${currentUrl}\n`, "utf8"),
    ]);
}
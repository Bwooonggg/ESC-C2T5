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

export const baseUrl = process.env.DAS1_UI_BASE_URL ?? "http://127.0.0.1:5173";

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

export async function startPreviewFrontend() {
    if (viteProcess) return;

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
            env: { ...process.env, VITE_USE_STUBS: "true" },
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
    if (process.env.DAS1_UI_HEADED !== "true") options.addArguments("--headless=new");

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

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { By, until } from "selenium-webdriver";
import {
    baseUrl,
    createChromeDriver,
    findVisible,
    saveFailureEvidence,
    startPreviewFrontend,
    stopPreviewFrontend,
    waitForText,
} from "./support.js";

const worksheetUrl = `${baseUrl}/worksheet`;
const GREETING = "Hello! What topic and band should the worksheet cover, and would you like MCQ or open-ended questions?";
const SAMPLE_PROMPT = "Band A MCQ worksheet on subject-verb agreement";

async function openWorksheet(driver) {
    await driver.get(worksheetUrl);
    await waitForText(driver, By.css(".chat-scroll"), GREETING);
}

async function sendPrompt(driver, text) {
    const textarea = await findVisible(driver, By.id("worksheet-prompt"));
    await textarea.clear();
    await textarea.sendKeys(text);
    await driver.findElement(By.xpath("//button[normalize-space()='Send']")).click();
}

describe("DAS 3 Selenium UI", function () {
    let driver;

    function uiTest(name, testBody) {
        it(name, async function () {
            driver = await createChromeDriver();
            try {
                await testBody();
            } catch (error) {
                await saveFailureEvidence(driver, name);
                throw error;
            } finally {
                await driver.quit();
                driver = undefined;
            }
        });
    }

    before(async function () {
        await startPreviewFrontend();
    });

    after(async function () {
        await stopPreviewFrontend();
    });

    uiTest("UI3-01 loads the worksheet workspace with an empty preview", async function () {
        await openWorksheet(driver);

        await findVisible(driver, By.xpath("//h2[normalize-space()='Your worksheet will appear here']"));
        const showButton = await driver.findElement(By.xpath("//button[contains(normalize-space(), 'Show answers')]"));
        assert.equal(await showButton.getAttribute("disabled"), "true");
        const printButton = await driver.findElement(By.xpath("//button[normalize-space()='Print / PDF']"));
        assert.equal(await printButton.getAttribute("disabled"), "true");
    });

    uiTest("UI3-02 generates a sample worksheet from a prompt", async function () {
        await openWorksheet(driver);
        await sendPrompt(driver, SAMPLE_PROMPT);

        await waitForText(
            driver,
            By.css(".worksheet-document header"),
            `Literacy Practice: ${SAMPLE_PROMPT}`,
        );
        const preview = await driver.findElement(By.css(".worksheet-document"));
        const previewText = await preview.getText();
        assert.match(previewText, /Read each question carefully\./);
        assert.match(previewText, /Which sentence uses the correct subject–verb agreement\?/);
    });

    uiTest("UI3-03 shows the assistant's confirmation message in chat", async function () {
        await openWorksheet(driver);
        await sendPrompt(driver, SAMPLE_PROMPT);

        await waitForText(
            driver,
            By.css(".chat-scroll"),
            "Here is a sample worksheet using preview data.",
        );
    });

    uiTest("UI3-04 toggles answers on and off in the preview", async function () {
        await openWorksheet(driver);
        await sendPrompt(driver, SAMPLE_PROMPT);
        await findVisible(driver, By.css(".worksheet-document"));

        const toggle = await driver.findElement(By.xpath("//button[contains(normalize-space(), 'answers')]"));
        await driver.wait(async () => (await toggle.getAttribute("disabled")) === null, 10_000);

        await toggle.click();
        await waitForText(driver, By.css(".worksheet-document"), "Answer:");
        assert.equal((await toggle.getText()).trim(), "Hide answers");

        await toggle.click();
        await driver.wait(async () => !(await driver.findElement(By.css(".worksheet-document")).getText()).includes("Answer:"), 10_000);
        assert.equal((await toggle.getText()).trim(), "Show answers");
    });

    uiTest("UI3-05 enables Print / PDF once a worksheet exists", async function () {
        await openWorksheet(driver);
        await sendPrompt(driver, SAMPLE_PROMPT);
        await findVisible(driver, By.css(".worksheet-document"));

        const printButton = await driver.findElement(By.xpath("//button[normalize-space()='Print / PDF']"));
        await driver.wait(async () => (await printButton.getAttribute("disabled")) === null, 10_000);
        assert.equal(await printButton.getAttribute("disabled"), null);
    });

    uiTest("UI3-06 resets the workspace back to the greeting", async function () {
        await openWorksheet(driver);
        await sendPrompt(driver, SAMPLE_PROMPT);
        await findVisible(driver, By.css(".worksheet-document"));

        await driver.findElement(By.xpath("//button[normalize-space()='Reset']")).click();

        await findVisible(driver, By.xpath("//h2[normalize-space()='Your worksheet will appear here']"));
        const chatText = await driver.findElement(By.css(".chat-scroll")).getText();
        assert.match(chatText, new RegExp(GREETING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.doesNotMatch(chatText, /Here is a sample worksheet/);
    });

    uiTest("UI3-07 disables Send while the prompt is empty", async function () {
        await openWorksheet(driver);

        const sendButton = await driver.findElement(By.xpath("//button[normalize-space()='Send']"));
        assert.equal(await sendButton.getAttribute("disabled"), "true");

        const textarea = await driver.findElement(By.id("worksheet-prompt"));
        await textarea.sendKeys("Band B open-ended worksheet on punctuation");
        await driver.wait(async () => (await sendButton.getAttribute("disabled")) === null, 5_000);
        assert.equal(await sendButton.getAttribute("disabled"), null);
    });

    uiTest("UI3-08 logs out back to the worksheet login page", async function () {
        await openWorksheet(driver);

        await driver.findElement(By.xpath("//button[normalize-space()='Log out']")).click();
        await driver.wait(until.urlContains("/worksheet/login"), 10_000);
        await findVisible(driver, By.xpath("//h1[normalize-space()='Log in']"));
    });
});
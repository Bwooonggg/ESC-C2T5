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
    testEmail,
    testPassword,
    waitForText,
} from "./support.js";

const loginUrl = `${baseUrl}/worksheet/login`;

const RUN_TIMEOUT_MS = 60_000;

async function login(driver) {
    await driver.get(loginUrl);
    await waitForText(driver, By.css("h1"), "Log in");

    const email = await findVisible(driver, By.css('input[name="email"]'));
    const password = await findVisible(driver, By.css('input[name="password"]'));
    await email.sendKeys(testEmail);
    await password.sendKeys(testPassword);

    await driver.findElement(By.css('button[type="submit"]')).click();
    await findVisible(driver, By.id("worksheet-prompt"), 15_000);
}

async function sendMessage(driver, text) {
    const promptInput = await driver.findElement(By.id("worksheet-prompt"));
    await driver.wait(until.elementIsEnabled(promptInput), RUN_TIMEOUT_MS);
    await promptInput.clear();
    await promptInput.sendKeys(text);

    await driver.findElement(By.css("form.worksheet-composer button")).click();

    await driver.wait(until.elementIsDisabled(promptInput), 5_000).catch(() => {});
    await driver.wait(until.elementIsEnabled(promptInput), RUN_TIMEOUT_MS);
}

describe("DAS 3 Selenium UI (full integration)", function () {
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

    uiTest("UI3-01 displays the Worksheet Builder login interface", async function () {
        await driver.get(loginUrl);

        await waitForText(driver, By.css("h1"), "Log in");
        const pageText = await driver.findElement(By.css("body")).getText();
        assert.match(pageText, /Worksheet Builder/);
        assert.match(pageText, /Teacher access/);

        const email = await findVisible(driver, By.css('input[name="email"]'));
        const password = await findVisible(driver, By.css('input[name="password"]'));
        const submit = await findVisible(driver, By.css('button[type="submit"]'));

        assert.equal(await email.getAttribute("type"), "email");
        assert.equal(await password.getAttribute("type"), "password");
        assert.equal(await email.getAttribute("required"), "true");
        assert.equal(await password.getAttribute("required"), "true");
        assert.equal(await submit.getText(), "Log in");
    });

    uiTest("UI3-02 logs in and shows the worksheet workspace with the greeting", async function () {
        await login(driver);

        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.match(bodyText, /Worksheet Builder/);
        assert.match(bodyText, /Worksheet assistant/);
        assert.match(bodyText, /What topic and band should the worksheet cover/);

        const messages = await driver.findElements(By.css(".chat-scroll .work-message"));
        assert.equal(messages.length, 1);

        const showAnswersBtn = await driver.findElement(
            By.xpath("//button[contains(., 'Show answers')]"),
        );
        assert.equal(await showAnswersBtn.getAttribute("disabled"), "true");
    });

    uiTest(
        "UI3-03 sends a worksheet request through the chatbox and gets a real worksheet back from the backend",
        async function () {
            await login(driver);

            const messagesLocator = By.css(".chat-scroll .work-message");
            const showAnswersBtn = await driver.findElement(
                By.xpath("//button[contains(., 'Show answers')]"),
            );
            const printBtn = await driver.findElement(
                By.xpath("//button[contains(., 'Print / PDF')]"),
            );
            const isWorksheetReady = async () =>
                (await showAnswersBtn.getAttribute("disabled")) === null;

            await sendMessage(
                driver,
                "Create a Band A multiple-choice worksheet on subject-verb agreement.",
            );

            let messages = await driver.findElements(messagesLocator);
            assert.ok(messages.length >= 2, "expected at least a greeting and one reply");

            if (!(await isWorksheetReady())) {
                // get_intent routed to ask_clarification instead of the worksheet
                // agent — answer explicitly and let the graph resume once.
                await sendMessage(
                    driver,
                    "Topic: subject-verb agreement. Band: A. Question type: MCQ.",
                );
                messages = await driver.findElements(messagesLocator);
                assert.ok(messages.length >= 3);
            }


            await driver.wait(until.elementIsEnabled(showAnswersBtn), RUN_TIMEOUT_MS);
            assert.equal(await printBtn.isEnabled(), true);

            const documentEl = await driver.findElement(By.css("article.worksheet-document"));
            const title = await documentEl.findElement(By.css("h1")).getText();
            assert.ok(title.trim().length > 0);

            const questionItems = await documentEl.findElements(By.css("ol > li"));
            assert.ok(questionItems.length > 0, "expected at least one worksheet question");

            await showAnswersBtn.click();
            await driver.wait(until.elementTextContains(showAnswersBtn, "Hide"), RUN_TIMEOUT_MS);
        },
    );

    uiTest("UI3-04 navigates to the login page on logout", async function () {
        await login(driver);

        await driver.findElement(By.xpath("//button[normalize-space()='Log out']")).click();
        await driver.wait(until.urlContains("/worksheet/login"), 5_000);
        await waitForText(driver, By.css("h1"), "Log in");

        assert.equal(new URL(await driver.getCurrentUrl()).pathname, "/worksheet/login");
        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.ok(!bodyText.includes("Worksheet assistant"));
    });
});
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { By, Key, until } from "selenium-webdriver";
import {
    baseUrl,
    createChromeDriver,
    findVisible,
    saveFailureEvidence,
    startPreviewFrontend,
    stopPreviewFrontend,
    waitForText,
    waitForValue,
} from "./support.js";

const dashboardUrl = `${baseUrl}/insights`;
const loginUrl = `${baseUrl}/insights/login`;

async function openDashboard(driver) {
    await driver.get(dashboardUrl);
    await waitForText(driver, By.css("h1"), "Maya Tan");
    await findVisible(driver, By.xpath("//h2[normalize-space()='Progress over time']"));
}

async function openEmailUpdates(driver) {
    await openDashboard(driver);
    const navigation = await findVisible(driver, By.css("nav[aria-label='Main']"));
    await navigation.findElement(By.xpath(".//button[normalize-space()='Email updates']")).click();
    await waitForText(driver, By.css("h1"), "Email updates");
    await findVisible(driver, By.id("notify-email"));
}

describe("DAS 7 Selenium UI", function () {
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

    uiTest("UI7-01 displays the Parent Insight login interface", async function () {
        await driver.get(loginUrl);

        await waitForText(driver, By.css("h1"), "Log in");
        const pageText = await driver.findElement(By.css("body")).getText();
        assert.match(pageText, /Parent Insight/);
        assert.match(pageText, /Parent access/);

        const email = await findVisible(driver, By.css('input[name="email"]'));
        const password = await findVisible(driver, By.css('input[name="password"]'));
        const submit = await findVisible(driver, By.css('button[type="submit"]'));

        assert.equal(await email.getAttribute("type"), "email");
        assert.equal(await password.getAttribute("type"), "password");
        assert.equal(await email.getAttribute("required"), "true");
        assert.equal(await password.getAttribute("required"), "true");
        assert.equal(await submit.getText(), "Log in");
    });

    uiTest("UI7-02 displays the initial progress dashboard", async function () {
        await openDashboard(driver);

        const bodyText = await driver.findElement(By.css("body")).getText();
        for (const expected of [
            "Parent Insight",
            "Progress",
            "Email updates",
            "Signed in as Jamie Tan",
            "Log out",
            "Maya Tan",
            "Band B",
            "LATEST ASSESSMENT",
            "Latest skill scores",
            "Progress over time",
            "Summary",
            "What you can do at home",
        ]) {
            assert.ok(bodyText.includes(expected), `Expected dashboard to contain: ${expected}`);
        }

        const progressButton = await driver.findElement(
            By.xpath("//nav[@aria-label='Main']//button[normalize-space()='Progress']"),
        );
        assert.equal(await progressButton.getAttribute("aria-current"), "page");
        assert.equal(await driver.findElement(By.id("student-select")).getAttribute("value"), "student-maya");
    });

    uiTest("UI7-03 presents Maya's progress information", async function () {
        await openDashboard(driver);

        const tableRows = await driver.findElements(By.css("table tbody tr"));
        assert.equal(tableRows.length, 6);

        const progressCard = await driver.findElement(
            By.xpath("//h2[normalize-space()='Progress over time']/ancestor::div[2]"),
        );
        assert.match(await progressCard.getText(), /3 assessments · scores out of 100/);

        const summaryCard = await driver.findElement(
            By.xpath("//h2[normalize-space()='Summary']/ancestor::section"),
        );
        await driver.wait(async () => !(await summaryCard.getText()).includes("Loading summary"), 10_000);
        const summaryText = await summaryCard.getText();
        assert.match(summaryText, /Maya is reading more accurately/);
        assert.match(summaryText, /12 Jun 2026/);
    });

    uiTest("UI7-04 switches the displayed child", async function () {
        await openDashboard(driver);

        const studentSelect = await driver.findElement(By.id("student-select"));
        await studentSelect.findElement(By.css('option[value="student-ethan"]')).click();
        await findVisible(driver, By.xpath("//p[@aria-busy='true' and contains(., 'Loading progress')]"));
        await waitForText(driver, By.css("h1"), "Ethan Tan");
        const summaryCard = await findVisible(
            driver,
            By.xpath("//h2[normalize-space()='Summary']/ancestor::section"),
        );
        await driver.wait(
            until.elementTextContains(summaryCard, "Ethan is making steady progress"),
            10_000,
        );

        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.match(bodyText, /Ethan Tan/);
        assert.match(bodyText, /Band A/);
        assert.equal(await studentSelect.getAttribute("value"), "student-ethan");
    });

    uiTest("UI7-05 requests and displays home suggestions", async function () {
        await openDashboard(driver);

        const card = await driver.findElement(
            By.xpath("//h2[normalize-space()='What you can do at home']/ancestor::section"),
        );
        assert.match(await card.getText(), /Suggestions are written from the summary/);

        const button = await card.findElement(By.css("button"));
        assert.equal(await button.getText(), "Get suggestions");
        await button.click();
        await driver.wait(until.elementTextIs(button, "Generating…"), 5_000);
        assert.equal(await button.isEnabled(), false);
        await driver.wait(until.elementTextIs(button, "Get suggestions"), 10_000);

        assert.match(await card.getText(), /Try ten minutes of paired reading/);
        assert.equal(await button.isEnabled(), true);
    });

    uiTest("UI7-06 navigates to the initial email-update settings", async function () {
        await openEmailUpdates(driver);

        const emailButton = await driver.findElement(
            By.xpath("//nav[@aria-label='Main']//button[normalize-space()='Email updates']"),
        );
        assert.equal(await emailButton.getAttribute("aria-current"), "page");
        assert.equal(await driver.findElement(By.id("notify-enabled")).isSelected(), true);
        assert.equal(await driver.findElement(By.id("notify-frequency")).getAttribute("value"), "Fortnightly");
        assert.equal(await driver.findElement(By.id("notify-email")).getAttribute("value"), "jamie.tan@example.com");

        const save = await driver.findElement(By.xpath("//button[normalize-space()='Save changes']"));
        const send = await driver.findElement(By.xpath("//button[normalize-space()='Send update now']"));
        assert.equal(await save.isEnabled(), true);
        assert.equal(await send.isEnabled(), true);
    });

    uiTest("UI7-07 toggles email controls and saves changes", async function () {
        await openEmailUpdates(driver);

        const enabled = await driver.findElement(By.id("notify-enabled"));
        const send = await driver.findElement(By.xpath("//button[normalize-space()='Send update now']"));
        await enabled.click();
        assert.equal(await enabled.isSelected(), false);
        assert.equal(await send.isEnabled(), false);

        await enabled.click();
        await driver.findElement(By.css('#notify-frequency option[value="Monthly"]')).click();
        const email = await driver.findElement(By.id("notify-email"));
        await email.sendKeys(Key.chord(Key.CONTROL, "a"), "UI.TEST@EXAMPLE.COM");

        const save = await driver.findElement(By.xpath("//button[normalize-space()='Save changes']"));
        await save.click();
        await driver.wait(until.elementTextIs(save, "Saving…"), 5_000);
        await waitForText(driver, By.xpath("//*[normalize-space()='Saved.']"), "Saved.");
        await waitForValue(driver, email, "ui.test@example.com");

        assert.equal(await enabled.isSelected(), true);
        assert.equal(await driver.findElement(By.id("notify-frequency")).getAttribute("value"), "Monthly");
    });

    uiTest("UI7-08 displays immediate-send feedback", async function () {
        await openEmailUpdates(driver);

        const send = await driver.findElement(By.xpath("//button[normalize-space()='Send update now']"));
        await send.click();
        await driver.wait(until.elementTextIs(send, "Sending…"), 5_000);
        assert.equal(await send.isEnabled(), false);

        const status = await waitForText(
            driver,
            By.css('[role="status"]'),
            "Progress update sent to jamie.tan@example.com.",
        );
        assert.equal(await status.getText(), "Progress update sent to jamie.tan@example.com.");
        await driver.wait(until.elementIsEnabled(send), 5_000);
    });

    uiTest("UI7-09 applies and retains accessibility display settings", async function () {
        await openDashboard(driver);

        const settings = await driver.findElement(By.css('[role="group"][aria-label="Display settings"]'));
        const largeText = await settings.findElement(By.xpath(".//button[contains(., 'Larger text')]"));
        const highContrast = await settings.findElement(By.xpath(".//button[contains(., 'High contrast')]"));
        await largeText.click();
        await highContrast.click();

        assert.equal(await largeText.getAttribute("aria-pressed"), "true");
        assert.equal(await highContrast.getAttribute("aria-pressed"), "true");
        let rootClasses = await driver.findElement(By.css("html")).getAttribute("class");
        assert.match(rootClasses, /dial-large-text/);
        assert.match(rootClasses, /dial-high-contrast/);

        await driver.navigate().refresh();
        await waitForText(driver, By.css("h1"), "Maya Tan");
        const refreshedSettings = await driver.findElement(
            By.css('[role="group"][aria-label="Display settings"]'),
        );
        assert.equal(
            await refreshedSettings.findElement(By.xpath(".//button[contains(., 'Larger text')]")).getAttribute("aria-pressed"),
            "true",
        );
        assert.equal(
            await refreshedSettings.findElement(By.xpath(".//button[contains(., 'High contrast')]")).getAttribute("aria-pressed"),
            "true",
        );
        rootClasses = await driver.findElement(By.css("html")).getAttribute("class");
        assert.match(rootClasses, /dial-large-text/);
        assert.match(rootClasses, /dial-high-contrast/);
    });

    uiTest("UI7-10 navigates to the login page on logout", async function () {
        await openDashboard(driver);

        await driver.findElement(By.xpath("//button[normalize-space()='Log out']")).click();
        await driver.wait(until.urlContains("/insights/login"), 5_000);
        await waitForText(driver, By.css("h1"), "Log in");

        assert.equal(new URL(await driver.getCurrentUrl()).pathname, "/insights/login");
        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.ok(!bodyText.includes("Maya Tan"));
        assert.ok(!bodyText.includes("Progress over time"));
    });
});

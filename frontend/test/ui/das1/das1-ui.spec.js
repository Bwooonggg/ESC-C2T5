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

const screeningUrl = `${baseUrl}/screening`;

async function openScreeningHome(driver) {
    await driver.get(screeningUrl);
    await waitForText(driver, By.css("h1"), "A quiet first step toward understanding.");
}

async function startScreener(driver, label) {
    await openScreeningHome(driver);
    const optionButton = await driver.findElement(
        By.xpath(`//button[.//strong[normalize-space()='${label}']]`),
    );
    await optionButton.click();
    await findVisible(driver, By.css(".screen-shell"));
}

describe("DAS 1 Selenium UI", function () {
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

    uiTest("UI1-01 displays the screener selection home", async function () {
        await openScreeningHome(driver);

        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.match(bodyText, /Choose the screening guide that fits your situation/);
        assert.match(bodyText, /This is a screening tool, not a clinical assessment or diagnosis\./);

        await findVisible(driver, By.xpath("//button[.//strong[normalize-space()='For myself']]"));
        await findVisible(driver, By.xpath("//button[.//strong[normalize-space()='For a child']]"));
    });

    uiTest("UI1-02 starts the adult screener with its questions", async function () {
        await startScreener(driver, "For myself");

        await waitForText(driver, By.css("h1"), "Adult screener");
        await waitForText(
            driver,
            By.css(".messages"),
            "I’ll ask a few questions about your experiences with reading, writing and memory.",
        );

        const questionCard = await driver.findElement(By.xpath("//h2[normalize-space()='Questions']/.."));
        const questionText = await questionCard.getText();
        assert.match(questionText, /Do you often need to reread a passage to understand it\?/);
        assert.match(questionText, /Do spelling or written tasks take longer than you expect\?/);
        assert.match(questionText, /Do you find it difficult to remember sequences or verbal instructions\?/);
    });

    uiTest("UI1-03 starts the child screener with child-specific questions", async function () {
        await startScreener(driver, "For a child");

        await waitForText(driver, By.css("h1"), "Child screener");
        const questionCard = await driver.findElement(By.xpath("//h2[normalize-space()='Questions']/.."));
        const questionText = await questionCard.getText();
        assert.match(questionText, /Does your child find it difficult to match letters with their sounds\?/);
    });

    uiTest("UI1-04 records Yes/No answers to screening questions", async function () {
        await startScreener(driver, "For myself");
        await findVisible(driver, By.xpath("//h2[normalize-space()='Questions']"));

        const firstQuestion = "Do you often need to reread a passage to understand it?";
        const fieldset = await driver.findElement(
            By.xpath(`//legend[normalize-space()='${firstQuestion}']/..`),
        );
        const noOption = await fieldset.findElement(By.xpath(".//label[normalize-space()='No']/input"));
        await noOption.click();
        await driver.wait(until.elementIsSelected(noOption), 5_000);
        assert.equal(await noOption.isSelected(), true);
    });

    uiTest("UI1-05 sends a chat message and receives a guide reply", async function () {
        await startScreener(driver, "For myself");

        const textarea = await findVisible(driver, By.id("screen-message"));
        await textarea.sendKeys("I find it hard to keep my place while reading.");
        await driver.findElement(By.xpath("//button[normalize-space()='Send response']")).click();

        await waitForText(
            driver,
            By.css(".messages"),
            "I find it hard to keep my place while reading.",
        );
        await waitForText(
            driver,
            By.css(".messages"),
            "Thank you. You can add more detail, answer the questions alongside this conversation",
        );
    });

    uiTest("UI1-06 views the non-diagnostic screening summary", async function () {
        await startScreener(driver, "For myself");
        await findVisible(driver, By.xpath("//h2[normalize-space()='Questions']"));

        await driver.findElement(By.xpath("//button[normalize-space()='View screening summary']")).click();

        await findVisible(driver, By.xpath("//h2[normalize-space()='Your results']"));
        const reportSection = await driver.findElement(By.xpath("//h2[normalize-space()='Your results']/.."));
        const reportText = await reportSection.getText();
        assert.match(reportText, /A screening result is not a diagnosis\.|This summary is not a diagnosis\./);
    });

    uiTest("UI1-07 requests a follow-up and submits contact details", async function () {
        await startScreener(driver, "For myself");
        await findVisible(driver, By.xpath("//h2[normalize-space()='Questions']"));
        await driver.findElement(By.xpath("//button[normalize-space()='View screening summary']")).click();
        await findVisible(driver, By.xpath("//h2[normalize-space()='Your results']"));

        await driver.findElement(By.xpath("//button[normalize-space()='Request a follow-up']")).click();
        const contactForm = await findVisible(driver, By.css(".contact-form"));

        await contactForm.findElement(By.xpath(".//label[contains(., 'Name')]/input")).sendKeys("Jamie Tan");
        await contactForm.findElement(By.xpath(".//label[contains(., 'Email')]/input")).sendKeys("jamie.tan@example.com");
        await contactForm.findElement(By.xpath(".//label[contains(., 'Phone')]/input")).sendKeys("+65 8123 4567");
        await contactForm.findElement(By.xpath(".//button[normalize-space()='Submit details']")).click();

        await findVisible(driver, By.xpath("//h2[normalize-space()='Thank you']"));
        const bodyText = await driver.findElement(By.css("body")).getText();
        assert.match(bodyText, /Jamie Tan/);
        assert.match(bodyText, /jamie\.tan@example\.com/);
    });

    uiTest("UI1-08 returns to screener selection from the flow", async function () {
        await startScreener(driver, "For myself");

        await driver.findElement(By.xpath("//button[normalize-space()='← Choose another screener']")).click();
        await waitForText(driver, By.css("h1"), "A quiet first step toward understanding.");
        await findVisible(driver, By.xpath("//button[.//strong[normalize-space()='For myself']]"));
    });
});
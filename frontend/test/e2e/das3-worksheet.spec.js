import { expect, test } from "@playwright/test";

const GREETING = "Hello! What topic and band should the worksheet cover, and would you like MCQ or open-ended questions?";
const SAMPLE_PROMPT = "Band A MCQ worksheet on subject-verb agreement";

async function openWorksheet(page) {
    await page.goto("/worksheet");
    await expect(page.getByText(GREETING)).toBeVisible();
}

async function sendPrompt(page, text) {
    await page.getByLabel("Describe your worksheet").fill(text);
    await page.getByRole("button", { name: "Send" }).click();
}

test.describe("DAS 3 Worksheet Builder", () => {
    test("UI3-01 loads the worksheet workspace with an empty preview", async ({ page }) => {
        await openWorksheet(page);

        await expect(page.getByRole("heading", { name: "Your worksheet will appear here" })).toBeVisible();
        await expect(page.getByRole("button", { name: /answers$/ })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Print / PDF" })).toBeDisabled();
    });

    test("UI3-02 generates a sample worksheet from a prompt", async ({ page }) => {
        await openWorksheet(page);
        await sendPrompt(page, SAMPLE_PROMPT);

        await expect(page.getByRole("heading", { name: `Literacy Practice: ${SAMPLE_PROMPT}` })).toBeVisible();
        await expect(page.getByText("Read each question carefully.")).toBeVisible();
        await expect(page.getByText("Which sentence uses the correct subject–verb agreement?")).toBeVisible();
    });

    test("UI3-03 shows the assistant's confirmation message in chat", async ({ page }) => {
        await openWorksheet(page);
        await sendPrompt(page, SAMPLE_PROMPT);

        await expect(page.getByText("Here is a sample worksheet using preview data.")).toBeVisible();
    });

    test("UI3-04 toggles answers on and off in the preview", async ({ page }) => {
        await openWorksheet(page);
        await sendPrompt(page, SAMPLE_PROMPT);
        await expect(page.locator(".worksheet-document")).toBeVisible();

        const toggle = page.getByRole("button", { name: /answers$/ });
        await expect(toggle).toBeEnabled();

        await toggle.click();
        await expect(page.getByText(/^Answer:/).first()).toBeVisible();
        await expect(toggle).toHaveText("Hide answers");

        await toggle.click();
        await expect(page.getByText(/^Answer:/).first()).not.toBeVisible();
        await expect(toggle).toHaveText("Show answers");
    });

    test("UI3-05 enables Print / PDF once a worksheet exists", async ({ page }) => {
        await openWorksheet(page);
        await sendPrompt(page, SAMPLE_PROMPT);
        await expect(page.locator(".worksheet-document")).toBeVisible();

        await expect(page.getByRole("button", { name: "Print / PDF" })).toBeEnabled();
    });

    test("UI3-06 resets the workspace back to the greeting", async ({ page }) => {
        await openWorksheet(page);
        await sendPrompt(page, SAMPLE_PROMPT);
        await expect(page.locator(".worksheet-document")).toBeVisible();

        await page.getByRole("button", { name: "Reset" }).click();

        await expect(page.getByRole("heading", { name: "Your worksheet will appear here" })).toBeVisible();
        await expect(page.getByText(GREETING)).toBeVisible();
        await expect(page.getByText("Here is a sample worksheet")).not.toBeVisible();
    });

    test("UI3-07 disables Send while the prompt is empty", async ({ page }) => {
        await openWorksheet(page);

        const sendButton = page.getByRole("button", { name: "Send" });
        await expect(sendButton).toBeDisabled();

        await page.getByLabel("Describe your worksheet").fill("Band B open-ended worksheet on punctuation");
        await expect(sendButton).toBeEnabled();
    });

    test("UI3-08 logs out back to the worksheet login page", async ({ page }) => {
        await openWorksheet(page);

        await page.getByRole("button", { name: "Log out" }).click();

        await expect(page).toHaveURL(/\/worksheet\/login$/);
        await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    });
});
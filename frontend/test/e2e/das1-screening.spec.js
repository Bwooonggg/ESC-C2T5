import { expect, test } from "@playwright/test";

async function startScreener(page, label) {
    await page.goto("/screening");
    await expect(page.getByRole("heading", { name: "A quiet first step toward understanding." })).toBeVisible();
    await page.getByRole("button", { name: label }).click();
}

test.describe("DAS 1 Screening", () => {
    test("UI1-01 displays the screener selection home", async ({ page }) => {
        await page.goto("/screening");

        await expect(page.getByText("Choose the screening guide that fits your situation")).toBeVisible();
        await expect(page.getByText("This is a screening tool, not a clinical assessment or diagnosis.")).toBeVisible();
        await expect(page.getByRole("button", { name: /For myself/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /For a child/ })).toBeVisible();
    });

    test("UI1-02 starts the adult screener with its questions", async ({ page }) => {
        await startScreener(page, /For myself/);

        await expect(page.getByRole("heading", { name: "Adult screener" })).toBeVisible();
        await expect(page.getByText("I’ll ask a few questions about your experiences with reading, writing and memory.")).toBeVisible();
        await expect(page.getByText("Do you often need to reread a passage to understand it?")).toBeVisible();
        await expect(page.getByText("Do spelling or written tasks take longer than you expect?")).toBeVisible();
        await expect(page.getByText("Do you find it difficult to remember sequences or verbal instructions?")).toBeVisible();
    });

    test("UI1-03 starts the child screener with child-specific questions", async ({ page }) => {
        await startScreener(page, /For a child/);

        await expect(page.getByRole("heading", { name: "Child screener" })).toBeVisible();
        await expect(page.getByText("Does your child find it difficult to match letters with their sounds?")).toBeVisible();
    });

    test("UI1-04 records Yes/No answers to screening questions", async ({ page }) => {
        await startScreener(page, /For myself/);
        const firstQuestion = "Do you often need to reread a passage to understand it?";
        const fieldset = page.locator("fieldset", { has: page.locator("legend", { hasText: firstQuestion }) });

        await fieldset.getByLabel("No").click();
        await expect(fieldset.getByLabel("No")).toBeChecked();
    });

    test("UI1-05 sends a chat message and receives a guide reply", async ({ page }) => {
        await startScreener(page, /For myself/);

        await page.getByLabel("Your response").fill("I find it hard to keep my place while reading.");
        await page.getByRole("button", { name: "Send response" }).click();

        await expect(page.getByText("I find it hard to keep my place while reading.")).toBeVisible();
        await expect(page.getByText(/Thank you\. You can add more detail/)).toBeVisible();
    });

    test("UI1-06 views the non-diagnostic screening summary", async ({ page }) => {
        await startScreener(page, /For myself/);

        await page.getByRole("button", { name: "View screening summary" }).click();

        await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();
        await expect(page.getByText(/A screening result is not a diagnosis\.|This summary is not a diagnosis\./)).toBeVisible();
    });

    test("UI1-07 requests a follow-up and submits contact details", async ({ page }) => {
        await startScreener(page, /For myself/);
        await page.getByRole("button", { name: "View screening summary" }).click();
        await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();

        await page.getByRole("button", { name: "Request a follow-up" }).click();
        await page.getByLabel("Name").fill("Jamie Tan");
        await page.getByLabel("Email").fill("jamie.tan@example.com");
        await page.getByLabel("Phone").fill("+65 8123 4567");
        await page.getByRole("button", { name: "Submit details" }).click();

        await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
        await expect(page.getByText(/Jamie Tan/)).toBeVisible();
        await expect(page.getByText(/jamie\.tan@example\.com/)).toBeVisible();
    });

    test("UI1-08 returns to screener selection from the flow", async ({ page }) => {
        await startScreener(page, /For myself/);

        await page.getByRole("button", { name: "← Choose another screener" }).click();

        await expect(page.getByRole("heading", { name: "A quiet first step toward understanding." })).toBeVisible();
        await expect(page.getByRole("button", { name: /For myself/ })).toBeVisible();
    });
});
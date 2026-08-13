import { expect, test } from "@playwright/test";

async function openDashboard(page) {
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: "Maya Tan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Progress over time" })).toBeVisible();
}

async function openEmailUpdates(page) {
    await openDashboard(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Email updates" }).click();
    await expect(page.getByRole("heading", { name: "Email updates" })).toBeVisible();
    await expect(page.locator("#notify-email")).toBeVisible();
}

test.describe("DAS 7 Insights", () => {
    test("UI7-01 displays the Parent Insight login interface", async ({ page }) => {
        await page.goto("/insights/login");

        await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
        await expect(page.getByText("Parent Insight")).toBeVisible();
        await expect(page.getByText("Parent access")).toBeVisible();

        const email = page.locator('input[name="email"]');
        const password = page.locator('input[name="password"]');
        await expect(email).toHaveAttribute("type", "email");
        await expect(password).toHaveAttribute("type", "password");
        await expect(email).toHaveAttribute("required", "");
        await expect(password).toHaveAttribute("required", "");
        await expect(page.locator('button[type="submit"]')).toHaveText("Log in");
    });

    test("UI7-02 displays the initial progress dashboard", async ({ page }) => {
        await openDashboard(page);

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
            await expect(page.getByText(expected).first()).toBeVisible();
        }

        await expect(
            page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Progress" }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.locator("#student-select")).toHaveValue("student-maya");
    });

    test("UI7-03 presents Maya's progress information", async ({ page }) => {
        await openDashboard(page);

        await expect(page.locator("table tbody tr")).toHaveCount(6);

        const progressHeading = page.getByRole("heading", { name: "Progress over time" });
        const progressCard = progressHeading.locator("xpath=ancestor::div[2]");
        await expect(progressCard.getByText(/3 assessments · scores out of 100/)).toBeVisible();

        const summaryCard = page.getByRole("heading", { name: "Summary" }).locator("xpath=ancestor::section");
        await expect(summaryCard.getByText("Loading summary")).not.toBeVisible();
        await expect(summaryCard.getByText(/Maya is reading more accurately/)).toBeVisible();
        await expect(summaryCard.getByText(/12 Jun 2026/)).toBeVisible();
    });

    test("UI7-04 switches the displayed child", async ({ page }) => {
        await openDashboard(page);

        await page.locator("#student-select").selectOption("student-ethan");
        await expect(page.getByRole("heading", { name: "Ethan Tan" })).toBeVisible();
        const summaryCard = page.getByRole("heading", { name: "Summary" }).locator("xpath=ancestor::section");
        await expect(summaryCard.getByText(/Ethan is making steady progress/)).toBeVisible();

        await expect(page.locator("p", { hasText: "Band A" })).toBeVisible();
        await expect(page.locator("#student-select")).toHaveValue("student-ethan");
    });

    test("UI7-05 requests and displays home suggestions", async ({ page }) => {
        await openDashboard(page);

        const card = page.getByRole("heading", { name: "What you can do at home" }).locator("xpath=ancestor::section");
        await expect(card.getByText(/Suggestions are written from the summary/)).toBeVisible();

        const button = card.getByRole("button", { name: /Get suggestions|Generating…/ });
        await button.click();
        await expect(button).toHaveText("Generating…");
        await expect(button).toBeDisabled();
        await expect(button).toHaveText("Get suggestions", { timeout: 10_000 });

        await expect(card.getByText(/Try ten minutes of paired reading/)).toBeVisible();
        await expect(button).toBeEnabled();
    });

    test("UI7-06 navigates to the initial email-update settings", async ({ page }) => {
        await openEmailUpdates(page);

        await expect(
            page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Email updates" }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.locator("#notify-enabled")).toBeChecked();
        await expect(page.locator("#notify-frequency")).toHaveValue("Fortnightly");
        await expect(page.locator("#notify-email")).toHaveValue("jamie.tan@example.com");

        await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Send update now" })).toBeEnabled();
    });

    test("UI7-07 toggles email controls and saves changes", async ({ page }) => {
        await openEmailUpdates(page);

        const enabled = page.locator("#notify-enabled");
        const send = page.getByRole("button", { name: /Send update now|Sending…/ });
        await enabled.click();
        await expect(enabled).not.toBeChecked();
        await expect(send).toBeDisabled();

        await enabled.click();
        await page.locator("#notify-frequency").selectOption("Monthly");
        const emailInput = page.locator("#notify-email");
        await emailInput.fill("UI.TEST@EXAMPLE.COM");

        const save = page.getByRole("button", { name: /Save changes|Saving…/ });
        await save.click();
        await expect(save).toHaveText("Saving…");
        await expect(page.getByText("Saved.")).toBeVisible();
        await expect(emailInput).toHaveValue("ui.test@example.com");

        await expect(enabled).toBeChecked();
        await expect(page.locator("#notify-frequency")).toHaveValue("Monthly");
    });

    test("UI7-08 displays immediate-send feedback", async ({ page }) => {
        await openEmailUpdates(page);

        const send = page.getByRole("button", { name: /Send update now|Sending…/ });
        await send.click();
        await expect(send).toHaveText("Sending…");
        await expect(send).toBeDisabled();

        const status = page.getByRole("status");
        await expect(status).toHaveText("Progress update sent to jamie.tan@example.com.");
        await expect(send).toBeEnabled();
    });

    test("UI7-09 applies and retains accessibility display settings", async ({ page }) => {
        await openDashboard(page);

        const settings = page.getByRole("group", { name: "Display settings" });
        const largeText = settings.getByRole("button", { name: /Larger text/ });
        const highContrast = settings.getByRole("button", { name: /High contrast/ });
        await largeText.click();
        await highContrast.click();

        await expect(largeText).toHaveAttribute("aria-pressed", "true");
        await expect(highContrast).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("html")).toHaveClass(/dial-large-text/);
        await expect(page.locator("html")).toHaveClass(/dial-high-contrast/);

        await page.reload();
        await expect(page.getByRole("heading", { name: "Maya Tan" })).toBeVisible();

        const refreshedSettings = page.getByRole("group", { name: "Display settings" });
        await expect(refreshedSettings.getByRole("button", { name: /Larger text/ })).toHaveAttribute("aria-pressed", "true");
        await expect(refreshedSettings.getByRole("button", { name: /High contrast/ })).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("html")).toHaveClass(/dial-large-text/);
        await expect(page.locator("html")).toHaveClass(/dial-high-contrast/);
    });

    test("UI7-10 navigates to the login page on logout", async ({ page }) => {
        await openDashboard(page);

        await page.getByRole("button", { name: "Log out" }).click();

        await expect(page).toHaveURL(/\/insights\/login$/);
        await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
        await expect(page.getByText("Maya Tan")).not.toBeVisible();
        await expect(page.getByText("Progress over time")).not.toBeVisible();
    });
});
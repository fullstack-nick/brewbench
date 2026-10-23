import { test as setup, expect } from "@playwright/test";
import { readFile, mkdir, access, writeFile } from "node:fs/promises";
setup(
  "authenticate the password-protected development storefront",
  async ({ browser, baseURL }) => {
    await mkdir(".local/playwright", { recursive: true });
    const path = ".local/playwright/auth.json";
    // Authenticate once per run in a genuinely new session. Reusing a prior QA
    // session can carry its affirmative consent in Shopify's essential cookie.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname === "/password") {
      const password = (
        await readFile(
          process.env.SHOPIFY_PASSWORD_FILE ||
            ".local/preflight/storefront-password.txt",
          "utf8",
        )
      ).trim();
      if (!password) throw new Error("Storefront password file is empty");
      const input = page.locator("input[name=password]");
      if (!(await input.isVisible()))
        await page.getByText("Enter using password", { exact: true }).click();
      await input.fill(password);
      await input.press("Enter");
      await expect(page).not.toHaveURL(/\/password/);
    }
    await expect(page.locator("#MainContent")).toBeVisible();
    const state = await context.storageState();
    // Every test gets its own anonymous cart. Preserve storefront authentication only.
    state.cookies = state.cookies.filter((c) => !c.name.startsWith("cart"));
    state.origins = [];
    await writeFile(path, JSON.stringify(state));
    await context.close();
  },
);

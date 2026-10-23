import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
let theme = process.env.SHOPIFY_THEME_ID;
if (!theme) {
  const ledger = JSON.parse(
    await readFile(".local/preflight/resource-ledger.json", "utf8"),
  );
  theme = ledger.themes.preflightUnpublished;
}
export async function open(page, path = "/") {
  const url = new URL(path, "https://brewbench-practice.myshopify.com");
  url.searchParams.set("preview_theme_id", theme);
  url.searchParams.set("pb", "0");
  await page.goto(url.pathname + url.search, { waitUntil: "domcontentloaded" });
  await page.locator("#MainContent").waitFor();
  await page.waitForFunction(() => !!window.BrewbenchQA);
}
export async function freshVisitor(page) {
  // Shopify can remember consent server-side for a restored authenticated session.
  // A consent journey therefore logs in as a genuinely new anonymous visitor.
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname !== "/password")
    throw new Error("Expected a fresh password-protected session");
  const input = page.locator("input[name=password]");
  if (!(await input.isVisible()))
    await page.getByText("Enter using password", { exact: true }).click();
  const password = (
    await readFile(
      process.env.SHOPIFY_PASSWORD_FILE ||
        ".local/preflight/storefront-password.txt",
      "utf8",
    )
  ).trim();
  await input.fill(password);
  await input.press("Enter");
  await expect(page).not.toHaveURL(/\/password/);
}
export const cart = (page) =>
  page.evaluate(async () => {
    const r = await fetch(`${Shopify.routes.root}cart.js`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Cart read HTTP ${r.status}`);
    return r.json();
  });
export async function clearCart(page) {
  if (page.url() === "about:blank") await open(page);
  await page.evaluate(async () => {
    const r = await fetch(`${Shopify.routes.root}cart/clear.js`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Cart clear HTTP ${r.status}`);
  });
}
export async function chooseLarge(page) {
  await page
    .locator("variant-selects label")
    .filter({ hasText: "02 · 500 ml" })
    .click();
  await page
    .locator("[id^=BrewbenchSpecs]")
    .getByText("BB-CONE-02-CHALK", { exact: true })
    .waitFor();
}
export async function privacy(page, action) {
  await expect
    .poll(() => page.evaluate(() => window.BrewbenchQA.status().privacyReady))
    .toBe(true);
  if (!(await page.locator("[data-bb-consent]").isVisible()))
    await page.locator("[data-bb-privacy-open]").click();
  await page.locator(`[data-consent=${action}]`).click();
  await expect(page.locator("[data-bb-consent]")).toBeHidden();
}

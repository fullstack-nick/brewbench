import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const phase = process.argv[2];
if (!["release", "rollback"].includes(phase))
  throw new Error("Use release or rollback");
const expected = process.env.SHOPIFY_EXPECTED_THEME_ID;
if (!expected)
  throw new Error("Set the expected live theme ID from the private ledger.");
const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const base = "https://brewbench-practice.myshopify.com";
const result = { at: new Date().toISOString(), phase, liveThemeMatched: false };
try {
  await page.goto(base + "/?pb=0", { waitUntil: "domcontentloaded" });
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
  // A preview session can remain pinned to its theme through Shopify's
  // essential cookie. Authenticate a fresh visitor without any preview URL.
  await expect
    .poll(
      async () => {
        await page.goto(base + "/?pb=0", { waitUntil: "domcontentloaded" });
        return String(await page.evaluate(() => Shopify.theme.id));
      },
      { timeout: 30000, intervals: [1000, 3000, 5000] },
    )
    .toBe(String(expected));
  result.liveThemeMatched = true;
  if (phase === "release") {
    await expect(page.locator(".bb-hero h1")).toContainText("Good coffee");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".bb-hero img")).toBeVisible();
    await page.screenshot({ path: "docs/evidence/storefront-home.png" });
    result.routes = [];
    for (const path of [
      "/collections/brewers",
      "/products/cone-brewer",
      "/de/products/cone-brewer",
      "/pages/buying-guide",
      "/pages/delivery",
      "/pages/faq",
      "/cart",
      "/search?q=brewer",
      "/a-page-that-does-not-exist",
    ]) {
      const response = await page.goto(base + path, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("#MainContent")).toBeVisible();
      const expectedStatus = path === "/a-page-that-does-not-exist" ? 404 : 200;
      expect(response.status()).toBe(expectedStatus);
      result.routes.push({
        path,
        status: response.status(),
        heading: await page.locator("h1").first().innerText(),
      });
      if (path === "/products/cone-brewer") {
        const seo = await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector("meta[name=description]")
            ?.content,
          canonical: new URL(document.querySelector("link[rel=canonical]").href)
            .pathname,
          alternates: [
            ...document.querySelectorAll("link[rel=alternate][hreflang]"),
          ].map((x) => ({
            language: x.hreflang,
            path: new URL(x.href).pathname,
          })),
          structuredData: [
            ...document.querySelectorAll('script[type="application/ld+json"]'),
          ].map((x) => JSON.parse(x.textContent)),
        }));
        expect(seo.canonical).toBe("/products/cone-brewer");
        expect(seo.description.length).toBeGreaterThan(20);
        const productGroup = seo.structuredData.find(
          (x) => x["@type"] === "ProductGroup",
        );
        expect(productGroup?.name).toBe("Cone Brewer");
        const structuredVariants = productGroup.hasVariant.map((variant) => ({
          type: variant["@type"],
          sku: variant.sku,
          currency: variant.offers.priceCurrency,
          price: variant.offers.price,
        }));
        expect(structuredVariants).toEqual([
          {
            type: "Product",
            sku: "BB-CONE-01-CHALK",
            currency: "EUR",
            price: "32.00",
          },
          {
            type: "Product",
            sku: "BB-CONE-01-OLIVE",
            currency: "EUR",
            price: "32.00",
          },
          {
            type: "Product",
            sku: "BB-CONE-02-CHALK",
            currency: "EUR",
            price: "38.00",
          },
        ]);
        result.seo = {
          title: seo.title,
          descriptionPresent: true,
          canonical: seo.canonical,
          alternates: seo.alternates,
          productStructuredData: true,
          structuredDataType: productGroup["@type"],
          variants: structuredVariants,
        };
      }
    }
  }
  await mkdir(".local/release", { recursive: true });
  await writeFile(
    `.local/release/${phase}-smoke.json`,
    JSON.stringify(result, null, 2),
  );
  await writeFile(
    `docs/evidence/${phase}-smoke.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(`${phase} live-theme smoke passed.`);
} finally {
  await context.close();
  await browser.close();
}

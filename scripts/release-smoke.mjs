import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const phase = process.argv[2];
if (!["release", "rollback"].includes(phase))
  throw new Error("Use release or rollback");
const expected = process.env.SHOPIFY_EXPECTED_THEME_ID;
if (!expected)
  throw new Error("Set the expected live theme ID from the private ledger.");
const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: ".local/playwright/auth.json",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const base = "https://brewbench-practice.myshopify.com";
const result = { at: new Date().toISOString(), phase, liveThemeMatched: false };
try {
  await page.goto(base + "/?pb=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#MainContent")).toBeVisible();
  expect(String(await page.evaluate(() => Shopify.theme.id))).toBe(
    String(expected),
  );
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
        expect(seo.structuredData.some((x) => x["@type"] === "Product")).toBe(
          true,
        );
        result.seo = {
          title: seo.title,
          descriptionPresent: true,
          canonical: seo.canonical,
          alternates: seo.alternates,
          productStructuredData: true,
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

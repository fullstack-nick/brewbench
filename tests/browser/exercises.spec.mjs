import { test, expect } from "@playwright/test";
import { open, cart, clearCart, chooseLarge, privacy } from "./helpers.mjs";
import { graphql, save } from "../../scripts/store/client.mjs";
import { readFile } from "node:fs/promises";
import { deduplicate } from "../../theme/assets/bb-core.js";

test("controlled wrong-variant and duplicate-tracking incidents, shared-content edit and restoration", async ({
  page,
}) => {
  test.setTimeout(180000);
  const report = {
    at: new Date().toISOString(),
    faults:
      "Intentional QA-only injection; no defective production theme is deployed.",
  };
  await open(page, "/products/cone-brewer?bb_group=treatment");
  await privacy(page, "accept");
  const small = await page
    .locator("product-form input[name=id]")
    .first()
    .inputValue();
  await chooseLarge(page);
  // Intentional local theme defect: stale hidden variant ID after selecting size 02.
  await page
    .locator("product-form input[name=id]")
    .first()
    .evaluate((el, id) => (el.value = id), small);
  await page.locator("product-form button[type=submit]").first().click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  const wrong = await cart(page);
  expect(wrong.items[0].sku).toBe("BB-CONE-01-CHALK");
  await page.screenshot({ path: "docs/evidence/incident-variant-before.png" });
  report.variantBefore = {
    selected: "02 · 500 ml",
    addedSKU: wrong.items[0].sku,
    expectedSKU: "BB-CONE-02-CHALK",
  };
  await page
    .locator("cart-drawer")
    .getByRole("button", { name: /Remove Cone Brewer/ })
    .click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(0);
  await page.keyboard.press("Escape");
  // Reload restores the shipped exact-selection implementation.
  await open(page, "/products/cone-brewer?bb_group=treatment");
  await chooseLarge(page);
  await page.locator("product-form button[type=submit]").first().click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  const fixed = await cart(page);
  expect(fixed.items[0].sku).toBe("BB-CONE-02-CHALK");
  await page.screenshot({ path: "docs/evidence/incident-variant-after.png" });
  report.variantAfter = {
    selected: "02 · 500 ml",
    addedSKU: fixed.items[0].sku,
    passed: true,
  };
  const events = await page.evaluate(() => window.BrewbenchQA.exportEvents());
  const added = events.findLast((e) => e.name === "add_to_cart");
  expect(added).toBeTruthy();
  // Deliberate duplicate fixture, using an observed event shape without publishing identifiers.
  const broken = [added, structuredClone(added)];
  const repaired = deduplicate(broken);
  expect(broken).toHaveLength(2);
  expect(repaired).toHaveLength(1);
  report.tracking = {
    source: "Observed event copied into an intentionally broken local fixture",
    beforeCount: 2,
    afterCount: 1,
    oneCartAddition: true,
  };
  report.observedEventCounts = Object.fromEntries(
    [...new Set(events.map((e) => e.name))].map((name) => [
      name,
      events.filter((e) => e.name === name).length,
    ]),
  );
  await page.keyboard.press("Escape");
  const guide = JSON.parse(
    await readFile("data/content/guides.json", "utf8"),
  )[0];
  const title = "A calmer way to pour. One shared update.";
  try {
    await graphql(
      "meta-upsert",
      {
        handle: { type: "brewbench_brewing_guide", handle: guide.handle },
        metaobject: { fields: [{ key: "title", value: title }] },
      },
      { idempotent: true },
    );
    for (const handle of ["cone-brewer", "flatbed-brewer"]) {
      await open(page, `/products/${handle}`);
      await expect
        .poll(
          async () => {
            await page.reload({ waitUntil: "domcontentloaded" });
            return page.locator(".bb-guide h2").innerText();
          },
          { timeout: 45000, intervals: [1000, 2000, 5000] },
        )
        .toBe(title);
      await page.locator(".bb-guide").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/evidence/shared-guide-${handle}.png`,
      });
    }
    report.sharedGuide = {
      oneAPIEdit: true,
      renderedOn: ["cone-brewer", "flatbed-brewer"],
    };
  } finally {
    await graphql(
      "meta-upsert",
      {
        handle: { type: "brewbench_brewing_guide", handle: guide.handle },
        metaobject: { fields: [{ key: "title", value: guide.title.en }] },
      },
      { idempotent: true },
    );
  }
  for (const handle of ["cone-brewer", "flatbed-brewer"]) {
    await open(page, `/products/${handle}`);
    await expect
      .poll(
        async () => {
          await page.reload({ waitUntil: "domcontentloaded" });
          return page.locator(".bb-guide h2").innerText();
        },
        { timeout: 45000, intervals: [1000, 2000, 5000] },
      )
      .toBe(guide.title.en);
  }
  report.sharedGuide.restored = true;
  await save("docs/evidence/exercises.json", report);
});

test("market exclusion reconciles the cart and narrow keyboard layout works", async ({
  page,
}) => {
  await open(page, "/");
  if (
    !(
      await page.locator("#HeaderCountryForm .disclosure__button").innerText()
    ).includes("Austria")
  ) {
    await page.locator("#HeaderCountryForm .disclosure__button").click();
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.getByRole("link", { name: "Austria", exact: true }).click(),
    ]);
  }
  await expect(
    page.locator("#HeaderCountryForm .disclosure__button"),
  ).toContainText("Austria");
  await open(page, "/products/thermal-carafe");
  await page.locator("product-form button[type=submit]").first().click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  await page
    .locator("cart-drawer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.locator("#HeaderCountryForm .disclosure__button").click();
  await page.getByRole("link", { name: "United Kingdom", exact: true }).click();
  // Shopify retains this excluded line; the theme must explain it and offer removal.
  await expect(page.locator("[data-bb-market-notice]")).toContainText(
    /unavailable for the selected country/,
  );
  expect((await cart(page)).item_count).toBe(1);
  await page.getByRole("link", { name: "Review cart", exact: true }).click();
  await expect(page.locator("[data-bb-market-notice]")).toContainText(
    "Thermal Carafe",
  );
  await page.screenshot({ path: "docs/evidence/uk-catalog-exclusion.png" });
  await page.locator("cart-remove-button").getByRole("link").click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(0);
  await open(page, "/products/cone-brewer");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await page
    .getByRole("link", { name: "Skip to content", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#MainContent")).toBeFocused();
  await page.locator("product-form button[type=submit]").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  await page.keyboard.press("Escape");
  await expect(page.locator("cart-drawer")).not.toHaveClass(/active/);
  await expect(
    page.locator("product-form button[type=submit]").first(),
  ).toBeFocused();
  await page.screenshot({ path: "docs/evidence/narrow-keyboard.png" });
});

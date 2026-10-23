import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  open,
  cart,
  clearCart,
  chooseLarge,
  privacy,
  freshVisitor,
} from "./helpers.mjs";

// Playwright creates a fresh context per test; auth setup deliberately omits cart cookies.
test("exact variant, compatibility, drawer quantity, removal and focus", async ({
  page,
}) => {
  await open(page, "/products/cone-brewer");
  await chooseLarge(page);
  await expect(page.locator("bb-compatibility")).toContainText(
    "Cone Paper Filters 02",
  );
  await expect(page.locator("bb-compatibility")).not.toContainText(
    "Cone Paper Filters 01",
  );
  await expect(
    page.getByRole("button", {
      name: "Add Reusable Cone Filter to cart",
      exact: true,
    }),
  ).toHaveCount(0);
  const add = page.locator("product-form button[type=submit]").first();
  await add.click();
  const drawer = page.locator("cart-drawer");
  await expect(drawer).toHaveClass(/active/);
  expect((await cart(page)).items[0].sku).toBe("BB-CONE-02-CHALK");
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(drawer).not.toHaveClass(/active/);
  await page
    .getByRole("button", {
      name: "Add Cone Paper Filters 02 to cart",
      exact: true,
    })
    .click();
  await expect(drawer).toHaveClass(/active/);
  await expect.poll(async () => (await cart(page)).item_count).toBe(2);
  expect((await cart(page)).items.map((i) => i.sku).sort()).toEqual(
    ["BB-17-STD", "BB-CONE-02-CHALK"].sort(),
  );
  await drawer
    .getByRole("button", {
      name: "Increase quantity for Cone Paper Filters 02",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await cart(page)).items.find((i) => i.sku === "BB-17-STD")?.quantity,
    )
    .toBe(2);
  await drawer
    .getByRole("button", { name: /Remove Cone Paper Filters 02/ })
    .click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(1);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toHaveClass(/active/);
});
test("rapid selection never renders a stale or unavailable variant", async ({
  page,
}) => {
  await open(page, "/products/cone-brewer");
  await page.route("**/products/cone-brewer?*", async (route) => {
    if (route.request().url().includes("option_values="))
      await new Promise((r) => setTimeout(r, 250));
    await route.continue();
  });
  const labels = page.locator("variant-selects label");
  await labels.filter({ hasText: "02 · 500 ml" }).click();
  await labels.filter({ hasText: "01 · 250 ml" }).click();
  await labels.filter({ hasText: "02 · 500 ml" }).click();
  await expect(page.locator("[id^=BrewbenchSpecs]")).toContainText(
    "BB-CONE-02-CHALK",
  );
  await page
    .locator("variant-selects label")
    .filter({ hasText: /Olive/ })
    .click();
  await expect(
    page.locator("product-form button[type=submit]").first(),
  ).toBeDisabled();
  await expect(page.locator("[id^=BrewbenchCompatibility]")).not.toContainText(
    "Cone Paper Filters 01",
  );
  expect((await cart(page)).item_count).toBe(0);
});
test("stock errors are announced and recover without false additions", async ({
  page,
}) => {
  await open(page, "/products/cone-brewer");
  const qty = page.locator("product-info input[name=quantity]").first();
  // Deliberately bypass only the HTML limit to exercise Shopify's real stock rejection.
  await qty.evaluate((input) => input.removeAttribute("max"));
  await qty.fill("9999");
  await page.locator("product-form button[type=submit]").first().click();
  await expect(
    page.locator("product-form .product-form__error-message"),
  ).not.toBeEmpty();
  // Shopify adds the available stock while returning 422. The UI must reconcile it.
  const actual = (await cart(page)).item_count;
  expect(actual).toBeGreaterThan(0);
  expect(actual).toBeLessThan(9999);
  await expect(page.locator("#cart-icon-bubble")).toContainText(String(actual));
  expect(
    await page.evaluate(() =>
      window.BrewbenchQA.exportEvents().filter((e) => e.name === "add_to_cart"),
    ),
  ).toHaveLength(0);
  await page.locator("#cart-icon-bubble").click();
  await page
    .locator("cart-drawer")
    .getByRole("button", { name: /Remove Cone Brewer/ })
    .click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(0);
  await page.keyboard.press("Escape");
  await qty.fill("1");
  await page.locator("product-form button[type=submit]").first().click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(1);
});
test("consent is affirmative, QA exposure is deduplicated, withdrawal purges data", async ({
  page,
}) => {
  await freshVisitor(page);
  await open(page, "/products/cone-brewer?bb_group=treatment");
  await expect
    .poll(() => page.evaluate(() => window.BrewbenchQA.status().privacyReady))
    .toBe(true);
  expect(
    await page.evaluate(
      () => Shopify.customerPrivacy.currentVisitorConsent().analytics,
    ),
  ).toBe("");
  expect(
    await page.evaluate(() => localStorage.getItem("bb:experiment")),
  ).toBeNull();
  await privacy(page, "reject");
  expect(await page.evaluate(() => window.BrewbenchQA.exportEvents())).toEqual(
    [],
  );
  await privacy(page, "accept");
  await expect
    .poll(() => page.evaluate(() => window.BrewbenchQA.status().analytics))
    .toBe(true);
  await page.locator(".product-form__buttons").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.BrewbenchQA.exportEvents().filter(
            (e) => e.name === "experiment_exposure",
          ).length,
      ),
    )
    .toBe(1);
  expect(await page.evaluate(() => window.BrewbenchQA.status().group)).toBe(
    "treatment",
  );
  expect(
    await page.evaluate(() =>
      window.BrewbenchQA.exportEvents().every((e) => e.test_traffic),
    ),
  ).toBe(true);
  await page.reload();
  await page.locator(".product-form__buttons").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () =>
        window.BrewbenchQA.exportEvents().filter(
          (e) => e.name === "experiment_exposure",
        ).length,
    ),
  ).toBe(1);
  await privacy(page, "withdraw");
  expect(
    await page.evaluate(() => localStorage.getItem("bb:experiment")),
  ).toBeNull();
  expect(await page.evaluate(() => window.BrewbenchQA.exportEvents())).toEqual(
    [],
  );
});
test("storage failure leaves shopping usable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("Intentional QA storage failure");
    };
  });
  await open(page, "/products/cone-brewer");
  await privacy(page, "accept");
  expect(await page.evaluate(() => window.BrewbenchQA.status().analytics)).toBe(
    false,
  );
  await page.locator("product-form button[type=submit]").first().click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(1);
});
test("privacy API load failure leaves shopping usable without tracking", async ({
  page,
}) => {
  await page.route("**/consent-tracking-api/**", (route) =>
    route.abort("failed"),
  );
  await open(page, "/products/cone-brewer");
  await expect(page.locator("[data-consent-status]")).not.toBeEmpty({
    timeout: 12000,
  });
  expect(await page.evaluate(() => window.BrewbenchQA.status().analytics)).toBe(
    false,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("bb:experiment")),
  ).toBeNull();
  await page.locator("product-form button[type=submit]").first().click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(1);
});
test("discovery supports pagination, sorting, zero results and long German content", async ({
  page,
}) => {
  await open(page, "/collections/all");
  await expect(page.locator("#product-grid .grid__item")).toHaveCount(8);
  const next = page.locator(".pagination__item--prev");
  if (await next.count()) {
    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await page.goBack();
    await expect(page).not.toHaveURL(/page=2/);
  }
  await open(page, "/collections/all?sort_by=price-descending");
  await expect(page.locator("#product-grid")).toContainText(
    "Precision Hand Grinder",
  );
  await open(page, "/search?q=unfindable-brewbench-zz&type=product");
  await expect(page.locator("#MainContent")).toContainText(
    /No results|No products/i,
  );
  await open(page, "/de/products/travel-brewer");
  await expect(page.locator("h1")).toContainText("Reise");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("product controls pass automated accessibility and reduced-motion drawer checks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/products/cone-brewer");
  const result = await new AxeBuilder({ page })
    .include("#MainContent")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.locator("product-form button[type=submit]").first().click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  await page.keyboard.press("Escape");
  await expect(page.locator("cart-drawer")).not.toHaveClass(/active/);
});

test("German quick-add uses the locale cart endpoint and exact filter", async ({
  page,
}) => {
  await open(page, "/de/products/cone-brewer");
  await chooseLarge(page);
  await page
    .getByRole("button", {
      name: "Kegel-Papierfilter 02 zum Warenkorb hinzufügen",
      exact: true,
    })
    .click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  const actual = await cart(page);
  expect(actual.items).toHaveLength(1);
  expect(actual.items[0].sku).toBe("BB-17-STD");
  expect(actual.currency).toBe("EUR");
});

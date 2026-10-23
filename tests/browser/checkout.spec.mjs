import { test, expect } from "@playwright/test";
import { open, chooseLarge, cart } from "./helpers.mjs";
import { mkdir, writeFile } from "node:fs/promises";

test("German brewer and filter survive UK switch, three rates resolve, decline recovers to a test order", async ({
  page,
}) => {
  test.setTimeout(180000);
  await open(page, "/de/products/cone-brewer");
  await chooseLarge(page);
  await page.locator("product-form button[type=submit]").first().click();
  await expect(page.locator("cart-drawer")).toHaveClass(/active/);
  await page
    .locator("cart-drawer")
    .getByRole("button", { name: "Schließen", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Kegel-Papierfilter 02 zum Warenkorb hinzufügen",
      exact: true,
    })
    .click();
  await expect.poll(async () => (await cart(page)).item_count).toBe(2);
  await page
    .locator("cart-drawer")
    .getByRole("button", { name: "Schließen", exact: true })
    .click();
  await page.locator("#HeaderCountryForm .disclosure__button").click();
  await page
    .getByRole("link", { name: "Vereinigtes Königreich", exact: true })
    .click();
  await expect(
    page.locator("#HeaderCountryForm .disclosure__button"),
  ).toContainText("Vereinigtes Königreich");
  await page.locator("#HeaderLanguageForm .disclosure__button").click();
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Cone Brewer");
  const actual = await cart(page);
  expect(actual.items.map((i) => i.sku).sort()).toEqual([
    "BB-17-STD",
    "BB-CONE-02-CHALK",
  ]);
  expect(actual.currency).toBe("EUR");
  expect(actual.total_price).toBe(4600);
  await page.locator("#cart-icon-bubble").click();
  await page.locator("#CartDrawer-Checkout").click();
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toBeVisible();
  // The contact heading is server-rendered before checkout hydration. Wait for
  // the hosted payment input so an early country choice is not overwritten.
  await expect(
    page.frameLocator('iframe[title="Card number"]').getByRole("textbox"),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("brewbench-qa@example.com");
  const evidence = [];
  for (const country of [
    {
      code: "AT",
      name: "Austria",
      postal: "1010",
      city: "Vienna",
      rate: "4.90",
    },
    {
      code: "DE",
      name: "Germany",
      postal: "10115",
      city: "Berlin",
      rate: "6.90",
    },
    {
      code: "GB",
      name: "United Kingdom",
      postal: "SW1A 1AA",
      city: "London",
      rate: "9.90",
    },
  ]) {
    await page
      .getByRole("combobox", { name: "Country/Region", exact: true })
      .first()
      .selectOption(country.code);
    await page
      .getByRole("textbox", { name: "First name", exact: true })
      .first()
      .fill("Demo");
    await page
      .getByRole("textbox", { name: "Last name", exact: true })
      .first()
      .fill("Customer");
    await page.locator("#shipping-address1").fill("10 Example Street");
    await page
      .getByRole("textbox", { name: "City", exact: true })
      .first()
      .fill(country.city);
    await page
      .getByRole("textbox", { name: /^(Postal code|Postcode)$/ })
      .first()
      .fill(country.postal);
    await page
      .getByRole("textbox", { name: /^(Postal code|Postcode)$/ })
      .first()
      .press("Tab");
    await expect(
      page.getByText(`Brewbench ${country.code} standard (test)`, {
        exact: true,
      }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("table", { name: "Cost summary" }),
    ).toContainText(`€${country.rate}`);
    evidence.push({
      country: country.code,
      shippingEUR: country.rate,
      observed: true,
    });
    await page.screenshot({
      path: `docs/evidence/checkout-${country.code.toLowerCase()}.png`,
    });
  }
  const number = page
    .frameLocator('iframe[title="Card number"]')
    .getByRole("textbox");
  const expiry = page
    .frameLocator('iframe[title="Expiration date (MM / YY)"]')
    .getByRole("textbox");
  const code = page
    .frameLocator('iframe[title="Security code"]')
    .getByRole("textbox");
  const name = page
    .frameLocator('iframe[title="Name on card"]')
    .getByRole("textbox");
  await number.fill("2");
  await expiry.fill("12/28");
  await code.fill("111");
  await name.fill("Bogus Gateway");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /declined|issue processing|unable to process/i })
      .first(),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: /Pay now/ })).toBeEnabled();
  await page.screenshot({ path: "docs/evidence/checkout-declined.png" });
  await number.fill("1");
  await expiry.fill("12/28");
  await code.fill("111");
  await name.fill("Bogus Gateway");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect(
    page.getByText(/Your order is confirmed|Thank you, Demo/i).first(),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator("#checkout-pay-button")).toHaveCount(0);
  await page.waitForTimeout(1200); // Allow the hosted checkout's page transition to finish before evidence capture.
  await page.screenshot({
    path: "docs/evidence/checkout-confirmed.png",
    mask: [page.getByText(/^Confirmation #/)],
  });
  await mkdir(".local/checkout", { recursive: true });
  await writeFile(".local/checkout/confirmation-url.txt", page.url());
  await page
    .context()
    .storageState({ path: ".local/checkout/confirmed-auth.json" });
  await writeFile(
    "docs/evidence/checkout.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        testGateway: true,
        declineRecovered: true,
        items: [
          { sku: "BB-CONE-02-CHALK", quantity: 1, priceEUR: 38 },
          { sku: "BB-17-STD", quantity: 1, priceEUR: 8 },
        ],
        currency: "EUR",
        shipping: evidence,
        totalEUR: 55.9,
        browserConfirmation: true,
      },
      null,
      2,
    ),
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  mapCustomerEvent,
  deduplicateMapped,
} from "../../analytics/map-events.mjs";
import { syntheticEvents } from "../../analytics/generate.mjs";
import { analyze, sampleSize } from "../../analytics/analyze.mjs";
const context = {
  consent: true,
  country: "GB",
  locale: "en",
  release: "1.0.0",
};
const variant = {
  id: "gid://shopify/ProductVariant/100",
  sku: "BB-DEMO",
  price: { amount: 38, currencyCode: "EUR" },
};
const event = (name, data) => ({
  id: "fixture-1",
  timestamp: "2026-10-01T12:00:00Z",
  name,
  data,
  context: {
    document: { location: { href: "https://example.test/?secret=private" } },
  },
});
const checkout = {
  subtotalPrice: { amount: 70, currencyCode: "EUR" },
  totalPrice: { amount: 84.9, currencyCode: "EUR" },
  totalTax: { amount: 5, currencyCode: "EUR" },
  shippingLine: { price: { amount: 9.9, currencyCode: "EUR" } },
  lineItems: [
    {
      variant,
      quantity: 2,
      finalLinePrice: { amount: 70, currencyCode: "EUR" },
    },
  ],
  order: { id: "gid://shopify/Order/100" },
  email: "private@example.test",
  token: "private-token",
};
test("product and cart mapping use decimal money and correct quantity", () => {
  assert.equal(
    mapCustomerEvent(
      event("product_viewed", { productVariant: variant }),
      context,
    ).value,
    38,
  );
  const mapped = mapCustomerEvent(
    event("product_added_to_cart", {
      cartLine: {
        merchandise: variant,
        quantity: 2,
        cost: { totalAmount: { amount: 70, currencyCode: "EUR" } },
      },
    }),
    context,
  );
  assert.equal(mapped.value, 70);
  assert.equal(mapped.items[0].price, 35);
  assert.equal(mapped.items[0].quantity, 2);
});
test("checkout mapping separates subtotal, shipping, tax and deduplicates orders", () => {
  const e = event("checkout_completed", { checkout });
  const mapped = mapCustomerEvent(e, context);
  assert.equal(mapped.name, "purchase");
  assert.equal(mapped.value, 70);
  assert.equal(mapped.shipping, 9.9);
  assert.equal(mapped.tax, 5);
  assert.ok(!JSON.stringify(mapped).includes("private"));
  assert.equal(
    deduplicateMapped([mapped, { ...mapped, event_id: "new" }]).length,
    1,
  );
  assert.equal(
    mapCustomerEvent(event("checkout_started", { checkout }), context).name,
    "begin_checkout",
  );
});
test("consent, missing order and malformed quantities fail closed", () => {
  assert.equal(
    mapCustomerEvent(event("product_viewed", { productVariant: variant }), {
      ...context,
      consent: false,
    }),
    null,
  );
  assert.throws(
    () =>
      mapCustomerEvent(
        event("checkout_completed", { checkout: { ...checkout, order: null } }),
        context,
      ),
    /order ID/,
  );
  assert.equal(mapCustomerEvent(event("checkout_click", {}), context), null);
});
test("deterministic analysis excludes unexposed traffic and diagnoses UK mobile", () => {
  const raw = syntheticEvents();
  assert.deepEqual(raw, syntheticEvents());
  const r = analyze(raw);
  assert.ok(r.duplicatesRemoved > 0);
  assert.ok(r.missingExposureVisitors > 0);
  assert.ok(r.excludedEvents > 0);
  assert.ok(
    r.segments["GB/mobile"].treatment.rate <
      r.segments["GB/mobile"].control.rate,
  );
  assert.ok(
    r.segments["GB/mobile"].treatment.latencyP75 >
      r.segments["GB/mobile"].control.latencyP75,
  );
  assert.ok(sampleSize() > 3000);
});

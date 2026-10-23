// Fixture-only Web Pixel adapter. This module is not installed as a Shopify pixel.
const names = {
  product_viewed: "view_item",
  product_added_to_cart: "add_to_cart",
  checkout_started: "begin_checkout",
  checkout_completed: "purchase",
};
const safeId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_:/.-]{1,100}$/.test(value)
    ? value
    : null;
function money(value) {
  if (
    !value ||
    !Number.isFinite(Number(value.amount)) ||
    Number(value.amount) < 0 ||
    !/^[A-Z]{3}$/.test(value.currencyCode)
  )
    throw new Error("Invalid money");
  return { amount: Number(value.amount), currency: value.currencyCode };
}
function item(variant, quantity, total) {
  if (!safeId(variant?.id) || !Number.isInteger(quantity) || quantity < 1)
    throw new Error("Invalid item");
  const price = total
    ? money(total).amount / quantity
    : money(variant.price).amount;
  return {
    item_id: variant.id,
    ...(safeId(variant.sku) ? { sku: variant.sku } : {}),
    quantity,
    price,
  };
}
export function mapCustomerEvent(event, context) {
  if (context.consent !== true) return null;
  const name = names[event.name];
  if (!name) return null;
  if (!safeId(event.id) || !Number.isFinite(Date.parse(event.timestamp)))
    throw new Error("Missing event identity");
  const result = {
    name,
    event_id: event.id,
    timestamp: event.timestamp,
    source: "customer-event-fixture",
    consent: true,
    country: context.country,
    locale: context.locale,
    release: context.release,
  };
  if (event.name === "product_viewed") {
    const v = event.data.productVariant;
    const price = money(v.price);
    return {
      ...result,
      currency: price.currency,
      value: price.amount,
      items: [item(v, 1)],
    };
  }
  if (event.name === "product_added_to_cart") {
    const line = event.data.cartLine;
    const total = money(line.cost.totalAmount);
    return {
      ...result,
      currency: total.currency,
      value: total.amount,
      items: [item(line.merchandise, line.quantity, line.cost.totalAmount)],
    };
  }
  const checkout = event.data.checkout;
  const subtotal = money(checkout.subtotalPrice);
  const items = checkout.lineItems.map((line) =>
    item(line.variant, line.quantity, line.finalLinePrice),
  );
  if (!items.length) throw new Error("Checkout has no items");
  const mapped = {
    ...result,
    currency: subtotal.currency,
    value: subtotal.amount,
    items,
    tax: money(checkout.totalTax).amount,
    shipping: checkout.shippingLine?.price
      ? money(checkout.shippingLine.price).amount
      : 0,
  };
  if (name === "purchase") {
    if (!safeId(checkout.order?.id))
      throw new Error(
        "Purchase requires an order ID; never use a raw checkout token",
      );
    mapped.transaction_id = checkout.order.id;
  }
  return mapped;
}
export function deduplicateMapped(events) {
  const seen = new Set();
  return events.filter(Boolean).filter((e) => {
    const key =
      e.name === "purchase" ? `purchase:${e.transaction_id}` : e.event_id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

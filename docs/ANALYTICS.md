# Measurement contract

Three evidence streams are kept separate: observed theme events, fixture-only Shopify customer-event mappings, and deterministic synthetic analysis. No GA4 property, custom pixel, GTM container or external collector is connected. A real test order proves checkout works; it does not prove a purchase pixel is installed.

## Consent and local recorder

`bb-storefront.js` uses Shopify's Customer Privacy API. Brewbench tracking requires both affirmative analytics consent (`yes`) and `analyticsProcessingAllowed() === true`, with no local withdrawal override. Rejecting, ignoring, withdrawing, unavailable privacy APIs and failed storage all leave shopping functional. Tracking fails closed. A refusal flag is an essential preference; it is not a visitor identifier.

Only after consent, a random visitor ID and versioned experiment assignment are stored. Assignment expires after 30 days. Session IDs are scoped to session storage. Withdrawal purges identifiers, events and exposure history. At most 200 allowlisted events are retained locally. Inspect `window.BrewbenchQA.status()` and export `window.BrewbenchQA.exportEvents()` in a test browser. Do not publish raw browser state or storage dumps.

| Event | Emission condition | Meaning |
|---|---|---|
| `view_item` | Consented product page | Viewed product and initial selected variant, unit price |
| `experiment_exposure` | Eligible brewer, assigned UI rendered, shared purchase region at least 50% visible | Once per visitor/product/version; QA override is marked test traffic |
| `add_to_cart` | Successful Ajax add response | Exact returned product/variant/SKU, requested quantity, unit price, value |
| `checkout_click` | Checkout control activated | Intent to navigate, not checkout-start confirmation |
| `interaction_error` | Compatible-add failure | Diagnostic event without raw error text or private data |
| `interaction_timing` | Successful compatible add | Request latency and page layout-shift total at interaction time; this is not field CLS |

Common context: event ID, UTC timestamp, visitor/session, country, locale, currency, release, experiment/version/group, consent, source and QA flag. No email, address, name, phone, full URL/query, checkout token or arbitrary error text is allowed. Events deduplicate by event ID; purchase fixtures deduplicate by order identity. A partial-stock 422 is reconciled in the UI but is not reported as a successful requested add; this conservative measurement limitation is explicit.

## Compatibility experiment

Both groups show exact fit. Treatment adds a sage background and prominent quick-add styling near the purchase controls. Only brewer variants with an available compatible recommendation are eligible. A deterministic hash of a random consented visitor and experiment version assigns 50:50 groups. Without consent the standard experience remains visible and is excluded from analysis. The theme setting `bb_experiment_enabled` is the kill switch. `?bb_group=control` and `?bb_group=treatment` are QA-only overrides; their events cannot enter the report's real-study cohort.

Primary measure: distinct exposed visitors successfully adding the viewed brewer / distinct exposed eligible visitors. Attachment and purchases are secondary. Errors, latency, layout shift and sample-ratio imbalance are guardrails. The sample-size assumptions, seven-day attribution, duration/stopping rule and deliberately anomalous UK-mobile segment are in [the synthetic report](SYNTHETIC_ANALYSIS.md). Those generated results make no claim about real customer conversion.

## Customer-event adapter

`analytics/map-events.mjs` is a fixture-tested adapter, not installed pixel code. It maps `product_viewed` → `view_item`, `product_added_to_cart` → `add_to_cart`, `checkout_started` → `begin_checkout`, and `checkout_completed` → `purchase`. Add value is the line total; unit price is line total divided by quantity. Purchase value uses subtotal excluding shipping/tax, which are separate fields. Purchase identity is the order ID; absent identity is rejected. Consent must be supplied by the caller.

The contracts follow Shopify's [product view](https://shopify.dev/docs/api/web-pixels-api/standard-events/product_viewed), [cart add](https://shopify.dev/docs/api/web-pixels-api/standard-events/product_added_to_cart), [checkout start](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_started) and [checkout completion](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_completed) events. Future installation would require separate access, consent and checkout-extension/privacy review; it is outside this core release.

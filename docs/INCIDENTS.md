# Controlled incident exercises

These deliberately introduced faults ran on the dedicated development store or in a local QA fixture. No production merchant was affected. The shipped release contains the repaired behavior.

## 1. Selected size 02 adds size 01

**Symptom and scope.** A shopper selects the large Cone Brewer and sees the large SKU, but the cart contains the small version. The exercise changes only the hidden variant ID in one test browser document; it does not deploy a broken theme.

**Reproduce and investigate.** `tests/browser/exercises.spec.mjs` records the small ID, selects size 02, deliberately writes the stale small ID into the purchase form, and submits through Shopify's real cart endpoint. Hypotheses were stale form state, an incorrect compatibility reference or a cart-rendering mistake. The authoritative cart SKU is `BB-CONE-01-CHALK`, proving the request selected the wrong variant rather than merely displaying the wrong label.

**Correction.** Reload the shipped implementation and select size 02 normally. The product-info replacement keeps the selected option, price, SKU, specifications, recommendations and hidden ID together, disables submission while a variant response is pending, and rejects stale responses. The cart then contains `BB-CONE-02-CHALK`. [Before](evidence/incident-variant-before.png) · [after](evidence/incident-variant-after.png) · [structured evidence](evidence/exercises.json).

**Regression coverage.** Exact variant/compatibility and rapid selection tests run in desktop/mobile Chromium, Firefox and WebKit. Unavailable size/finish combinations disable purchasing. Stakeholder update: “The intentionally stale variant ID reproduced the wrong-size order. The normal synchronized selection path adds the requested size; the regression test verifies Shopify's cart, not just the button text.”

## 2. UK shipping option missing

**Symptom and scope.** The UK cart cannot be delivered even though both items have inventory. The test disables only the dedicated UK rate through supported APIs, preserves the before-state ledger, and restores it afterward.

**Reproduce and investigate.** `node scripts/store/geography.mjs uk-rate-off`, then reload the populated UK checkout. Shopify reports that the products are unavailable for delivery. Inventory, market status and catalog membership still pass, narrowing the cause to delivery configuration. [Failure screenshot](evidence/incident-shipping-before.png).

**Root cause and correction.** This new development store resolves delivery through market-level shipping options in Admin API 2026-10. Legacy delivery profiles can accept rate writes without making inventory purchasable in a new market. The implementation now reconciles and verifies both the legacy profile and the active market shipping configuration. Restore with `uk-rate-on`, run `verify`, and verify checkout again. The restored UK option is €9.90; the completed test order totals €55.90. [Restored checkout](evidence/checkout-gb.png) · [API order verification](evidence/test-order-verification.json).

**Regression coverage.** The checkout test resolves AT, DE and GB rates and completes a UK test order. Stakeholder update: “The missing UK option blocked delivery, not product stock. The option is restored and checkout is verified. Future checks inspect market shipping and a real checkout instead of relying on a legacy-profile write.”

## 3. Duplicate add event inflates measurement

**Symptom and scope.** One successful cart addition appears twice in a deliberately broken local event fixture. This is a tracking exercise, not a live collector or a claim about real shoppers.

**Reproduce and investigate.** Capture the consented theme event for a successful addition, clone it without changing its event ID, and count both entries. The cart has one addition while the fixture has two events, distinguishing duplicate instrumentation from duplicate commerce. Public evidence contains counts only; visitor/session identifiers remain private.

**Correction.** Apply the shipped event-ID deduplicator: two identical events become one. Purchase adapters separately deduplicate by transaction ID; missing transaction IDs are rejected. Consent withdrawal clears stored experiment/event data, and failed shopping requests do not produce successful-add events. [Counts and source label](evidence/exercises.json) · [mapping/unit tests](../tests/unit/analytics.test.mjs).

**Stakeholder update.** “The inflated count came from a duplicate fixture event. Event-ID deduplication restores the one-add count. This validates the adapter contract; it does not prove a checkout pixel is installed.”

## Other defects found during the build

- German quick-add originally joined `/de` and `cart/add.js` without a slash. Normalizing the locale root fixes the real localized request.
- Shopify can add available stock while returning an over-stock 422 error. The drawer now re-reads authoritative sections without reporting a successful addition.
- Restoring one authenticated browser state can carry server-side consent between test contexts. The ignored-banner journey now authenticates a genuinely fresh anonymous visitor and waits for the privacy API before asserting an empty consent signal.
- Quantity controls needed an explicit accessible label, and unavailable option labels needed stronger contrast. The product accessibility checks now pass.

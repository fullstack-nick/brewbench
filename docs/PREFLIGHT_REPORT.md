# Brewbench preflight report

Checked 23 October 2026 against the dedicated development store. This records setup verification, not completion of the Brewbench storefront implementation.

**Result: preflight passed for the agreed core scope.** Developer access, core API operations, theme deployment/rollback, local preview, Figma editing, and actual hosted checkout are verified. The project is ready for the full implementation run using the recorded CLI execution route.

## Environment

| Item | Verified value |
|---|---|
| Store | `brewbench-practice.myshopify.com`, Brewbench Practice |
| Store creation | Free Basic-configured development store, AT, generated test data |
| Currency | EUR |
| Primary language | English (`en`), published |
| Additional language | German (`de`), enabled but unpublished during preflight |
| Tooling | Shopify CLI 4.9.4, Node 24.19.0, Admin GraphQL 2026-10 |
| Theme baseline | Dawn v16.0.0, commit `bc39a7d2024f1e5c14c42f855bd3552b4913e204` |
| Design file | [Brewbench — Design and preflight](https://www.figma.com/design/NjRmHGtjzq5QlDZSGOcVHW) |
| GitHub | Authenticated account `fullstack-nick`; repository creation belongs to implementation |
| CI | None; all checks and deployments run locally |

## Observed checks

| Check | Result and evidence |
|---|---|
| Developer organization | Passed: organization listed and dedicated dev store created through CLI |
| Store identity and scopes | Passed: owner-authenticated CLI Connector App and API readback |
| Catalog writes | Passed: created a draft probe product; it remains unavailable to shoppers |
| Inventory | Passed: read available quantity at the intended location; accepted a compare-and-swap write preserving zero stock |
| Metafields | Passed: merchant-owned definition, value write, and independent readback |
| Metaobjects | Passed: merchant-owned definition, upsert, and independent readback |
| Pages and navigation | Passed: unpublished probe page and an unassigned probe menu |
| Languages and translations | Passed: enabled unpublished German and registered a German title on the draft probe |
| Markets | Passed: read existing markets, accepted a same-name Austria update, created draft Germany/UK markets |
| Market catalog availability | Passed: created a draft UK market catalog and an empty publication; no active customer-market change |
| Product publication | Passed: associated the draft product with the Online Store publication; draft status still prevents storefront sale |
| Shipping configuration | Passed: created an unused delivery profile and an Austrian zone with a EUR 4.90 rate; no products assigned |
| Theme upload | Passed: uploaded Dawn as the unpublished `Brewbench Preflight` theme |
| Theme publish and rollback | Passed: published the probe theme, then restored the original `test-data` live theme and verified it by CLI |
| Hosted theme rendering | Passed: password accepted; preview bar identified `Brewbench Preflight Draft`; product and cart rendered |
| Local development | Passed: `theme dev` served the theme at `http://127.0.0.1:9292` using the saved storefront password |
| Actual hosted checkout | Passed: sample product → cart → Shopify checkout → Austrian shipping → test payment → confirmation page |
| Declined payment | Passed: test card value `2` was submitted and checkout returned its payment-processing error |
| Successful test order | Passed: test card value `1` produced order `#1001`; Admin API independently returned `test: true`, `PAID`, gateway `bogus` |
| Figma write access | Passed: created an owned Design file and renamed its initial page to `00 — Preflight verified` |
| Local Theme Check | Passed with baseline warnings: zero errors and nine warnings on unmodified Dawn |

The nine upstream warnings are one LiquidComplexity, one OrphanedSnippet, three UndefinedObject, two UnusedAssign, and two VariableName findings. The full implementation must review the relevant remaining warnings and record its own final result. The local homepage returned HTTP 200; its missing default favicon returned 404 and will be replaced by Brewbench's original favicon during implementation.

## Checkout evidence

The test used one generated sample product, fictional Austrian delivery details, an `@example.com` email, and the documented Test Payment Gateway values. Standard shipping was free; Express was also offered at EUR 9.99. The completed simulated order totaled EUR 699.95 with standard shipping. Marketing opt-in and saving checkout details were left unchecked. No real payment card was used and no fulfillment was requested.

The confirmation page displayed “Your order is confirmed.” The independent API query returned one test order, `#1001`, with financial status `PAID` and payment gateway `bogus`. Private screenshots `payment-declined.png` and `test-checkout-confirmed.png`, plus the API response, are retained under `.local/preflight/`. The test order remains in the development store as evidence.

Embedded browser panels initially stalled. Closing completed authorization tabs and reloading checkout allowed the card fields to load; the actual payment tests then completed. This was resolved without changing payment settings or bypassing browser security controls.

## Access boundaries and connector status

The user approved sign-in/permission-consent screens, one-time developer organization enrollment, and one read-only storefront-password lookup. No Shopify admin settings were changed through the browser. The embedded Preferences panel stalled in browser automation; the user saved the existing password locally. Store setup and all writes listed above used supported CLI/API operations.

The Shopify plugin's store connection did not expose a reconnection prompt after switching away from the unavailable old shop. Store-data execution therefore uses the working Shopify CLI Connector App. Plugin schema discovery and validation remain usable. The unavailable old shop was not modified.

Local credentials, raw responses, resource IDs, and browser evidence live under ignored `.local/preflight/`. Do not commit the password file, tokens, checkout URLs, raw order responses, or browser state.

## Implementation details learned from execution

1. Inventory mutations in API 2026-10 require a field-level `@idempotent(key: ...)` directive. A schema-valid mutation without it was rejected at runtime. Persist one key per logical write and reuse it for retries of the same payload. For absolute stock writes use the current `changeFromQuantity` field with the last read quantity. [Inventory activation](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/inventoryActivate), [setting quantities](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/inventorySetQuantities).
2. `inventoryActivate` cannot initialize `available` again when the item is already active at that location. Inspect activation state first, then use a quantity mutation for existing levels.
3. `MarketConditionsRegionsInput` is a one-of input. Supply `regions` by itself when selecting countries; do not also send `applicationLevel`. Validate the pinned schema even when a documentation example differs.
4. Publication identity is resolved through its catalog and channel context; do not assume a publication `name` field is present in the pinned schema.
5. API and owner authentication do not unlock the visitor storefront. The saved storefront password is also needed for the local theme proxy. Load it through an environment variable/private file, never a committed command argument.
6. Preserve English as primary and use EUR throughout. German is ready for translations but must only be published after content QA.

## State retained for implementation

The original `test-data` theme is live. `Brewbench Preflight` remains an unpublished Dawn baseline. The local development server was stopped after verification. Generated sample products remain in place and must be archived/unpublished when the Brewbench catalog is seeded; the test purchase has consumed one unit of the selected sample variant.

Small preflight records remain identifiable by their `brewbench-preflight-probe` handles or `Brewbench preflight` names: a draft product, unpublished page, unassigned menu, custom-data definitions/value, unused shipping profile, draft Germany/UK markets, and a draft UK catalog/publication. Reconcile these through the implementation's resource ledger; do not blindly create duplicates. Draft markets can be adopted for the final country setup. The unused shipping profile has no effect on current checkout.

The final three-country journeys, media-processing pipeline, native filter availability, full accessibility/performance checks, and branded design remain implementation acceptance work. Preflight access success does not claim those features are already delivered. There are no outstanding user decisions or unresolved preflight blockers for the agreed core scope.

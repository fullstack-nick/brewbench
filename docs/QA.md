# Local quality record

Date: 23 October 2026. Environment: Windows, Node 24.19.0, Shopify CLI 4.9.4, Admin API 2026-10, Dawn 16.0.0 base, Playwright 1.64.1. The development storefront is password protected. There is no CI or remote test gate. Storefront source is commit `83173bc881722f5ab9ca00f9fc26780e577ac86e`; the [release record](RELEASE.md) identifies the unchanged theme tree and later delivery evidence.

## Checks

| Check | Evidence |
|---|---|
| Catalog/schema relationships | 24 products, 26 variants; exact SKU references, unique combinations, required content and asset paths validated |
| Consequential unit tests | 11 tests: manifest failure cases, exact variants, consent, stable assignment/expiry, event allowlist, deduplication, customer-event mappings, synthetic segmentation, nested API errors |
| Formatting | Prettier check passes for tooling, manifests, analytics and tests |
| Theme Check | Zero errors; nine warnings retained from the Dawn base (naming, unused assignments, orphaned snippet, complexity and analyzer object warnings) |
| Admin operations | All committed GraphQL operations validated against 2026-10, artifact revision 8 |
| Native catalog reads | Active products, native categories, ready media, prices, exact references, shared guides, four language menus and published German verified |
| Repeat apply | [Identities, counts and inventory preserved](evidence/idempotence.json); the large brewer remained at 29 after the first test order |
| Market setup | Three active country markets, EUR currency, exact 23-product UK publication, legacy profiles and active market-level shipping options |
| Test checkout | [Browser journey](evidence/checkout.json) plus [native API verification](evidence/test-order-verification.json): correct large brewer/filter, GB, EUR 55.90, test=true, paid |

The Shopify skill's standalone theme-validator helper failed to load its bundled `@shopify/theme-check-common` dependency. The installed Shopify CLI Theme Check ran successfully instead. Do not interpret the helper failure as a passing validation.

## Browser matrix

The nine storefront tests run in desktop Chromium (1440×1000), Chromium Pixel 7 emulation, desktop Firefox and desktop WebKit. These are local engine/emulation runs; no physical phone or real macOS Safari coverage is claimed. The final machine-readable result is [browser results](evidence/browser-results.json).

Each profile covers exact large-brewer/filter selection; cart quantity/removal; rapid changes and unavailable combinations; real stock-limit rejection and recovery; affirmative/ignored/rejected/withdrawn consent; stable deduplicated exposure; storage/API failure; pagination/back/sorting/empty search; long German copy; axe WCAG A/AA checks on the product content; reduced-motion drawer Escape; and German quick-add.

The consent test creates a fresh anonymous authenticated visitor, waits for the privacy API and asserts an empty consent signal before interaction. Reusing one Shopify session between contexts can preserve consent server-side. A visible initial mobile banner is used directly instead of clicking a footer button beneath it. These were test-isolation/sequencing fixes, not exceptions to consent assertions.

## Additional acceptance journeys

| Journey | Result/evidence |
|---|---|
| German size 02 + exact filters → GB + English | Correct two SKUs, EUR 46 subtotal, EUR 9.90 delivery, completed test order |
| AT / DE / GB checkout rates | EUR 4.90 / 6.90 / 9.90 in the hosted checkout; fictional contact/address details only |
| Failed payment then recovery | Bogus card 2 produces a payment error; card 1 succeeds; no real card is used |
| UK-excluded Thermal Carafe | Shopify retains the cart line; theme names it as unavailable and provides native removal; [screenshot](evidence/uk-catalog-exclusion.png) |
| Keyboard and reflow | Skip link, keyboard add, Escape/focus return, 320-pixel reflow; [screenshot](evidence/narrow-keyboard.png). Narrow viewport tests the equivalent layout constraint, not browser zoom on a physical device |
| Shared content | One API edit appears on two brewer pages, then restores; [evidence](evidence/exercises.json) |
| Duplicate sections | Two guide and two FAQ sections with unique heading IDs; [configuration record](evidence/configuration.json) |
| Missing images | Original hero disabled and empty method image produce useful text/SVG fallbacks; [screenshot](evidence/missing-image-fallback.png) |
| Experiment kill switch | Standard experience and zero exposures despite treatment override; setting restored after test |
| Incidents | [Wrong variant, missing UK rate and duplicate event](INCIDENTS.md), with faults removed |
| Performance | Three real-storefront runs per route; [measurements and limitations](PERFORMANCE.md) |

Native theme-editor interaction, production payment processing, real delivery/tax calculation, installed purchase-pixel delivery and field performance are not tested capabilities. The native checkout UI remains Shopify-owned. Shopify rate limiting/challenges interrupted earlier rapid test attempts; those were not counted as passes or bypassed.

## Reproduce

```powershell
npm run check
npm run theme:check
npm run store:verify
node scripts/store/geography.mjs verify
npm run test:browser
npx playwright test --config playwright.checkout.config.mjs
npx playwright test --config playwright.exercises.config.mjs
node scripts/configuration-qa.mjs
```

The last command is only for the unpublished candidate. Raw traces, browser state, API IDs and order payloads remain ignored under `.local/`. Public artifacts contain fictional test details and aggregate counts. For deployed source and rollback evidence see [release](RELEASE.md).

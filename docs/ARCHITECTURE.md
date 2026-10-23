# Architecture

Brewbench is an Online Store 2.0 Liquid theme. Shopify is authoritative for inventory, prices, market availability, shipping, cart totals and checkout. Node.js runs local authoring and verification tools; there is no custom production server. No CI, automatic deployment, app backend, webhooks, Flow, Function, checkout extension or external analytics collector is installed.

## Components

| Component | Source | Contract |
|---|---|---|
| Editorial hero | `theme/sections/bb-hero.liquid` | Bilingual editable copy, destination, original responsive image, image-picker override and mobile crop |
| Brewing methods | `theme/sections/bb-methods.liquid` | Editable method cards and collection links |
| Specifications | `theme/snippets/bb-specifications.liquid` | Selected variant capacity/SKU; product material/care fallback; no empty rows |
| Exact fit | `theme/snippets/bb-compatible-products.liquid` | Explicit variant references; available quick add; sold-out explanation; country-aware Liquid resources |
| Shared guide | `theme/sections/bb-guide.liquid` | One translatable guide with ordered step references, reused by two brewers |
| FAQ | `theme/sections/bb-faq.liquid` | Native `details`/`summary`, bilingual editable questions and answers |

Home, product, collection, cart, search and page templates compose these with Dawn. The header, cart drawer and footer work on narrow screens. All-products and search pagination use eight items per page. Collection links provide catalog-wide discovery. Native sorting and pagination remain server-driven; no browser-only filtering of the current page is presented as a catalog filter.

## State and requests

`product-info.js` aborts the previous selection request and rejects late responses before DOM updates. Selection clears the hidden variant ID and disables purchase until Shopify returns the exact combination. Price, URL, SKU, capacity and fit module change together. Unavailable combinations never fall back to a purchasable ID. Replacing selectors atomically avoids duplicate controls during the original Dawn transition.

Cart adds use locale-aware Ajax endpoints and bundled section rendering. Updates/removals use line keys where available. Repeated adds are guarded while pending. A successful server add emits one event; a subsequent section-render failure navigates to the authoritative cart instead of inviting a duplicate retry. A 422 stock response can partially add available stock, so error handling refreshes cart sections without reporting a successful requested addition. Escape also works after the focused cart row is removed. Reduced-motion focus trapping does not depend on a transition event.

Country/language changes use Shopify localization forms. An essential, ten-minute session snapshot retains only variant IDs/quantities for comparison after navigation. The theme re-reads the cart, shows a review notice and never silently deletes an item itself. Shopify can retain an excluded line in the cart; localized Ajax Product API reads identify unavailable lines and explain removal or country reselection. The cart page provides native remove actions. These reads are advisory, bounded by an eight-second cancellation deadline, and never fabricate availability when a request fails. Shopify enforces country publication and delivery eligibility at checkout.

## Content and deployment

JSON manifests are the authoring source; native Shopify resources are the runtime source. The Admin API is pinned to `2026-10`. The seeder writes handle/SKU-addressed resources, fetches translation digests, resolves taxonomy IDs, waits for media readiness and reconciles variant relationships after native product synchronization. Stock initializes once; ordinary reruns preserve it. It does not adopt unrelated-vendor products.

English is the shop's existing primary language; German is an alternate locale on the primary-domain web presence. That presence is attached to all three active markets. Menu items are not exposed as individual public translation resources, so two native menus per location provide editable English/German labels. The theme chooses by locale. Product, collection, page, option, metafield and metaobject translations use native Translations API data.

The source-available Dawn theme license is retained. This repository intentionally has no `.github/workflows` directory, remote tests or automatic publish hook.

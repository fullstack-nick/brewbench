# Brewbench implementation plan

Research date: 23 October 2026. Status: preflight passed for the agreed core scope; ready for full storefront implementation. See [preflight results](PREFLIGHT_REPORT.md) for actual checkout, API, theme, and design evidence.

This replaces the original learning roadmap with a delivery specification for one continuous implementation effort. Read [feasibility](FEASIBILITY.md) for platform evidence and [prerequisites](DECISIONS_AND_PREREQUISITES.md) before starting.

## 1. Agreed boundaries

- Build a fictional home-coffee-equipment brand named Brewbench.
- Publish the project source, documentation, screenshots, and demonstration recording in a public GitHub repository.
- Use a free Shopify development store. No paid store, domain purchase, paid app, or production sales.
- Implement the core project only. The catalog-quality backend/webhooks, Flow, Function/checkout extension, and 250-product/16-market exercises are excluded.
- Use supported plugins, APIs, and CLI commands. Do not configure Shopify through its admin, theme editor, app screens, browser automation, or undocumented internal endpoints.
- The user permits sign-in and permission-consent screens, one-time free developer/Partner organization enrollment, and one read-only lookup of the existing storefront password. Organization access and dev-store creation are verified; these exceptions do not authorize admin configuration.
- No CI: run validation and tests locally. Do not add GitHub Actions, another CI service, or required remote status checks, and do not carry upstream Dawn workflow files into the project.
- Browsers are used to test the customer-facing storefront and checkout, capture evidence, and inspect the result.
- All names, copy, designs, product assets, and public documentation must be independent of real employers or unrelated brands. Do not copy the supplied brief or its external branding into the repository.

The original plan cannot be delivered unchanged with zero admin configuration. The following are deliberate changes to its acceptance criteria, not tasks to leave unfinished at release:

| Original expectation | Revised core commitment |
|---|---|
| Five configured native product facets | Category/method collection navigation, native sorting, search, pagination, and clear empty states. Render native facets only if already enabled and verified. |
| Austria/Germany in EUR and UK in GBP | Three country experiences, English/German, separate shipping rules, and one verified checkout currency. Target EUR; retain the actual platform currency if it cannot be set without admin work. No simulated GBP checkout. |
| German as the shop's primary language | Keep the created store's primary locale. Publish the other required locale and support German shopping journeys without changing the primary locale in the admin. |
| Installed pixel and live analytics integration | Working consent-aware storefront instrumentation, event mapping tests, and synthetic funnel analysis. Checkout/purchase pixel mappings use fixtures unless an existing supported integration is verifiably available. |
| Theme-editor acceptance testing | Deliver configurable schemas and dynamic-source bindings; verify configurations through code/API changes and rendered pages. Actual editor interaction is explicitly unverified. |
| Install/remove an app and measure its effect | Evaluate Search & Discovery using official documentation and its current listing. No installation. Measure theme performance directly and use a controlled tracking defect for the third incident exercise. |
| CI checks and automatic remote theme deployment | No CI, as requested. Run checks locally and record the results; deploy and roll back through the authenticated CLI on the development machine. |

These adaptations preserve the product-discovery-to-test-order journey, theme development, structured content, localization, CRO, analytics reasoning, QA, releases, and troubleshooting practice.

## 2. Architecture and versions

Use Online Store 2.0 and a Dawn-based Liquid theme with semantic HTML, CSS, and vanilla JavaScript. Shopify owns product prices, inventory, market availability, shipping, cart totals, and checkout. Node.js is tooling for data setup, checks, and analysis; it is not a production storefront backend.

This architecture directly exercises the original plan's Liquid sections, structured content, theme lifecycle, and native cart. A headless storefront would add application hosting and a separate rendering layer without removing Shopify account, payment, or market prerequisites. A custom Shopify app would add installation and token-lifecycle work that the revised core does not need. Neither is part of this implementation.

Initial version baseline:

| Component | Baseline |
|---|---|
| Dawn | v16.0.0, commit `bc39a7d2024f1e5c14c42f855bd3552b4913e204` |
| Shopify CLI | 4.9.4, checked in the package registry during research; pin the verified installation |
| Admin GraphQL API | 2026-10; schema-check operations before execution |
| Node.js | Installed v24.19.0 meets the current CLI minimum |
| Store | Verified `brewbench-practice.myshopify.com`, Basic-configured dev store, AT, generated test data, EUR, primary `en` |
| Repository | Proposed `fullstack-nick/brewbench`, public; authenticated GitHub account verified |

Dawn v16 uses the current customer-account experience. The core journey uses guest checkout and does not add legacy account templates. Preserve the upstream license and notices; Dawn is source available under Shopify's license, not MIT. Separate original tooling/documentation licensing from upstream theme licensing. See [version and licensing evidence](FEASIBILITY.md#versions-licensing-and-public-source).

Use the Shopify plugin's schema discovery and GraphQL validation before operations. Its store reconnection is currently unavailable; the separately authorized Shopify CLI data workflow has passed live reads and writes and is the execution baseline. If the plugin is subsequently connected, verify the exact shop before using it. Maintain reproducible manifests and scripts for either route; plugin and CLI authorization are separate.

Deploy theme files through Shopify CLI owner authentication. Do not build the plan around generic Admin API theme-file writes, Theme Access app installation, or Shopify's GitHub integration.

Proposed repository layout:

| Path | Responsibility |
|---|---|
| `theme/` | Dawn baseline plus Brewbench sections, snippets, assets, templates, locale files, and defaults |
| `data/catalog/` | 24-product source manifests, variants, collections, compatibility links |
| `data/content/` | Pages, menus, guides, FAQs, delivery copy, translations |
| `data/schema/` | Merchant-owned field/object definitions and validations |
| `scripts/store/` | Preflight, validate, plan, apply, verify, inventory reset, and snapshot tooling |
| `analytics/` | Event specification, transformations, synthetic fixtures, analysis script and report |
| `tests/` | Consequential unit checks and Playwright storefront journeys |
| `design/` | Design tokens, Figma links, exported screens, asset provenance |
| `docs/` | Setup, architecture, data dictionary, operations, incidents, QA, release records |
| `.github/` | Issue/PR templates only; no workflow files |

Keep tokens, cookies, browser storage state, storefront passwords, local resource-ID maps, API snapshots, and raw order records outside version control. Commit a sanitized environment example and synthetic data only.

## 3. Preflight: complete before the implementation run

The preflight is how we avoid discovering account or platform blockers halfway through the build. It is a small setup/verification stage, not permission to begin all features.

This stage passed on 23 October 2026, including a rejected test payment and successful Shopify-hosted test order #1001. Reuse the verified store, scopes, unpublished Dawn theme, Figma file, and local resource ledger. Do not recreate the development store or repeat successful probes unless access/state changes.

1. Verify the approved developer organization and permission to create dev stores. Passed on 23 October 2026; reuse the dedicated store recorded in the preflight report.
2. Install the pinned CLI and authenticate. Discover the installed command flags rather than copying potentially stale examples.
3. Create the dedicated dev store with generated test data. This intentionally obtains a preconfigured test gateway. Record the returned domain and confirm it is the intended dev store.
4. Authorize the plugin/CLI for the required operations. Verify store reads, scopes, publication access, inventory location, locale settings, market/shipping permissions, and theme access.
5. Inspect the actual store currency, primary locale, test gateway, existing markets, and configured native filters. Record the selected acceptance profile in the capability report.
6. Verify storefront access and a Shopify-hosted checkout in the browser session that will run QA. A CLI API token is not a storefront password. A public visitor preview is not proof of checkout access.
7. Upload a minimal unpublished theme; verify the intended version renders. Password access and the local proxy have passed using the existing password saved under ignored `.local/preflight/`. Keep that credential private and load it through `SHOPIFY_FLAG_STORE_PASSWORD` for local theme development.
8. Complete one test purchase using a generated sample product, shipping rate, test payment details, and an `@example.com` address. Check a failed payment too. Never substitute an API-created order for this checkout test.
9. Verify Figma file creation/editing. Passed: reuse [Brewbench — Design and preflight](https://www.figma.com/design/NjRmHGtjzq5QlDZSGOcVHW), where an initial page edit has been verified. Native mobile/desktop designs remain part of implementation.
10. Freeze the capability report, evidence labels, and reduced acceptance criteria. Then execute the delivery sequence below continuously.

If a required preflight check fails, the plan remains blocked for that capability. Do not label local mocks or fixture tests as a working Shopify deployment. The current existing-shop API failure is a reason to use the new dev store, not evidence that development stores are unsupported.

## 4. Brand, design, and content

Customer journeys:

1. A beginner chooses a brewer and correctly sized filter papers.
2. An enthusiast compares capacity/material and selects an available variant.
3. A returning shopper finds a compatible replacement or consumable.

Default visual direction: warm off-white backgrounds, dark espresso text, a restrained green accent, generous spacing, clear product photography/illustration, and practical specifications. Favor readable typography over decorative effects. Use original assets or assets with explicit reuse rights; record source and license for each. No copied logos, product photographs, endorsements, reviews, or claims about real brands.

Create mobile and desktop designs for collection, product, and cart views, plus a small token/component sheet. Include long German text, sold-out and unavailable states, an empty result, stock errors, loading, and visible focus. Export reviewable PNG/SVG/PDF evidence alongside the Figma link so the public repository remains understandable without Figma access.

Write English and German content for the home page, category introductions, 24 products, reusable guides, FAQ, buying guide, and delivery information. The store must clearly identify itself as a fictional demonstration using test orders. Use sample policies with an explicit demonstration context; do not present them as production legal advice or actual shipping promises.

## 5. Catalog and data model

Seed exactly 24 active Brewbench products:

| Group | Count | Working product names |
|---|---:|---|
| Brewers | 5 | Cone Brewer; Flatbed Brewer; Immersion Brewer; French Press; Travel Brewer |
| Grinders | 4 | Burr Hand Grinder; Compact Hand Grinder; Precision Hand Grinder; Travel Hand Grinder |
| Kettles | 3 | Gooseneck Kettle; Stovetop Kettle; Pouring Jug |
| Servers | 3 | Glass Carafe; Thermal Carafe; Small Glass Server |
| Filters | 5 | Cone Paper Filters 01; Cone Paper Filters 02; Flatbed Paper Filters; Reusable Cone Filter; Press Mesh Filter |
| Replacement parts | 4 | Brewer Seal Ring; Grinder Burr Set; Carafe Lid; Press Plunger |

Use six main collections: Brewers, Grinders, Kettles & Servers, Filters, Replacement Parts, Beginner Equipment. Brewing-method navigation can link to additional curated collections when needed; it must not pretend to be multi-facet filtering.

Model native commerce in native fields: product title/description/media/SEO, category, variants/options, SKU, price, weight, inventory policy, inventory quantity, and channel publication. Use tracked inventory with overselling disabled for the relevant test variants.

Use merchant-owned `brewbench` fields because content must remain shared between the theme, setup scripts, Shopify plugin, and future merchant tools. Create definitions first, then values, then read back/render them. This is a store-content model, so app-owned TOML definitions are not the default. See [custom-data evidence](FEASIBILITY.md#structured-content-and-translations).

| Field/object | Owner and type | Behavior |
|---|---|---|
| `brewbench.brewing_methods` | Product, list of controlled single-line text values | Method labels and curated collection membership; not assumed to enable native facets |
| `brewbench.material` | Product or variant, single-line text | Variant value overrides common product value |
| `brewbench.capacity_ml` | Variant when size varies, integer | Localized unit label; omit for products where capacity is irrelevant |
| `brewbench.care` | Product, rich text | Optional accordion; no empty headings |
| `brewbench.compatible_variants` | Variant, list of variant references | Explicit fit relationship; only currently purchasable references receive add buttons |
| `brewbench.guide` | Product, metaobject reference | Shared guide or no guide section |
| `brewbench.beginner_friendly` | Product, boolean | Curated beginner collection membership |
| Brewing guide | Merchant-owned metaobject | Title, introduction, ordered step references, optional equipment references |
| Guide step | Merchant-owned metaobject | Heading, body, optional duration/image with accessible text |
| Delivery information | Merchant-owned metaobject or shared page content | Country key, sample service wording, expected checkout-currency wording |

Enable storefront access and appropriate published/active status for displayed custom content. The seeder must resolve symbolic handles/SKUs into store-specific IDs rather than checking production IDs into fixtures.

The first representative set is the two-size Cone Brewer, both matching paper-filter products, and one grinder, with a shared guide. Expand only after confirming that each size recommends the correct sellable filter variants.

Required edge cases: one sold-out variant; one unavailable option combination; one long German title; a product with one image; no optional guide; a size-specific compatibility change; one product excluded from the UK catalog; and one out-of-stock compatible item.

Generated Shopify sample products must be inventoried and archived/unpublished through the API on the new dedicated store so they do not leak into search or navigation. Record their prior state. Do not delete or alter resources in the previously connected shop.

Data tooling must support schema validation, dry-run diffs, repeatable upserts, pagination, API cost throttling, retry limits, mutation `userErrors`, media-processing waits, and dependency ordering. Inventory resets are explicit QA operations, not a side effect of rerunning the content seeder. A second unchanged seed must not duplicate resources or undo test stock changes. For API 2026-10, inventory writes require persisted field-level `@idempotent` keys and absolute quantity updates use `changeFromQuantity`. Inspect existing inventory activation before initializing stock. Market region inputs are one-of: use `regions` without also specifying `applicationLevel`. These requirements were verified during preflight; do not copy older examples unchanged.

## 6. Theme behavior

Implement six substantial reusable components:

| Component | Acceptance |
|---|---|
| Editorial hero | Editable copy, image, link, mobile crop; useful empty-image behavior |
| Shop by brewing method | Configurable cards and collection destinations; localized labels |
| Product specifications | Product/selected-variant data, clear units, no empty rows |
| Compatible products | Exact selected-variant fit, availability handling, correct quick-add payload |
| Brewing guide | Shared structured content, valid headings, optional steps/images |
| FAQ | Configurable questions/answers and keyboard-accessible disclosure behavior |

Build home, collection, product, search, cart drawer and cart page, buying guide, delivery information, FAQ/policy content, and a useful 404 page. Retain essential Dawn semantics, responsive images, native navigation and structured data. Document which behavior comes from Dawn and which is original work.

Collection/search behavior must include native sorting, server pagination, URL-driven navigation, back/forward restoration, useful zero results, and long-title/missing-media handling. Use a small page size in QA so the 24-item catalog exercises multiple pages. If Shopify returns enabled native filters, support their selected-state and clear-all behavior. Otherwise omit the filter UI and explain the scope in developer documentation. Never filter only the currently rendered page and label that a catalog-wide result.

Trace Dawn's product-form/cart code before extending it. Handle rapid variant changes without stale rendering. Keep price, SKU, image, availability, capacity, compatibility, selected URL variant, and add-to-cart input synchronized. Wrong or sold-out combinations cannot be submitted as a different available variant.

Use locale-aware Ajax Cart requests and section rendering. Cart lines are addressed by the appropriate line key when properties/discounts could split a variant into multiple lines. Recover from stock errors, failed requests, and repeated clicks. Shopify's cart response determines quantities and totals; client code never invents prices or successful additions.

Use unique section-scoped IDs and component lifecycle cleanup. Verify duplicate section instances and replacement DOM by publishing test configurations; record that the actual Shopify theme editor was not exercised.

## 7. Markets and language behavior

Create/adjust market regions, market catalog availability, and delivery profiles using supported Admin GraphQL operations. A market label alone is insufficient: verify both product publication and a valid shipping rate for the selected delivery country.

| Country | Primary QA language | Payment expectation |
|---|---|---|
| Austria | German | Verified store currency; EUR target |
| Germany | German | Same store currency, distinct shipping configuration |
| United Kingdom | English | Same store currency, explicit currency label and distinct shipping configuration |

Publish both English and German. Use Shopify localization forms, localization objects, locale-aware URLs, translated native resources, and Liquid money formatting. Keep the store's actual primary locale. Translation scripts must fetch current source digests and flag stale translations after content changes.

A market switch must re-read price, availability and cart state. Compare the returned cart with its previous contents and explain any platform-enforced changes. Do not silently remove items in theme code; explain when an item is no longer purchasable and provide a removal action if required. Compatible-product recommendations must also respect country availability.

The required cross-market test begins with a larger brewer in German, adds its matching filters, switches country to GB and language to English, checks the actual currency, reviews cart eligibility, selects the UK delivery rate, and completes a test checkout.

Use the `myshopify.com` environment without a purchased domain. Check title/description, canonical URL, structured data, and whatever language alternates Shopify actually emits. Country-specific domains/subfolders and search-engine indexing are outside this release.

## 8. Measurement and CRO

The measurement deliverable must distinguish three things: observed theme interactions, Shopify customer-event payload mappings, and synthetic analysis. They are not interchangeable.

| Behavior | Core evidence | Mapping specification |
|---|---|---|
| Product viewed | Browser-visible storefront instrumentation | `product_viewed` to GA4 `view_item` |
| Successful cart addition | Successful cart response and one instrumented event | `product_added_to_cart` to `add_to_cart` |
| Checkout link activated | Theme event named as a checkout click | Not proof that `checkout_started` occurred |
| Checkout started | Browser journey plus fixture mapping unless a pixel is available | `checkout_started` to `begin_checkout` |
| Purchase completed | Actual test-order confirmation; separately fixture-tested pixel mapping | `checkout_completed` to `purchase` |

Define identifiers, quantities, unit prices, currency, event/transaction IDs, country, locale, release version, experiment context, consent status, and deduplication rules. Keep tax/shipping separate from the chosen purchase-value convention. No email, postal address, phone number, customer name, full URL query string, or raw checkout token in analytics fixtures or logs.

Implement a theme-side consent UI using the Customer Privacy API. Require affirmative analytics consent as well as the API's allowed state before Brewbench analytics storage/emission. Do not auto-submit consent for a visitor. Test accept, reject, ignored banner, withdrawal, storage failure, and API-load failure. Shopping must work in every state.

Use a local/in-browser QA recorder and export sanitized test events. Shopify standard storefront DOM events and its development inspector may assist theme QA, but they are not Web Pixel customer events and do not prove purchase tracking. Do not add GTM, a Google channel, an external collector, custom pixel installation, or a separate backend to this core scope.

Implement the compatibility CRO experiment with these fixed rules:

- Both groups retain essential fit information. Treatment adds a prominent compatible-filter module near the purchase controls.
- Only brewer variants with valid recommendations are eligible.
- A consented visitor receives stable assignment for the experiment version; persist a random identifier only after consent. Without consent, show the standard experience and exclude that visit from analysis.
- A QA override selects control/treatment and marks the resulting exposure as test traffic.
- Use the same visible purchase-region trigger for both groups, after the assigned experience has rendered. Emit exposure once per eligible visitor/product/experiment version. Do not require scrolling to different locations in control and treatment, and do not count assignment alone as exposure.
- Use a theme setting as the kill switch and a documented expiry for assignment data.
- Avoid hiding the purchase controls while assigning, layout jumps, and unexpected reassignment after a navigation.

Primary metric: distinct eligible exposed visitors who successfully add the viewed brewer divided by distinct eligible exposed visitors. Secondary measures: compatible-filter attachment and synthetic purchase conversion. Guardrails: errors, interaction latency, layout shift, and sample-ratio imbalance.

Generate a deterministic synthetic dataset with market, device, visitor/session, timestamp, release, consent, exposure, and event fields. Include the UK-mobile anomaly, duplicates, missing events, and excluded traffic. Calculate an illustrative sample size from documented baseline/effect assumptions; set a duration and stopping rule. Report synthetic findings without claiming real conversion improvement.

## 9. QA, troubleshooting, and release

Automate consequential failures: incompatible variant added, stale selection after rapid changes, cart quantity/removal mismatch, stock error recovery, broken locale links, absent shipping rates, and wrong market availability. Unit-check manifest integrity, compatibility resolution, event mapping/deduplication, consent gating, and experiment assignment.

Provide documented local commands for Theme Check, formatting/linting, data validation and unit checks. Run them before release and record the commit and results in the QA report. Run authenticated Playwright storefront tests from the prepared machine, with Chromium, Firefox, and WebKit where supported. Use desktop and narrow-mobile profiles. A browser-engine run is not a claim of real-device coverage; document unavailable real-device testing. No checks run in CI.

Evidence must cover keyboard navigation, cart focus/escape behavior, error announcements, contrast, zoom/reflow, long German copy, missing images, and reduced motion. Automated accessibility checks supplement task-based keyboard review.

Record repeatable home/collection/product performance baselines and follow-up measurements, including theme version, device/network profile, caching, password/preview context, and median of repeated runs. Measure the actual storefront, not the password screen. Fix an observed bottleneck and report the measured result; do not manufacture a regression or claim improvement beyond measurement noise. Lab results are not field Core Web Vitals evidence.

Complete three controlled incident exercises, each with before/fix/after evidence:

1. Theme defect: large brewer selection adds the small variant.
2. Configuration defect: UK shipping rate missing, introduced/restored through the API on the dedicated store.
3. Tracking defect: duplicate or suppressed add-to-cart/exposure events, introduced in a test branch/fixture.

Each report includes symptom, scope, reproduction, hypotheses, evidence, root cause, correction, verification, and a brief stakeholder update. Label intentionally introduced defects and synthetic evidence. Remove faults before release.

Release flow: feature branch, reviewable PR, recorded passing local checks, unpublished Shopify theme, storefront QA, release tag, CLI publish to the dev store, smoke test. Do not require remote CI statuses for the PR. Keep the preceding theme version for rollback. Rehearse republishing it, then restore the intended release. Record theme IDs privately and release commits publicly.

Theme rollback does not roll back store data. Maintain a separate non-sensitive change ledger and selective restoration procedure for products, translations, inventories, catalogs, and shipping configuration. Do not bulk-replace current store data with an old snapshot.

## 10. Continuous implementation order

| Stage | Work | Exit evidence |
|---|---|---|
| 0: Access readiness | Complete the preflight above | Usable dev store, authenticated preview/checkout, chosen capability profile, design access resolved |
| 1: Foundation | Public repository, Dawn baseline, design system/screens, local check commands, source manifests | Reproducible project and reviewed design states |
| 2: Vertical slice | Representative products, one shared guide, exact compatibility, native cart | Correct brewer/filter test order |
| 3: Complete storefront | Remaining products, six components, pages, search/discovery, responsive UI | All three customer journeys pass in baseline country |
| 4: Localization | English/German, three countries, delivery and catalog differences | Market/language QA matrix and cross-market test order |
| 5: Measurement | Consent, storefront events, mappings, experiment, synthetic analysis | Both treatments work and evidence levels are explicit |
| 6: Quality and operations | Performance, accessibility, browser tests, app memo, three incidents | Reproducible reports and no remaining release-blocking defects |
| 7: Delivery | PR/release, publish, smoke test, rollback rehearsal, recording, handover | Public repository and complete evidence package |

There are internal checkpoints, but no planned multi-week handoffs or optional extensions left to decide during implementation. Authentication expiry or an external service failure can still interrupt a run; the capability gate reduces that risk and cannot eliminate it.

## 11. Definition of complete

The adjusted core is complete only when:

- The public GitHub repository contains the working theme, source manifests, setup tools, tests, licenses/notices, documentation, and release tag.
- Local validation and storefront test results are recorded for the release; the project contains no CI workflows or CI-dependent release steps.
- The dedicated Shopify dev store serves the intended theme and 24 independent products, with no sample-catalog leakage.
- A real browser journey reaches a successful Shopify test order; an API-created order is not counted as this evidence.
- Six components work, selected variants and fit recommendations are correct, and cart errors recover.
- English/German and the three country/shipping cases pass in the documented supported currency configuration.
- The consent-aware experiment and storefront instrumentation work; fixture-only customer-event verification is clearly identified.
- Figma deliverables or an explicitly agreed substitute, data dictionary, QA matrix, analysis, performance report, app memo, three incidents, and release/rollback evidence are present.
- A short recording shows a customer journey, an API-driven shared-content edit, a market/language change, a measured optimization, and one diagnosed defect.
- The README gives exact reproduction steps, the supported environment, and the intentional scope reductions without implying untested capabilities.

No feature listed as required may be silently replaced with a mock, TODO, or fabricated success. Access prerequisites must be settled before this definition can be promised in one continuous implementation.

# Brewbench feasibility research

Checked 23 October 2026 against current official Shopify, Google, Figma, and upstream GitHub sources. The initial research preceded store setup. Subsequent observed setup checks and changes are recorded in the [preflight report](PREFLIGHT_REPORT.md); the table below preserves the initial baseline. No public repository has been created yet.

## Local and connected state at the start of research

| Check | Observed result | Consequence |
|---|---|---|
| Workspace | Empty; no Git repository or existing project instructions found | Start from a clean project |
| Node / Git / GitHub CLI | Node 24.19.0, Git 2.53.0.windows.2, gh 2.88.1 | Basic local prerequisites present |
| Shopify CLI | Not found on PATH | Install/pin during setup |
| Current published CLI | Registry returned 4.9.4, Node requirement >=22.12.0 | Local Node is suitable |
| GitHub identity | `fullstack-nick`; proposed `brewbench` repository lookup returned 404 | Repository creation remains future work; no existing repo was found at that path |
| Shopify plugin | `get_shop_info` returned `operation_not_allowed`: connected shop unavailable for API access | Current store domain, plan, scopes, and configuration could not be verified |
| Figma | Connected; Starter plan with View seat; no Code Layers entitlement | Do not assume editable Drafts access or unlimited read calls; verify before implementation |
| Developer organization | User says none exists | Initial developer enrollment is a prerequisite |

The Shopify error suggests resolving billing or plan access as possible remedies; it does not establish the actual cause. A new dedicated dev store is the recommended route. Plugin tools existing in the tool catalog does not prove the connection has all scopes they need.

## Capability matrix

“Supported” below means an official API/CLI path exists, subject to authentication, permissions and the actual store. It is not a claim that a write was tested here.

| Area | Code/API/CLI route | Admin boundary | Chosen treatment |
|---|---|---|---|
| Developer enrollment | No supported organization-creation CLI route found | Initial account/organization enrollment | One-time exception completed; organization/dev-store creation verified |
| Create dev store | Shopify CLI `store create dev` | Requires existing eligible organization | Use CLI with generated test data |
| Catalog, variants, inventory, collections | Plugin tools and Admin GraphQL | Scopes, locations, publications | Core |
| Images/files | Plugin upload capability, or supported staged file upload APIs | File hosting and processing | Core; verify upload before bulk seeding |
| Metafields/metaobjects | Admin GraphQL definitions and values | Storefront visibility, ownership and capabilities | Core, merchant-owned |
| Pages/navigation | Admin GraphQL page/menu operations | Access scopes | Core |
| Theme files and publishing | Shopify theme CLI | Owner authentication | Core; no editor clicking |
| Native search | Shopify storefront search and Dawn UI | App customizations are separate | Core |
| Native facet configuration | Documented Search & Discovery setup is in admin | No supported public filter-configuration write path identified | Exclude setup; support only returned, already-enabled filters |
| Custom discovery | Collections, menus, links and native sorting | No special app | Core replacement for missing facets |
| Additional locales/translations | Locale and Translations APIs | Primary locale cannot be changed through Admin GraphQL | Core with existing primary locale |
| Markets and catalog availability | Markets/catalog/publication APIs | Permissions and plan | Core, verify on target |
| Shipping profiles/zones/rates | Delivery Profile APIs | Permissions and inventory locations | Core |
| Test payments | Gateway preconfigured with generated test data | Later provider activation/configuration uses admin | Use generated-data store and verify actual checkout |
| GBP payment | Requires eligible multi-currency processor | Payment setup and possibly eligibility verification | Excluded; single actual store currency |
| International domain structure | Web-presence configuration after obtaining a custom domain | Domain purchase/connect/verification | Excluded |
| Custom pixel script | Customer Events UI | No public custom-pixel code management API found | Excluded installation |
| App Web Pixel | App extension + app-owned `webPixelCreate` | App install/scopes; not arbitrary script injection | Technically available but not required for adjusted core |
| Analytics/consent/CRO | Theme instrumentation, Customer Privacy API, fixtures | Hosted checkout is outside theme JS | Core with explicit evidence limits |
| Theme-editor QA | Actual editor UI | Forbidden by chosen constraint | Deliver schemas; mark editor exercise unverified |
| App evaluation | Official documentation/listing | Installation/settings/uninstall | Research memo only |
| Automated checks | Documented local tools and test commands | None for offline checks | Core; run locally and record results, no CI |
| Theme deployment and rollback | Authenticated local Shopify CLI | Owner authentication | Core; no CI deployment or remote status requirement |
| Flow / Functions / checkout extension / webhooks / scale | Separate apps, APIs or services | Additional activation/hosting/plan concerns | All excluded by user's core-only decision |

## Development-store creation and payments

Shopify CLI 4.8 introduced dev-store creation. Current documentation exposes plan, organization, country and demo-data options. An existing developer organization with appropriate store-creation permission is required. Dev stores are test-only, password protected, and cannot become production stores. [Store-creation announcement](https://shopify.dev/changelog/posts/create-and-delete-dev-stores-in-shopify-cli), [dev-store requirements](https://shopify.dev/docs/apps/build/stores/development-stores), [command reference](https://shopify.dev/docs/api/shopify-cli/store/store-create-dev).

Crucially, Shopify's generated-test-data documentation explicitly lists the Bogus payment gateway as enabled. This makes generated data useful even though Brewbench needs its own catalog. Create with test data, retain the gateway, and archive the sample products through the API. The checkout must still be verified on the created store. [Generated configurations](https://shopify.dev/docs/apps/build/stores/generated-test-data).

Current help documentation calls the test provider “Test payment gateway.” It supports simulated outcomes and does not accept real card details. Manual payment methods are not a substitute for test mode. Use an `@example.com` email for test purchases. [Payment testing](https://help.shopify.com/en/manual/checkout-settings/test-orders/payments-test-mode), [processing test orders](https://help.shopify.com/en/manual/checkout-settings/test-orders/processing-test-order).

There is a documentation inconsistency: the theme-dev-store guide mentions `--with-demo-data`, while the current command reference and CLI 4.9.4 source use `--demo-data`. Discover flags from the installed version before running. [CLI 4.9.4 implementation](https://github.com/Shopify/cli/blob/4.9.4/packages/store/src/cli/commands/store/create/dev.ts).

## Authentication and storefront access

`store auth` requests scopes and persists an online token. Its official implementation opens a browser and refuses the flow with `--no-input`; a sign-in/consent exception is necessary when there is no usable session. This exception has been granted by the user. [Command documentation](https://shopify.dev/docs/api/shopify-cli/store/store-auth), [CLI authentication source](https://github.com/Shopify/cli/blob/4.9.4/packages/store/src/cli/services/store/auth/index.ts).

Developer-organization enrollment is a different operation. The inspected release has an organization-list command but no organization-create command. Official onboarding points users to account registration. This supports a **research conclusion**, not a claim about every private Shopify system: no supported CLI route for initial enrollment was found. [Partner enrollment](https://help.shopify.com/en/partners/faq/partner-program), [official CLI source tree](https://github.com/Shopify/cli/tree/4.9.4/packages/app/src/cli/commands/organization).

The user approved and completed this one-time enrollment exception. Organization listing and CLI dev-store creation subsequently succeeded. A separate one-time read-only password lookup was approved and completed by the user when the automated Preferences panel stalled.

API authentication, storefront password access, and checkout-capable browser authentication are different. The dev-store creation result does not expose a storefront password. CLI theme development has a separate storefront-password option and can prompt for it. Official guidance for viewing/setting that password uses the admin. Treat usable customer-facing access as a real gate, not something inferred from a successful API request. [Dev-store access](https://shopify.dev/docs/storefronts/themes/tools/development-stores), [theme dev](https://shopify.dev/docs/api/shopify-cli/theme/theme-dev), [creation result schema](https://github.com/Shopify/cli/blob/4.9.4/packages/organizations/src/cli/services/dev/types.ts).

Shopify distinguishes visitor previews from merchant previews: the former expire after two days; the latter require admin authentication, have checkout access, and expire after thirty days. Use approved sign-in for a supported merchant-preview test session where possible; do not promise a permanent public working checkout link. A development server alone is not an offline Shopify emulator. [Theme previews](https://help.shopify.com/en/manual/online-store/themes/adding-themes#theme-preview).

## Theme deployment

CLI supports theme development, upload, sharing and publishing using Shopify-account authentication. Generic Admin GraphQL `themeFilesUpsert` additionally calls for `write_themes` and a Shopify exemption, so plugin GraphQL is not a safe assumed route for theme deployment. [Theme CLI authentication](https://shopify.dev/docs/storefronts/themes/tools/cli), [theme file mutation requirements](https://shopify.dev/docs/api/admin-graphql/latest/mutations/themeFilesUpsert).

The user explicitly excluded CI. Run validation, storefront tests, deployment and rollback locally. Do not add workflow files, inherit Dawn's upstream workflows, or require remote status checks. This also removes any need to provision a CI deployment credential.

## Filtering

The official storefront-filtering guide says filters must exist in the admin before URL parameters can apply them. Liquid and Storefront API filter objects render/query configured filters; they do not configure Search & Discovery. Creating a metafield definition does not turn it into an active storefront facet. [Storefront filtering](https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering).

Search & Discovery's current documentation also specifies that price filters are unavailable outside the shop's default currency, product tags/vendor values have translation limitations, and collections over 5,000 products do not show filters. The revised core does not need to approach those size limits, but must avoid untranslated tag-based customer navigation and fake foreign-currency price sliders. [Filter requirements and behavior](https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-filters).

Chosen compromise: retain good product discovery through curated collections and sorting. Do not build a parallel search backend or a current-page-only filter just to imitate the excluded admin configuration.

## Structured content and translations

Shopify distinguishes app-owned data from merchant-owned data. Merchant-owned fields can be shared across apps and are defined with GraphQL, which fits theme content managed by both the plugin and source-manifest scripts. The shared brewing guides follow the same ownership rationale. Always define, populate, then retrieve/verify. [Metafield ownership](https://shopify.dev/docs/apps/build/metafields).

Additional languages can be enabled/published and resource translations registered through APIs. The shop's primary locale cannot be changed with Admin GraphQL. Translate supported fields using current content digests; do not assume product tags are translatable. Version 2026-10 introduces the `Metafield.translatable` field and changes how translatable metafields are discovered. [Translation workflow](https://shopify.dev/docs/apps/build/markets/manage-translated-content), [2026-10 changes](https://shopify.dev/changelog/release-notes/2026-10).

## Markets, currency, and delivery

Current Markets APIs support regional conditions, currencies, catalogs, and web presences. Catalogs use publications for availability and price lists for contextual pricing. Delivery profiles can define location groups, country zones, products, and rates. This is a documented code route for country-specific availability and shipping; it still requires target-store verification. [Markets](https://shopify.dev/docs/api/admin-graphql/latest/mutations/marketCreate), [catalogs](https://shopify.dev/docs/api/admin-graphql/latest/mutations/catalogCreate), [delivery profiles](https://shopify.dev/docs/api/admin-graphql/latest/mutations/deliveryProfileCreate).

Actual multi-currency payment requires Shopify Payments or Adyen; otherwise payments use the store default currency. Market activation also depends on configured shipping destinations. Market-specific theme customization requires Advanced or higher, so the chosen Basic dev store uses shared templates and explicit localization logic. [Markets requirements](https://help.shopify.com/en/manual/markets/getting-started/requirements-and-considerations).

The AT country flag is a setup preference, not proof of EUR currency or German-primary configuration. Read these values after creation. No supported general shop-currency setter was identified in this research. Retaining the store's real currency is the recommended technical fallback under the user's permission to adjust scope.

International country domains/subfolders require a custom domain; they cannot be created from the shop's `myshopify.com` domain. Ordinary language selection remains a separate concern. [International domains](https://help.shopify.com/en/manual/international/managing-international-domains).

## Analytics and experiment boundaries

Custom pixels are configured through Customer Events in the admin. App Web Pixels are a different integration: developer app code, extension configuration, installation/scopes and a `webPixelCreate` call for that app. The Shopify plugin cannot be assumed to own or configure an unrelated custom app's pixel. [Build web pixels](https://shopify.dev/docs/apps/build/marketing/build-web-pixels), [pixel activation API](https://shopify.dev/docs/api/admin-graphql/latest/mutations/webPixelCreate).

Shopify's GA4 guide says analytics cannot track until private mode is disabled, and Pixel Helper documents its own private-mode limitation. This prevents making either tool a mandatory dev-store completion requirement. It does **not** prove that every form of event testing is impossible on dev stores. [GA4 setup](https://help.shopify.com/en/manual/reports-and-analytics/google-analytics/google-analytics-setup), [Pixel Helper limitations](https://help.shopify.com/en/manual/promoting-marketing/pixels/custom-pixels/testing).

There are two similarly named event systems: storefront DOM events such as `shopify:cart:lines-update`, and sandboxed Web Pixel customer events such as `product_added_to_cart`. The CLI standard-events inspector concerns the first system. Neither a theme checkout click nor an inspector entry proves that a customer-event purchase pixel fired. [Storefront event dispatch](https://shopify.dev/docs/api/storefront-events-and-actions/events/dispatch), [customer events](https://shopify.dev/docs/api/web-pixels-api/standard-events).

The `checkout_completed` event depends on the relevant page loading; it is not a guaranteed financial record for every completed order. Preserve this distinction even in future live integrations. [Purchase event behavior](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_completed).

The Customer Privacy API can power a theme-side consent UI and apply visitor choices to Shopify-managed surfaces. Its allowed-state methods incorporate store configuration and geography; Brewbench adds an explicit-affirmative-consent requirement for its own logger. [Customer Privacy API](https://shopify.dev/docs/api/customer-privacy).

GA4-compatible fixtures should include item identifiers, quantities, currency and the appropriate transaction/value fields. An actual integration would need one owner for ecommerce events to avoid duplicate reporting. The adjusted core supplies specifications and tested transformations, not a claim of a working GA4 property. [Google ecommerce specification](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

## Versions, licensing, and public source

The latest Dawn release observed was v16.0.0. Its change list removes legacy account templates and adopts the newer customer-account experience. Pin the tag/commit and avoid unreleased `main`. [Dawn release](https://github.com/Shopify/dawn/releases/tag/v16.0.0).

Dawn's license grants modification/publication rights subject to Shopify-use/distribution conditions and preserving notices. Do not replace its license with an MIT header or advertise the derived theme as unrestricted software for other platforms. Publish the Shopify-specific practice source with upstream notices and clearly scoped licensing for original work. [Exact upstream license](https://github.com/Shopify/dawn/blob/v16.0.0/LICENSE.md), [upstream development guidance](https://github.com/Shopify/dawn).

The latest stable Admin API observed is 2026-10. Schema and scope validation remains necessary; a plugin may use a different backend version than a directly pinned script. Do not assume a field found on `unstable` exists in this project's version. [Release notes](https://shopify.dev/changelog/release-notes/2026-10).

## Design and performance evidence

Figma native file creation and a page edit subsequently passed in an owned Drafts file; see the preflight report for its link. Current published limits for View/Collab seats are up to twenty read-tool calls per month; some writing tools are exempt from those rate limits, while actual file permissions still apply. The account's View seat did not prevent this verified write. [Figma access and limits](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/).

Use repeatable lab performance measurements. The familiar LCP <=2.5 s, INP <=200 ms and CLS <=0.1 targets concern the 75th percentile of real visits; a small test store has no basis for claiming real-user field performance. Lab TBT is not a substitute measurement of field INP. [Web Vitals](https://web.dev/articles/vitals).

## Excluded extensions researched for completeness

Flow's documented creation/import/activation route uses its app UI; its ability to call Admin GraphQL does not imply a public workflow-authoring API. Custom-app Functions require Plus; checkout UI extensions in the information/shipping/payment steps also require Plus and may require editor placement. These are unnecessary for the user-selected core scope. [Flow management](https://help.shopify.com/en/manual/shopify-flow/manage/manage), [Functions availability](https://shopify.dev/docs/apps/build/functions), [checkout extension testing](https://shopify.dev/docs/apps/build/checkout/test-checkout-ui-extensions).

A future persistent webhook/analytics service would additionally need deployment, HTTPS, token lifecycle management, signature verification, retry/deduplication handling, and operational ownership. Those costs and setup tasks are intentionally absent from this release.

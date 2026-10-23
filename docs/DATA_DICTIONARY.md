# Data dictionary

The fixtures contain 24 products and 26 variants. Handles and SKUs are stable source identities. Shopify GIDs, file URLs, publication IDs, theme IDs and inventory initialization markers live in the ignored `.local/store` ledger.

| Field | Owner / type | Purpose and validation |
|---|---|---|
| `handle`, `title`, `description`, `group` | Native product | Unique handle; English/German copy; native category resolved separately from product type |
| `options`, `variants[].options` | Native product/variant | Ordered exact combination; duplicates and missing option values rejected |
| `sku`, `price`, `weightGrams` | Native variant/inventory item | Unique SKU; positive EUR decimal price; grams; tracked and shipping required |
| `initialStock` | Initial inventory fixture | Set once with compare quantity and an idempotency key; zero means sold out; overselling denied |
| `excludeCountries` | Market publication manifest | Thermal Carafe excluded from GB; enforced through the UK catalog |
| `brewbench.brewing_methods` | Product / list of single-line text | `pour-over`, `immersion`, `travel`; useful structured data, not a configured filter |
| `brewbench.material` | Product / single-line text | Translatable product material; optional variant definition is reserved for overrides |
| `brewbench.capacity_ml` | Variant / integer | Positive millilitres; omitted where not meaningful |
| `brewbench.care` | Product / rich text | Translatable care content |
| `brewbench.compatible_variants` | Variant / list of variant references | Resolved from `compatibleSkus`; references exact SKU, never a product-level guess |
| `brewbench.guide` | Product / metaobject reference | One shared, active, public brewing guide |
| `brewbench.beginner_friendly` | Product / boolean | Editorial classification used to build the beginner collection |
| `brewbench_guide_step` | Metaobject | Heading, multiline body, positive duration in seconds; translatable |
| `brewbench_brewing_guide` | Metaobject | Title, introduction, ordered step references and equipment product references; translatable |

Cone Brewer 01/Chalk costs €32 and references Paper Filters 01. Cone Brewer 01/Olive exists but is out of stock. Cone Brewer 02/Chalk costs €38, has 500 ml capacity and references Paper Filters 02 plus the sold-out reusable filter. The 02/Olive combination does not exist. This exercises the difference between an unavailable combination and an existing sold-out variant.

Nine curated collections express group, method and beginner discovery. The source list is authoritative for membership. The Shopify 2026-10 collection source API is used for create/update; passing the legacy `products` field to collection update is not supported. Five bilingual pages cover buying advice, delivery, FAQ, privacy and demo terms. Prices are explicit test values; demo tax is not calculated and no real tax treatment is claimed.

`npm run data:validate` checks the JSON schema, option combinations, unique SKUs/handles, compatibility and guide/collection references, and local image availability. `npm run store:verify` reads native categories, prices, media readiness, exact relationships, guides, German titles, collection membership and menus back from Shopify. `node scripts/store/geography.mjs verify` checks markets, three delivery rates and UK catalog membership.

Do not edit private resource IDs into manifests. Do not run `store:inventory-reset` as part of an ordinary seed. Before any destructive migration, take a private snapshot and write a narrowly scoped migration; theme rollback cannot roll back product or shipping data.

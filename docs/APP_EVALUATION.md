# Search & Discovery evaluation

Reviewed 23 October 2026. Decision: do not install an app in the core release.

Shopify's [Search & Discovery listing](https://apps.shopify.com/search-and-discovery) is free and supports filters, synonyms, product boosts, recommendations and discovery analytics. Those capabilities could improve a larger real catalog, especially searches that use different terms from product titles. The value should be tested against actual search failures rather than inferred from an app listing.

The documented [filter setup workflow](https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-filters) uses the Shopify admin. A metafield definition alone does not enable a customer-facing facet. The public Liquid/API filter objects read configured filters; no supported public configuration write path was identified for this project. That conflicts with the agreed no-admin workflow, so setup is excluded.

Brewbench uses curated category/method collections, eight-item server pagination, native sorting, native search and explicit variant-reference recommendations. It retains Dawn's native facet rendering if the platform returns enabled filters, and does not imitate global filtering by hiding cards on the current page.

No app was installed or uninstalled, so there is no measured app performance impact. The [performance report](PERFORMANCE.md) measures actual theme changes. If the constraint changes later, first record route-specific baseline payloads/timings, install in a dedicated test theme/store, evaluate relevant filter and search tasks, inspect network/consent behavior, and retain the app only if the demonstrated benefit outweighs the added complexity. Removal would need its own read-back and asset/embed cleanup checks.

# Brewbench design source

[Editable Figma file](https://www.figma.com/design/NjRmHGtjzq5QlDZSGOcVHW) · [local tokens](tokens.json) · [original imagery provenance](assets/provenance.json)

The native file contains foundations, reusable components and desktop/mobile collection, product and cart screens, plus interaction states. Text, images, auto-layout containers, variables and component instances remain editable. `exports/` provides public PNG evidence for reviewers without Figma access.

Warm paper, olive, sage, Lora headings and DM Sans body copy define the visual system. Semantic color variables alias primitives; text styles and spacing/radius variables are bound in the file. Self-hosted font licenses are in `licenses/`. Component variants cover default, focus, loading, disabled, sold-out, missing-photo and long-German-copy examples.

| Design | Implementation |
|---|---|
| Collection cards/navigation | Dawn cards + `bb-collection-nav`, collection templates |
| Product options and purchase | Dawn product form with atomic variant response updates |
| Exact filter fit panel | `bb-compatible-products` + consented treatment styling |
| Specifications/shared guide/FAQ | `bb-specifications`, `bb-guide`, `bb-faq` |
| Cart and order summary | Native Dawn cart sections/drawer; authoritative server totals |
| Tokens | `theme/assets/bb-theme.css` and `tokens.json` |

The screens document the intended visual and content hierarchy; Shopify's native controls, live price formatting, legal/demo copy and actual responsive layout are verified in storefront screenshots separately. The product screen shows the treatment state. The standard state retains the same essential fit information.

All 24 product images and the editorial hero are original generated illustrations. WebP is used on the storefront; JPEG copies were uploaded to Figma because its export renderer did not display the uploaded WebP fills reliably. No flattened webpage screenshot is used as a substitute for editable screen layers.

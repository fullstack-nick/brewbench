import { readFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  graphql,
  paginate,
  json,
  save,
  privateDir,
  store,
  pause,
} from "./client.mjs";
import { validateData } from "../validate-data.mjs";

export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const richText = (text) =>
  JSON.stringify({
    type: "root",
    children: [
      { type: "paragraph", children: [{ type: "text", value: text }] },
    ],
  });
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const html = (s) => `<p>${escape(s)}</p>`;
const command = process.argv[2] || "plan";
const slice = process.argv.includes("--slice");
const allowed = ["plan", "apply", "verify", "snapshot", "inventory-reset"];
if (!allowed.includes(command))
  throw new Error(`Use one of: ${allowed.join(", ")}`);
const manifest = await validateData({ assets: command !== "plan" });
const selected = slice
  ? manifest.products.filter((p) =>
      [
        "cone-brewer",
        "cone-paper-filters-01",
        "cone-paper-filters-02",
        "burr-hand-grinder",
        "reusable-cone-filter",
        "grinder-burr-set",
      ].includes(p.handle),
    )
  : manifest.products;
const statePath = join(privateDir, "state.json");
const state = await json(statePath, {
  store,
  hashes: {},
  resources: {},
  inventoryInitialized: {},
  idempotency: {},
  changes: [],
});
if (state.store !== store)
  throw new Error(
    "Local state belongs to a different store. Use a separate workspace.",
  );
const environment = await graphql("environment");
if (
  environment.shop.myshopifyDomain !== store ||
  environment.shop.currencyCode !== "EUR"
)
  throw new Error("Unexpected store or currency. Refusing writes.");
let products = await paginate("products", "products");
if (products.some((p) => p.variants.pageInfo.hasNextPage))
  throw new Error(
    "Nested variant pagination needs expansion; refusing incomplete snapshot.",
  );
const existing = new Map(products.map((p) => [p.handle, p]));
const persist = () => save(statePath, state);
async function changed(key, source, action, before = null) {
  const digest = hash(source);
  if (state.hashes[key] === digest) return state.resources[key];
  const result = await action();
  state.hashes[key] = digest;
  state.resources[key] = result;
  state.changes.push({
    at: new Date().toISOString(),
    key,
    before,
    after: result,
  });
  await persist();
  return result;
}
async function translate(id, values) {
  const source = await graphql("translation-read", { resourceId: id });
  if (!source.translatableResource)
    throw new Error(`Resource not translatable: ${id}`);
  const translations = source.translatableResource.translatableContent
    .filter((c) => values[c.key] !== undefined)
    .map((c) => ({
      locale: "de",
      key: c.key,
      value: values[c.key],
      translatableContentDigest: c.digest,
    }));
  const current = new Map(
    source.translatableResource.translations.map((t) => [t.key, t]),
  );
  const updates = translations.filter(
    (t) =>
      !current.has(t.key) ||
      current.get(t.key).outdated ||
      current.get(t.key).value !== t.value,
  );
  if (updates.length)
    await graphql(
      "translation-write",
      { resourceId: id, translations: updates },
      { idempotent: true },
    );
  return source.translatableResource;
}
async function defineData() {
  const objectDefinitions = [
    {
      type: "brewbench_guide_step",
      name: "Brewing guide step",
      fields: [
        ["heading", "single_line_text_field"],
        ["body", "multi_line_text_field"],
        ["duration_seconds", "number_integer"],
      ],
    },
    {
      type: "brewbench_brewing_guide",
      name: "Brewing guide",
      fields: [
        ["title", "single_line_text_field"],
        ["introduction", "multi_line_text_field"],
        ["steps", "list.metaobject_reference"],
        ["equipment", "list.product_reference"],
      ],
    },
  ];
  const objectIds = {};
  for (const def of objectDefinitions) {
    const found = (await graphql("meta-definition", { type: def.type }))
      .metaobjectDefinitionByType;
    const fields = def.fields.map(([key, type]) => ({
      key,
      type,
      name: key.replaceAll("_", " "),
      required: ["heading", "body", "title", "introduction"].includes(key),
      ...(key === "steps"
        ? {
            validations: [
              {
                name: "metaobject_definition_id",
                value: objectIds.brewbench_guide_step,
              },
            ],
          }
        : {}),
    }));
    const obj =
      found ||
      (
        await graphql("meta-definition-create", {
          definition: {
            type: def.type,
            name: def.name,
            displayNameKey: def.type.endsWith("step") ? "heading" : "title",
            access: { storefront: "PUBLIC_READ" },
            capabilities: {
              publishable: { enabled: true },
              translatable: { enabled: true },
            },
            fieldDefinitions: fields,
          },
        })
      ).metaobjectDefinitionCreate.metaobjectDefinition;
    objectIds[def.type] = obj.id;
  }
  const defs = [
    [
      "PRODUCT",
      "brewing_methods",
      "list.single_line_text_field",
      [
        {
          name: "choices",
          value: JSON.stringify(["pour-over", "immersion", "travel"]),
        },
      ],
    ],
    ["PRODUCT", "material", "single_line_text_field"],
    ["PRODUCTVARIANT", "material", "single_line_text_field"],
    [
      "PRODUCTVARIANT",
      "capacity_ml",
      "number_integer",
      [{ name: "min", value: "1" }],
    ],
    ["PRODUCT", "care", "rich_text_field"],
    ["PRODUCTVARIANT", "compatible_variants", "list.variant_reference"],
    [
      "PRODUCT",
      "guide",
      "metaobject_reference",
      [
        {
          name: "metaobject_definition_id",
          value: objectIds.brewbench_brewing_guide,
        },
      ],
    ],
    ["PRODUCT", "beginner_friendly", "boolean"],
  ];
  for (const owner of ["PRODUCT", "PRODUCTVARIANT"]) {
    const current = await paginate("definitions", "metafieldDefinitions", {
      owner,
    });
    for (const [ownerType, key, type, validations] of defs.filter(
      (d) => d[0] === owner,
    )) {
      const found = current.find((d) => d.key === key);
      if (found && found.type.name !== type)
        throw new Error(`Definition mismatch: ${ownerType}.${key}`);
      if (!found)
        await graphql("definition-create", {
          definition: {
            name: key.replaceAll("_", " "),
            namespace: "brewbench",
            key,
            type,
            ownerType,
            access: { storefront: "PUBLIC_READ" },
            ...(validations ? { validations } : {}),
          },
        });
    }
  }
  return objectIds;
}
async function upload(media) {
  const bytes = await readFile(media.file);
  const input = [
    {
      filename: media.file.split("/").at(-1),
      mimeType: "image/webp",
      resource: "PRODUCT_IMAGE",
      httpMethod: "POST",
      fileSize: String((await stat(media.file)).size),
    },
  ];
  const { stagedTargets } = (await graphql("upload", { input }))
    .stagedUploadsCreate;
  const target = stagedTargets[0];
  const body = new FormData();
  for (const { name, value } of target.parameters) body.append(name, value);
  body.append(
    "file",
    new Blob([bytes], { type: "image/webp" }),
    input[0].filename,
  );
  const response = await fetch(target.url, { method: "POST", body });
  if (!response.ok)
    throw new Error(`Staged upload failed: HTTP ${response.status}`);
  return {
    originalSource: target.resourceUrl,
    contentType: "IMAGE",
    alt: media.alt.en,
  };
}
function fields(p) {
  return [
    {
      namespace: "brewbench",
      key: "brewing_methods",
      type: "list.single_line_text_field",
      value: JSON.stringify(p.methods),
    },
    {
      namespace: "brewbench",
      key: "material",
      type: "single_line_text_field",
      value: p.material.en,
    },
    {
      namespace: "brewbench",
      key: "care",
      type: "rich_text_field",
      value: richText(p.care.en),
    },
    {
      namespace: "brewbench",
      key: "beginner_friendly",
      type: "boolean",
      value: String(p.beginner),
    },
  ];
}
async function seedProducts() {
  const categories = (await graphql("taxonomy", { search: "Coffee" })).taxonomy
    .categories.nodes;
  await save(join(privateDir, "taxonomy.json"), categories);
  const kettleCategories = (await graphql("taxonomy", { search: "Kettles" }))
    .taxonomy.categories.nodes;
  const categoryNames = {
    Brewers: "Coffee Makers & Espresso Machines",
    Grinders: "Coffee Grinders",
    Filters: "Coffee Filters",
    Servers: "Coffee Servers",
    Parts: "Coffee Maker & Espresso Machine Replacement Parts",
  };
  for (const p of selected) {
    const previous = existing.get(p.handle);
    if (previous && previous.vendor !== "Brewbench")
      throw new Error(`Refusing to overwrite unrelated product ${p.handle}`);
    const nativeDrift =
      previous &&
      (previous.title !== p.title.en ||
        previous.descriptionHtml !== html(p.description.en) ||
        previous.status !== "ACTIVE" ||
        p.variants.some(
          (v) =>
            previous.variants.nodes.find((x) => x.sku === v.sku)?.price !==
            v.price,
        ));
    if (nativeDrift) delete state.hashes[`product:${p.handle}`];
    const category =
      p.group === "Kettles"
        ? kettleCategories.find((c) => c.name === "Stovetop Kettles")
        : categories.find((c) => c.name === categoryNames[p.group]);
    const result = await changed(
      `product:${p.handle}`,
      { product: p, category: category?.id },
      async () => {
        const files = [];
        for (const m of p.media) {
          const current = previous?.media.nodes.find(
            (x) => x.alt === m.alt.en && x.status === "READY",
          );
          files.push(
            current ? { id: current.id, alt: m.alt.en } : await upload(m),
          );
        }
        const input = {
          handle: p.handle,
          title: p.title.en,
          descriptionHtml: html(p.description.en),
          status: "ACTIVE",
          vendor: "Brewbench",
          productType: p.group,
          tags: [
            "brewbench",
            ...p.methods,
            ...(p.beginner ? ["beginner"] : []),
          ],
          seo: {
            title: `${p.title.en} | Brewbench`,
            description: p.description.en.slice(0, 155),
          },
          ...(category ? { category: category.id } : {}),
          files,
          metafields: fields(p),
          productOptions: p.options.map((o, i) => ({
            name: o.name,
            position: i + 1,
            values: o.values.map((name) => ({ name })),
          })),
          variants: p.variants.map((v, i) => ({
            ...(previous?.variants.nodes.find((x) => x.sku === v.sku)
              ? { id: previous.variants.nodes.find((x) => x.sku === v.sku).id }
              : {}),
            sku: v.sku,
            price: v.price,
            position: i + 1,
            inventoryPolicy: "DENY",
            taxable: false,
            inventoryItem: {
              tracked: true,
              requiresShipping: true,
              measurement: { weight: { value: v.weightGrams, unit: "GRAMS" } },
            },
            optionValues: v.options.map((name, j) => ({
              name,
              optionName: p.options[j].name,
            })),
            ...(v.capacityMl
              ? {
                  metafields: [
                    {
                      namespace: "brewbench",
                      key: "capacity_ml",
                      type: "number_integer",
                      value: String(v.capacityMl),
                    },
                  ],
                }
              : {}),
          })),
        };
        const created = (
          await graphql("product-set", {
            identifier: { handle: p.handle },
            input,
          })
        ).productSet.product;
        // productSet synchronizes list fields. Reconcile our omitted relationship
        // metafields and their translation digests after any native product write.
        for (const v of p.variants) delete state.hashes[`fit:${v.sku}`];
        delete state.hashes[`guide-link:${p.handle}`];
        delete state.hashes[`translation:${p.handle}`];
        let ready = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          const status = await graphql("media-status", {
            ids: created.media.nodes.map((m) => m.id),
          });
          if (status.nodes.some((m) => m?.status === "FAILED"))
            throw new Error(`Media processing failed: ${p.handle}`);
          if (status.nodes.every((m) => m?.status === "READY")) {
            ready = true;
            break;
          }
          await pause(1500);
        }
        if (!ready) throw new Error(`Media not ready: ${p.handle}`);
        return created;
      },
      previous || null,
    );
    console.log(`Catalog: ${p.handle}`);
    if (!result) throw new Error("Missing product state");
  }
  products = await paginate("products", "products");
}
async function inventory(reset = false) {
  const location = environment.locations.nodes.find(
    (l) => l.name === "Shop location" && l.isActive && l.fulfillsOnlineOrders,
  );
  if (!location)
    throw new Error("Expected active fulfillment location is missing.");
  for (const p of selected)
    for (const v of p.variants) {
      if (state.inventoryInitialized[v.sku] && !reset) continue;
      const product = products.find((x) => x.handle === p.handle);
      const variant = product.variants.nodes.find((x) => x.sku === v.sku);
      const level = variant.inventoryItem.inventoryLevels.nodes.find(
        (l) => l.location.id === location.id,
      );
      if (!level) {
        const intent = `activate:${variant.inventoryItem.id}:${location.id}`;
        state.idempotency[intent] ||= randomUUID();
        await persist();
        await graphql(
          "inventory-activate",
          {
            inventoryItemId: variant.inventoryItem.id,
            locationId: location.id,
            key: state.idempotency[intent],
          },
          { idempotent: true },
        );
      }
      const before =
        level?.quantities.find((q) => q.name === "available").quantity || 0;
      if (before !== v.initialStock) {
        const intent = `${reset ? "reset:" + new Date().toISOString() : "initialize"}:${v.sku}:${before}:${v.initialStock}`;
        state.idempotency[intent] ||= randomUUID();
        await persist();
        await graphql(
          "inventory-set",
          {
            key: state.idempotency[intent],
            input: {
              name: "available",
              reason: "correction",
              referenceDocumentUri: `https://brewbench.example/qa/inventory/${v.sku}`,
              quantities: [
                {
                  inventoryItemId: variant.inventoryItem.id,
                  locationId: location.id,
                  quantity: v.initialStock,
                  changeFromQuantity: before,
                },
              ],
            },
          },
          { idempotent: true },
        );
        state.changes.push({
          at: new Date().toISOString(),
          key: `inventory:${v.sku}`,
          before,
          after: v.initialStock,
        });
      }
      state.inventoryInitialized[v.sku] = true;
      await persist();
    }
}
async function seedRelationships() {
  const skuMap = new Map(
    products.flatMap((p) => p.variants.nodes.map((v) => [v.sku, v.id])),
  );
  for (const p of selected)
    for (const v of p.variants) {
      // Slice temporarily omits references outside its representative set; the full run restores all.
      const refs = v.compatibleSkus
        .filter((s) => skuMap.has(s))
        .map((s) => skuMap.get(s));
      await changed(`fit:${v.sku}`, refs, () =>
        graphql(
          "metafields",
          {
            metafields: [
              {
                ownerId: skuMap.get(v.sku),
                namespace: "brewbench",
                key: "compatible_variants",
                type: "list.variant_reference",
                value: JSON.stringify(refs),
              },
            ],
          },
          { idempotent: true },
        ),
      );
    }
  for (const guide of manifest.guides) {
    const steps = [];
    for (const step of guide.steps) {
      const obj = await changed(`step:${step.handle}`, step, async () => {
        const result = (
          await graphql("meta-upsert", {
            handle: { type: "brewbench_guide_step", handle: step.handle },
            metaobject: {
              capabilities: { publishable: { status: "ACTIVE" } },
              fields: [
                { key: "heading", value: step.title.en },
                { key: "body", value: step.body.en },
                { key: "duration_seconds", value: String(step.duration) },
              ],
            },
          })
        ).metaobjectUpsert.metaobject;
        await translate(result.id, {
          heading: step.title.de,
          body: step.body.de,
        });
        return result;
      });
      steps.push(obj.id);
    }
    const equipment = guide.equipment
      .map((h) => products.find((p) => p.handle === h)?.id)
      .filter(Boolean);
    const obj = await changed(
      `guide:${guide.handle}`,
      { guide, steps, equipment },
      async () => {
        const result = (
          await graphql("meta-upsert", {
            handle: { type: "brewbench_brewing_guide", handle: guide.handle },
            metaobject: {
              capabilities: { publishable: { status: "ACTIVE" } },
              fields: [
                { key: "title", value: guide.title.en },
                { key: "introduction", value: guide.intro.en },
                { key: "steps", value: JSON.stringify(steps) },
                { key: "equipment", value: JSON.stringify(equipment) },
              ],
            },
          })
        ).metaobjectUpsert.metaobject;
        await translate(result.id, {
          title: guide.title.de,
          introduction: guide.intro.de,
        });
        return result;
      },
    );
    for (const p of selected.filter((p) => p.guide === guide.handle))
      await changed(`guide-link:${p.handle}`, obj.id, () =>
        graphql(
          "metafields",
          {
            metafields: [
              {
                ownerId: products.find((x) => x.handle === p.handle).id,
                namespace: "brewbench",
                key: "guide",
                type: "metaobject_reference",
                value: obj.id,
              },
            ],
          },
          { idempotent: true },
        ),
      );
  }
}
async function seedContent() {
  const online = environment.publications.nodes.find(
    (p) =>
      p.catalog?.title === "Online Store" ||
      p.catalog?.title?.endsWith(" for Online Store"),
  );
  if (!online) throw new Error("Online Store publication is missing");
  for (const p of selected) {
    const current = products.find((x) => x.handle === p.handle);
    await changed(`published:${p.handle}`, online.id, () =>
      graphql(
        "publish",
        { id: current.id, input: [{ publicationId: online.id }] },
        { idempotent: true },
      ),
    );
    await changed(`translation:${p.handle}`, p, async () => {
      await translate(current.id, {
        title: p.title.de,
        body_html: html(p.description.de),
        meta_title: `${p.title.de} | Brewbench`,
        meta_description: p.description.de.slice(0, 155),
      });
      for (const o of current.options) {
        const source = p.options.find((s) => s.name === o.name);
        if (!source) continue;
        await translate(o.id, { name: source.de });
        for (const val of o.optionValues)
          if (source.translations?.[val.name])
            await translate(val.id, { name: source.translations[val.name] });
      }
      for (const f of current.metafields.nodes) {
        if (f.key === "material")
          await translate(f.id, { value: p.material.de });
        if (f.key === "care")
          await translate(f.id, { value: richText(p.care.de) });
      }
      return { translated: true };
    });
  }
  const collections = await paginate("collections", "collections");
  for (const c of manifest.collections) {
    const members = c.products
      .map((h) => products.find((p) => p.handle === h)?.id)
      .filter(Boolean);
    if (!members.length) continue;
    const current = collections.find((x) => x.handle === c.handle);
    await changed(
      `collection:${c.handle}`,
      { c, members },
      async () => {
        const selections = members.map((productId) => ({ productId }));
        const source =
          current?.sources.find(
            (s) => s.title === "Brewbench curated products",
          ) || current?.sources[0];
        const sourceInput = {
          source: {
            title: "Brewbench curated products",
            targetType: "PRODUCTS",
            inclusion: { selections },
          },
        };
        const membership = current
          ? source
            ? {
                sourcesToUpdate: [
                  {
                    condition: {
                      id: source.id,
                      title: "Brewbench curated products",
                      inclusion: {
                        selectionsToAdd: members
                          .filter(
                            (id) =>
                              !current.products.nodes.some((p) => p.id === id),
                          )
                          .map((productId) => ({ productId })),
                        selectionsToRemove: current.products.nodes
                          .filter((p) => !members.includes(p.id))
                          .map((p) => ({ productId: p.id })),
                      },
                    },
                  },
                ],
              }
            : { sourcesToCreate: [sourceInput] }
          : { sources: [sourceInput] };
        const input = {
          ...(current ? { id: current.id } : {}),
          handle: c.handle,
          title: c.title.en,
          descriptionHtml: html(c.description.en),
          ...membership,
          sortOrder: "MANUAL",
          seo: {
            title: `${c.title.en} | Brewbench`,
            description: c.description.en,
          },
        };
        const payload = await graphql(
          current ? "collection-update" : "collection-create",
          { input },
        );
        const result = (payload.collectionUpdate || payload.collectionCreate)
          .collection;
        await graphql(
          "publish",
          { id: result.id, input: [{ publicationId: online.id }] },
          { idempotent: true },
        );
        await translate(result.id, {
          title: c.title.de,
          body_html: html(c.description.de),
          meta_title: `${c.title.de} | Brewbench`,
          meta_description: c.description.de,
        });
        return result;
      },
      current || null,
    );
  }
  if (slice) return;
  const pages = await paginate("pages", "pages");
  for (const p of manifest.pages) {
    const current = pages.find((x) => x.handle === p.handle);
    await changed(
      `page:${p.handle}`,
      p,
      async () => {
        const page = {
          handle: p.handle,
          title: p.title.en,
          body: p.body.en,
          isPublished: true,
        };
        const payload = await graphql(current ? "page-update" : "page-create", {
          ...(current ? { id: current.id } : {}),
          page,
        });
        const result = (payload.pageUpdate || payload.pageCreate).page;
        await translate(result.id, { title: p.title.de, body_html: p.body.de });
        return result;
      },
      current || null,
    );
  }
  const menus = await paginate("menus", "menus");
  for (const [handle, title, entries] of [
    [
      "brewbench-main",
      "Brewbench main",
      [
        ["Shop", "Sortiment", "COLLECTION", "brewers"],
        ["Grinders", "Mühlen", "COLLECTION", "grinders"],
        ["Filters & parts", "Filter & Teile", "COLLECTION", "filters"],
        ["The brew guide", "Brühwissen", "PAGE", "buying-guide"],
      ],
    ],
    [
      "brewbench-footer",
      "Brewbench footer",
      [
        ["Delivery", "Versand", "PAGE", "delivery"],
        ["Questions", "Fragen", "PAGE", "faq"],
        ["Privacy notice", "Datenschutz", "PAGE", "privacy"],
        ["Demo terms", "Demo-Bedingungen", "PAGE", "returns"],
      ],
    ],
  ]) {
    // MenuItem is not a public translatableResource. Two native menus keep both
    // languages editable without a private endpoint or a translation app.
    for (const locale of ["en", "de"]) {
      const menuHandle = locale === "en" ? handle : `${handle}-de`;
      const current = menus.find((x) => x.handle === menuHandle);
      await changed(
        `menu:${menuHandle}`,
        { entries, locale },
        async () => {
          const items = entries.map(([en, de, type, h]) => ({
            title: locale === "de" ? de : en,
            type,
            resourceId:
              state.resources[`${type === "PAGE" ? "page" : "collection"}:${h}`]
                .id,
          }));
          const payload = await graphql(
            current ? "menu-update" : "menu-create",
            {
              ...(current ? { id: current.id } : {}),
              title: `${title} (${locale})`,
              handle: menuHandle,
              items,
            },
          );
          return (payload.menuUpdate || payload.menuCreate).menu;
        },
        current || null,
      );
    }
  }
  const web = await graphql("web-presences");
  let presence = web.webPresences.nodes.find(
    (w) => w.domain?.id === web.shop.primaryDomain.id,
  );
  if (!presence)
    presence = (
      await graphql("web-presence-create", {
        input: {
          domainId: web.shop.primaryDomain.id,
          defaultLocale: "en",
          alternateLocales: ["de"],
        },
      })
    ).webPresenceCreate.webPresence;
  else if (!presence.alternateLocales.some((l) => l.locale === "de"))
    await graphql(
      "web-presence-update",
      {
        id: presence.id,
        input: {
          alternateLocales: [
            ...presence.alternateLocales.map((l) => l.locale),
            "de",
          ],
        },
      },
      { idempotent: true },
    );
  for (const market of web.markets.nodes.filter(
    (m) =>
      m.status === "ACTIVE" &&
      ["Austria", "Germany", "United Kingdom"].includes(m.name),
  )) {
    if (!market.webPresences.nodes.some((w) => w.id === presence.id))
      await graphql(
        "market-update",
        { id: market.id, input: { webPresencesToAdd: [presence.id] } },
        { idempotent: true },
      );
  }
  const webPresences = [presence.id];
  await changed("locale:de", { published: true, webPresences }, () =>
    graphql("locale-publish", { webPresences }, { idempotent: true }),
  );
}
if (command === "snapshot") {
  await save(join(privateDir, `snapshot-${Date.now()}.json`), {
    at: new Date().toISOString(),
    environment,
    products,
    collections: await paginate("collections", "collections"),
    pages: await paginate("pages", "pages"),
  });
  console.log("Private snapshot saved.");
} else if (command === "plan") {
  const diff = selected.map((p) => ({
    handle: p.handle,
    action: !existing.has(p.handle)
      ? "create"
      : state.hashes[`product:${p.handle}`] ===
          hash({ product: p, category: existing.get(p.handle).category?.id })
        ? "unchanged"
        : "update",
    inventory: state.inventoryInitialized[p.variants[0].sku]
      ? "preserve"
      : "initialize once",
  }));
  console.table(diff);
  await save(join(privateDir, "plan.json"), {
    store,
    diff,
    generatedAt: new Date().toISOString(),
  });
} else if (command === "inventory-reset") {
  await inventory(true);
  console.log("Explicit inventory reset complete.");
} else if (command === "apply") {
  if (!state.snapshot) {
    state.snapshot = join(privateDir, `before-first-apply-${Date.now()}.json`);
    await save(state.snapshot, { environment, products });
    await persist();
  }
  await defineData();
  await seedProducts();
  await inventory();
  await seedRelationships();
  await seedContent();
  console.log(
    `Applied ${selected.length} products. Inventory preserved after first initialization.`,
  );
} else {
  const errors = [];
  for (const p of selected) {
    const current = existing.get(p.handle);
    if (!current) errors.push(`Missing ${p.handle}`);
    else {
      if (current.status !== "ACTIVE") errors.push(`Inactive ${p.handle}`);
      for (const v of p.variants) {
        const actual = current.variants.nodes.find((x) => x.sku === v.sku);
        if (!actual) errors.push(`Missing ${v.sku}`);
        else if (actual.price !== v.price) errors.push(`Wrong price ${v.sku}`);
      }
      if (current.media.nodes.some((m) => m.status !== "READY"))
        errors.push(`Media not ready ${p.handle}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const bySku = new Map(
    products.flatMap((p) => p.variants.nodes.map((v) => [v.sku, v.id])),
  );
  for (const p of selected) {
    const actual = existing.get(p.handle);
    if (!actual.category) errors.push(`Missing native category ${p.handle}`);
    for (const v of p.variants) {
      const variant = actual.variants.nodes.find((x) => x.sku === v.sku);
      const refs = JSON.parse(
        variant.metafields.nodes.find((x) => x.key === "compatible_variants")
          ?.value || "[]",
      );
      const expected = v.compatibleSkus
        .filter((s) => bySku.has(s))
        .map((s) => bySku.get(s));
      if (
        JSON.stringify(refs.slice().sort()) !== JSON.stringify(expected.sort())
      )
        errors.push(`Wrong compatibility ${v.sku}`);
    }
    if (
      p.guide &&
      !actual.metafields.nodes.some(
        (x) =>
          x.key === "guide" &&
          x.value === state.resources[`guide:${p.guide}`]?.id,
      )
    )
      errors.push(`Missing shared guide ${p.handle}`);
    const translation = await graphql("translation-read", {
      resourceId: actual.id,
    });
    if (
      translation.translatableResource.translations.find(
        (t) => t.key === "title",
      )?.value !== p.title.de
    )
      errors.push(`Wrong German title ${p.handle}`);
  }
  const collections = await paginate("collections", "collections");
  for (const c of manifest.collections) {
    const actual = collections.find((x) => x.handle === c.handle);
    const expected = c.products
      .filter((h) => existing.has(h))
      .map((h) => existing.get(h).id);
    if (
      !actual ||
      JSON.stringify(actual.products.nodes.map((x) => x.id).sort()) !==
        JSON.stringify(expected.sort())
    )
      errors.push(`Wrong collection membership ${c.handle}`);
  }
  if (!slice) {
    const menus = await paginate("menus", "menus");
    for (const h of [
      "brewbench-main",
      "brewbench-main-de",
      "brewbench-footer",
      "brewbench-footer-de",
    ])
      if (menus.find((x) => x.handle === h)?.items.length !== 4)
        errors.push(`Missing navigation ${h}`);
    const locale = environment.shopLocales.find((x) => x.locale === "de");
    if (!locale?.published) errors.push("German is not published");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Verified ${selected.length} active products, categories, exact variant references, shared guides, German titles, collections and navigation.`,
  );
}

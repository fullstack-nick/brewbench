import { join } from "node:path";
import { graphql, paginate, json, save, privateDir, store } from "./client.mjs";

const mode = process.argv[2] || "plan";
if (!["plan", "apply", "verify", "uk-rate-off", "uk-rate-on"].includes(mode))
  throw new Error("Use plan, apply, verify, uk-rate-off or uk-rate-on");
const config = await json("data/content/markets.json");
const manifest = await json("data/catalog/products.json");
const env = await graphql("environment");
if (
  store !== "brewbench-practice.myshopify.com" ||
  env.shop.currencyCode !== "EUR"
)
  throw new Error(
    "This configuration exercise is restricted to the dedicated Brewbench development store.",
  );
let geo = await graphql("geography");
if (
  geo.deliveryProfiles.pageInfo.hasNextPage ||
  geo.catalogs.pageInfo.hasNextPage ||
  geo.markets.pageInfo.hasNextPage
)
  throw new Error(
    "Unexpected geography pagination; expand the query before writing.",
  );
const ledgerPath = join(privateDir, "geography-ledger.json");
const ledger = await json(ledgerPath, { store, before: geo, changes: [] });
async function write(operation, variables) {
  const result = await graphql(operation, variables, {
    idempotent: !operation.endsWith("-create"),
  });
  ledger.changes.push({
    at: new Date().toISOString(),
    operation,
    variables,
    result,
  });
  await save(ledgerPath, ledger);
  return result;
}
const profileName = "Brewbench demonstration delivery";
let profile =
  geo.deliveryProfiles.nodes.find((p) => p.name === profileName) ||
  geo.deliveryProfiles.nodes.find(
    (p) => p.name === "Brewbench preflight probe - empty",
  );
const location = env.locations.nodes.find(
  (l) => l.name === "Shop location" && l.fulfillsOnlineOrders && l.isActive,
);
if (!location) throw new Error("Missing fulfillment location");
const products = (await paginate("products", "products")).filter((p) =>
  manifest.some((m) => m.handle === p.handle),
);
if (mode === "plan") {
  console.table(config.countries);
  console.log(
    `${products.length} existing Brewbench products; EUR only; Thermal Carafe excluded from GB.`,
  );
} else if (mode === "uk-rate-off" || mode === "uk-rate-on") {
  const market = geo.markets.nodes.find((m) => m.name === "United Kingdom");
  const option = market?.delivery.shipping?.optionDefinitions.nodes.find(
    (o) => o.name === "Brewbench GB standard (test)",
  );
  if (!option)
    throw new Error("Apply market shipping before the incident exercise.");
  await write("market-update", {
    id: market.id,
    input: {
      delivery: {
        shipping: {
          optionDefinitionsToUpdate: [
            { flatRate: { id: option.id, isActive: mode === "uk-rate-on" } },
          ],
        },
      },
    },
  });
  if (!profile)
    throw new Error("Apply geography before running the incident exercise.");
  const group = profile.profileLocationGroups[0];
  const zone = group.locationGroupZones.nodes.find(
    (z) => z.zone.name === "Brewbench GB",
  );
  if (!zone) throw new Error("UK zone not found");
  await write("delivery-update", {
    id: profile.id,
    profile: {
      locationGroupsToUpdate: [
        {
          id: group.locationGroup.id,
          zonesToUpdate: [
            {
              id: zone.zone.id,
              methodDefinitionsToUpdate: zone.methodDefinitions.nodes.map(
                (m) => ({ id: m.id, active: mode === "uk-rate-on" }),
              ),
            },
          ],
        },
      ],
    },
  });
  console.log(
    `Controlled incident: UK methods ${mode === "uk-rate-on" ? "restored" : "disabled"}.`,
  );
} else if (mode === "apply") {
  await save(ledgerPath, ledger);
  if (!profile) {
    profile = (
      await write("delivery-create", {
        profile: {
          name: profileName,
          locationGroupsToCreate: [{ locations: [location.id] }],
        },
      })
    ).deliveryProfileCreate.profile;
    geo = await graphql("geography");
    profile = geo.deliveryProfiles.nodes.find((p) => p.id === profile.id);
  }
  const group = profile.profileLocationGroups.find((g) =>
    g.locationGroup.locations.nodes.some((l) => l.id === location.id),
  );
  if (!group) throw new Error("Profile fulfillment group is missing.");
  const zonesToCreate = [],
    zonesToUpdate = [];
  for (const country of config.countries) {
    const existing = group.locationGroupZones.nodes.find(
      (z) =>
        z.zone.name === `Brewbench ${country.code}` ||
        z.zone.countries.some((c) => c.name === country.name),
    );
    const method = {
      name: `Brewbench ${country.code} standard (test)`,
      description: "Demonstration rate. No goods are shipped.",
      active: true,
      rateDefinition: { price: { amount: country.rate, currencyCode: "EUR" } },
    };
    const zone = {
      name: `Brewbench ${country.code}`,
      countries: [{ code: country.code, includeAllProvinces: true }],
    };
    if (existing) {
      zone.id = existing.zone.id;
      const own = existing.methodDefinitions.nodes[0];
      if (own) zone.methodDefinitionsToUpdate = [{ id: own.id, ...method }];
      else zone.methodDefinitionsToCreate = [method];
      zonesToUpdate.push(zone);
    } else zonesToCreate.push({ ...zone, methodDefinitionsToCreate: [method] });
  }
  await write("delivery-update", {
    id: profile.id,
    profile: {
      name: profileName,
      variantsToAssociate: products.flatMap((p) =>
        p.variants.nodes.map((v) => v.id),
      ),
      locationGroupsToUpdate: [
        { id: group.locationGroup.id, zonesToCreate, zonesToUpdate },
      ],
    },
  });
  const markets = {};
  for (const country of config.countries) {
    let market = geo.markets.nodes.find(
      (m) =>
        m.name === country.name ||
        m.name === `Brewbench preflight ${country.name}`,
    );
    if (!market)
      market = (
        await write("market-create", {
          input: {
            name: country.name,
            status: "DRAFT",
            conditions: {
              regionsCondition: { regions: [{ countryCode: country.code }] },
            },
          },
        })
      ).marketCreate.market;
    markets[country.code] = market;
  }
  let catalog = geo.catalogs.nodes.find(
    (c) =>
      c.title === "Brewbench UK availability" ||
      c.title === "Brewbench preflight UK catalog",
  );
  if (!catalog)
    catalog = (
      await write("catalog-create", {
        input: {
          title: "Brewbench UK availability",
          status: "DRAFT",
          context: { marketIds: [markets.GB.id] },
        },
      })
    ).catalogCreate.catalog;
  let publication = catalog.publication;
  if (!publication)
    publication = (
      await write("publication-create", {
        input: {
          catalogId: catalog.id,
          autoPublish: false,
          defaultState: "EMPTY",
        },
      })
    ).publicationCreate.publication;
  for (const p of products) {
    const excluded = manifest
      .find((m) => m.handle === p.handle)
      .excludeCountries.includes("GB");
    const current = catalog.publication?.includedProducts?.nodes.some(
      (x) => x.id === p.id,
    );
    if (excluded && current)
      await write("unpublish", {
        id: p.id,
        input: [{ publicationId: publication.id }],
      });
    else if (!excluded && !current)
      await write("publish", {
        id: p.id,
        input: [{ publicationId: publication.id }],
      });
  }
  await write("catalog-update", {
    id: catalog.id,
    input: {
      title: "Brewbench UK availability",
      status: "ACTIVE",
      context: { marketIds: [markets.GB.id] },
      publicationId: publication.id,
    },
  });
  for (const country of config.countries) {
    const existingMarket = geo.markets.nodes.find(
      (m) => m.id === markets[country.code].id,
    );
    const options =
      existingMarket?.delivery.shipping?.optionDefinitions.nodes || [];
    if (
      existingMarket?.delivery.shipping?.optionDefinitions.pageInfo.hasNextPage
    )
      throw new Error("Unexpected market shipping pagination");
    const name = `Brewbench ${country.code} standard (test)`;
    const own = options.find((o) => o.name === name);
    const option = {
      name,
      isActive: true,
      currency: "EUR",
      description: "Demonstration rate. No goods are shipped.",
    };
    const rate = { price: { amount: country.rate, currencyCode: "EUR" } };
    // New development stores resolve purchasability through market shipping.
    // Legacy profiles alone can accept writes without making stock sellable.
    const shipping = {
      isEnabled: true,
      optionDefinitionsToUpdate: options
        .filter((o) => o.id !== own?.id && o.name)
        .map((o) => ({ flatRate: { id: o.id, isActive: false } })),
    };
    if (own)
      shipping.optionDefinitionsToUpdate.push({
        flatRate: {
          id: own.id,
          ...option,
          rateGroupsToUpdate: own.rateGroups.nodes.map((g) => ({
            id: g.id,
            rate,
          })),
        },
      });
    else
      shipping.optionDefinitionsToCreate = [
        { flatRate: { ...option, rateGroups: [{ rate }] } },
      ];
    await write("market-update", {
      id: markets[country.code].id,
      input: {
        name: country.name,
        status: "ACTIVE",
        currencySettings: { baseCurrency: "EUR", localCurrencies: false },
        delivery: { shipping },
        ...(country.code === "GB" ? { catalogsToAdd: [catalog.id] } : {}),
      },
    });
  }
  const canada = geo.markets.nodes.find(
    (m) => m.name === "Canada" && m.status === "ACTIVE",
  );
  if (canada)
    await write("market-update", { id: canada.id, input: { status: "DRAFT" } });
  console.log(
    "Applied AT/DE/GB delivery, EUR currencies and UK product availability.",
  );
} else {
  const errors = [];
  if (!profile || profile.name !== profileName)
    errors.push("Missing Brewbench delivery profile");
  const zones =
    profile?.profileLocationGroups.flatMap((g) => g.locationGroupZones.nodes) ||
    [];
  for (const country of config.countries) {
    const market = geo.markets.nodes.find((m) => m.name === country.name);
    const shipping = market?.delivery.shipping;
    const options = shipping?.optionDefinitions.nodes || [];
    if (
      !shipping?.isEnabled ||
      !options.some(
        (o) =>
          o.isActive &&
          o.name === `Brewbench ${country.code} standard (test)` &&
          o.rateGroups.nodes.some(
            (g) =>
              Number(g.rate.price.amount) === Number(country.rate) &&
              g.rate.price.currencyCode === "EUR",
          ),
      )
    )
      errors.push(
        `Missing/wrong active ${country.code} market shipping option`,
      );
    const z = zones.find((z) => z.zone.name === `Brewbench ${country.code}`);
    if (
      !z?.methodDefinitions.nodes.some(
        (m) =>
          m.active &&
          Number(m.rateProvider.price?.amount) === Number(country.rate) &&
          m.rateProvider.price.currencyCode === "EUR",
      )
    )
      errors.push(`Missing/wrong ${country.code} rate`);
    if (
      !geo.markets.nodes.some(
        (m) => m.name === country.name && m.status === "ACTIVE",
      )
    )
      errors.push(`Inactive ${country.code} market`);
  }
  const catalog = geo.catalogs.nodes.find(
    (c) => c.title === "Brewbench UK availability" && c.status === "ACTIVE",
  );
  if (!catalog?.publication) errors.push("Missing UK publication");
  else {
    const members = catalog.publication.includedProducts.nodes.map(
      (p) => p.handle,
    );
    for (const p of manifest) {
      if (members.includes(p.handle) === p.excludeCountries.includes("GB"))
        errors.push(`UK publication mismatch: ${p.handle}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await save(join(privateDir, "geography-verification.json"), {
    at: new Date().toISOString(),
    countries: config.countries,
    catalogCount: catalog.publication.includedProducts.nodes.length,
    passed: true,
  });
  console.log(
    "Verified three active markets, three EUR delivery rates and the exact UK catalog.",
  );
}

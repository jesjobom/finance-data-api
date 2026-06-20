import { readProjectFile, withClient } from "./db.js";

type Fixture = {
  investments: Array<{ symbol: string; name: string; assetClass: string; currency: string; market?: string; country?: string; broker?: string }>;
  watchedAssets: Array<{ symbol: string; name: string; assetClass: string; currency: string; market?: string; country?: string }>;
  benchmarks: Array<{ name: string; symbol: string; currency: string; source?: string }>;
};

const fixture = JSON.parse(await readProjectFile("seeds", "fixture.json")) as Fixture;

await withClient(async (client) => {
  for (const item of fixture.investments) {
    await client.query(
      `INSERT INTO investments(symbol, name, asset_class, currency, market, country, broker)
       VALUES($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [item.symbol, item.name, item.assetClass, item.currency, item.market, item.country, item.broker]
    );
  }

  for (const item of fixture.watchedAssets) {
    await client.query(
      `INSERT INTO watched_assets(symbol, name, asset_class, currency, market, country)
       VALUES($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [item.symbol, item.name, item.assetClass, item.currency, item.market, item.country]
    );
  }

  for (const item of fixture.benchmarks) {
    await client.query(
      `INSERT INTO benchmarks(name, symbol, currency, source)
       VALUES($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [item.name, item.symbol, item.currency, item.source]
    );
  }
});

console.log("seed complete");

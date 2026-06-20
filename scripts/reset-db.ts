import { withClient } from "./db.js";

await withClient(async (client) => {
  await client.query(`
    DROP TABLE IF EXISTS schema_migrations;
    DROP TABLE IF EXISTS snapshot_positions;
    DROP TABLE IF EXISTS portfolio_snapshots;
    DROP TABLE IF EXISTS benchmarks;
    DROP TABLE IF EXISTS virtual_positions;
    DROP TABLE IF EXISTS virtual_portfolios;
    DROP TABLE IF EXISTS watched_assets;
    DROP TABLE IF EXISTS news_investments;
    DROP TABLE IF EXISTS news_items;
    DROP TABLE IF EXISTS operations;
    DROP TABLE IF EXISTS investments;
  `);
});

console.log("database reset complete");

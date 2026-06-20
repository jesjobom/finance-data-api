import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { PostgresFinanceStore } from "../src/postgres-store.js";

const adminUrl = process.env.DATABASE_URL;
const integration = adminUrl ? it : it.skip;

describe("PostgreSQL analytics persistence", () => {
  integration("migrates and reloads benchmark observations", async () => {
    const databaseName = `finance_data_api_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const testUrl = new URL(adminUrl!);
    testUrl.pathname = `/${databaseName}`;
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      let store = await PostgresFinanceStore.connect(testUrl.toString());
      const benchmark = await store.createBenchmark({
        name: "Persistence Index", symbol: "PIX", currency: "USD"
      });
      const observation = await store.createBenchmarkObservation({
        benchmarkId: benchmark.id, effectiveAt: "2026-06-20T12:00:00.000Z",
        value: 123.45, currency: "USD", source: "integration"
      });
      await store.close();

      store = await PostgresFinanceStore.connect(testUrl.toString());
      expect(store.listBenchmarkObservations(benchmark.id)).toEqual([observation]);
      await store.close();
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
    }
  }, 30_000);
});

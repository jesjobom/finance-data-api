import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { PostgresFinanceStore } from "./postgres-store.js";
import { FinanceStore } from "./store.js";

const config = loadConfig();
const store = config.databaseUrl
  ? await PostgresFinanceStore.connect(config.databaseUrl)
  : new FinanceStore();
const { app } = buildApp({ config, store });

await app.listen({ port: config.port, host: "0.0.0.0" });

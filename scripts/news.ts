import { loadConfig } from "../src/config.js";
import { newsCollectionTriggerSchema } from "../src/domain.js";
import { NewsCollectionService } from "../src/news-collector.js";
import { seedNewsSources } from "../src/news-source-seed.js";
import { PostgresFinanceStore } from "../src/postgres-store.js";

const config = loadConfig();
if (!config.databaseUrl) throw new Error("APP_DATABASE_URL or DATABASE_URL is required");
const store = await PostgresFinanceStore.connect(config.databaseUrl);
const command = process.argv[2] ?? "collect";
const args = process.argv.slice(3);

try {
  if (command === "sources") {
    console.log(JSON.stringify(await store.listNewsSources(), null, 2));
  } else if (command === "seed") {
    console.log(JSON.stringify(await seedNewsSources(store)));
  } else if (command === "collect") {
    const sourceValues = valueAfter(args, "--source");
    const force = args.includes("--force");
    const input = newsCollectionTriggerSchema.parse({
      mode: sourceValues.length ? "selected" : force ? "all_enabled" : "due",
      sourceIds: sourceValues.length ? sourceValues : undefined,
      trigger: "cli",
      concurrency: Number(valueAfter(args, "--concurrency")[0] ?? 3)
    });
    console.log(JSON.stringify(await new NewsCollectionService(store).trigger(input), null, 2));
  } else {
    throw new Error("Usage: npm run news -- collect [--source slug] [--force] [--concurrency N] | sources | seed");
  }
} finally {
  await store.close();
}

function valueAfter(values: string[], flag: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < values.length; index++) if (values[index] === flag && values[index + 1]) result.push(values[++index]);
  return result;
}

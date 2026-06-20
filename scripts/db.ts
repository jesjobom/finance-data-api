import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import "dotenv/config";
import { deriveDatabaseUrl } from "../src/config.js";

export function databaseUrl(): string {
  const url = process.env.APP_DATABASE_URL ?? deriveDatabaseUrl(process.env.DATABASE_URL, process.env.APP_DATABASE_NAME ?? "finance_data_api");
  if (!url) throw new Error("DATABASE_URL is required for database scripts");
  return url;
}

export async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function readProjectFile(...parts: string[]): Promise<string> {
  return readFile(join(process.cwd(), ...parts), "utf8");
}

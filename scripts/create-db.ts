import pg from "pg";
import { deriveDatabaseUrl } from "../src/config.js";

const databaseName = process.env.APP_DATABASE_NAME ?? "finance_data_api";
const adminUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_URL or ADMIN_DATABASE_URL is required to create the application database");

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [databaseName]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`created database ${databaseName}`);
  } else {
    console.log(`database ${databaseName} already exists`);
  }
  console.log(`APP_DATABASE_URL=${deriveDatabaseUrl(adminUrl, databaseName)?.replace(/:[^:@/]+@/, ":***@")}`);
} finally {
  await client.end();
}

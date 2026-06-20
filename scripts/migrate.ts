import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { withClient } from "./db.js";

await withClient(async (client) => {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const applied = new Set((await client.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map((row) => row.filename));
  const files = (await readdir(join(process.cwd(), "migrations"))).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(process.cwd(), "migrations", file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename) VALUES($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
});

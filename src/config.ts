import "dotenv/config";

export type AppConfig = {
  port: number;
  apiToken: string;
  databaseUrl?: string;
};

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "3000"),
    apiToken: process.env.API_TOKEN ?? "change-me-local-token",
    databaseUrl: process.env.APP_DATABASE_URL ?? deriveDatabaseUrl(process.env.DATABASE_URL, "finance_data_api")
  };
}

export function deriveDatabaseUrl(source: string | undefined, databaseName: string): string | undefined {
  if (!source) return undefined;
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

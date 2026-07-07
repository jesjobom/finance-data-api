import "dotenv/config";

export type AppConfig = {
  port: number;
  apiToken: string;
  databaseUrl?: string;
};

export function loadConfig(): AppConfig {
  const appDatabaseUrl = optionalEnv(process.env.APP_DATABASE_URL);
  return {
    port: Number(process.env.PORT ?? "3000"),
    apiToken: process.env.API_TOKEN ?? "change-me-local-token",
    databaseUrl: appDatabaseUrl ?? deriveDatabaseUrl(optionalEnv(process.env.DATABASE_URL), "finance_data_api")
  };
}

export function deriveDatabaseUrl(source: string | undefined, databaseName: string): string | undefined {
  if (!source) return undefined;
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function optionalEnv(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

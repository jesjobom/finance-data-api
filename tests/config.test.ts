import { afterEach, describe, expect, it } from "vitest";
import { deriveDatabaseUrl, loadConfig } from "../src/config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("config", () => {
  it("derives the application database URL from DATABASE_URL", () => {
    expect(deriveDatabaseUrl("postgresql://user:pass@localhost:5432/openclaw", "finance_data_api"))
      .toBe("postgresql://user:pass@localhost:5432/finance_data_api");
  });

  it("treats a blank APP_DATABASE_URL as absent", () => {
    process.env.APP_DATABASE_URL = "";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/openclaw";

    expect(loadConfig().databaseUrl).toBe("postgresql://user:pass@localhost:5432/finance_data_api");
  });

  it("prefers a non-empty APP_DATABASE_URL", () => {
    process.env.APP_DATABASE_URL = "postgresql://user:pass@localhost:5432/custom_finance";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/openclaw";

    expect(loadConfig().databaseUrl).toBe("postgresql://user:pass@localhost:5432/custom_finance");
  });
});

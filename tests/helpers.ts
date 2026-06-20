import { buildApp } from "../src/app.js";
import { FinanceStore } from "../src/store.js";

export function testApp() {
  const token = "test-token";
  const store = new FinanceStore();
  const built = buildApp({ store, config: { port: 0, apiToken: token } });
  return {
    ...built,
    token,
    auth: { authorization: `Bearer ${token}` }
  };
}

export async function createInvestment(app: ReturnType<typeof testApp>, overrides: Record<string, unknown> = {}) {
  const response = await app.app.inject({
    method: "POST",
    url: "/v1/investments",
    headers: app.auth,
    payload: {
      symbol: "AAPL",
      name: "Apple Inc.",
      assetClass: "stock",
      currency: "USD",
      market: "NASDAQ",
      country: "US",
      broker: "test-broker",
      ...overrides
    }
  });
  return response.json();
}

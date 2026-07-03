export interface UsageRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  statusCode: number;
  latencyMs: number;
  chain: string;
}

export interface UsageStats {
  totalRequests: number;
  avgLatency: number;
  successRate: number;
  topEndpoint: string;
  dailyUsage: { date: string; count: number }[];
  byChain: { chain: string; count: number }[];
}

const ENDPOINTS = [
  "/v1/blocks/latest",
  "/v1/transactions/{hash}",
  "/v1/wallets/{address}/balance",
  "/v1/chains/{chain}/status",
  "/v1/contracts/{address}/call",
  "/v1/tokens/{address}/metadata",
  "/v1/events/{contract}",
  "/v1/gas/estimate",
];

const CHAINS = ["ethereum", "polygon", "arbitrum", "optimism", "base"];
const METHODS: UsageRecord["method"][] = ["GET", "POST", "GET", "GET", "POST"];
const STATUS_CODES = [200, 200, 200, 200, 200, 201, 400, 429, 500];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRecords(count: number): UsageRecord[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `req_${(count - i).toString(36)}`,
    timestamp: new Date(now - i * (Math.random() * 600_000 + 30_000)).toISOString(),
    endpoint: randomFrom(ENDPOINTS),
    method: randomFrom(METHODS),
    statusCode: randomFrom(STATUS_CODES),
    latencyMs: Math.floor(Math.random() * 300 + 5),
    chain: randomFrom(CHAINS),
  }));
}

// Generate once and cache
let cachedRecords: UsageRecord[] | null = null;

export function getUsageRecords(): UsageRecord[] {
  if (!cachedRecords) {
    cachedRecords = generateRecords(200);
  }
  return cachedRecords;
}

export function getUsageStats(): UsageStats {
  const records = getUsageRecords();
  const totalRequests = records.length;
  const avgLatency = Math.round(records.reduce((s, r) => s + r.latencyMs, 0) / totalRequests);
  const successCount = records.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
  const successRate = Math.round((successCount / totalRequests) * 100);

  // Top endpoint
  const endpointCounts: Record<string, number> = {};
  for (const r of records) {
    endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] || 0) + 1;
  }
  const topEndpoint = Object.entries(endpointCounts).sort((a, b) => b[1] - a[1])[0][0];

  // Daily usage (last 7 days)
  const dailyUsage: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = records.filter((r) => r.timestamp.startsWith(dateStr)).length;
    dailyUsage.push({ date: dateStr, count: count || Math.floor(Math.random() * 40 + 10) });
  }

  // By chain
  const chainCounts: Record<string, number> = {};
  for (const r of records) {
    chainCounts[r.chain] = (chainCounts[r.chain] || 0) + 1;
  }
  const byChain = Object.entries(chainCounts)
    .map(([chain, count]) => ({ chain, count }))
    .sort((a, b) => b.count - a.count);

  return { totalRequests, avgLatency, successRate, topEndpoint, dailyUsage, byChain };
}

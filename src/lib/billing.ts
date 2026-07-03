// ── Credit packages (USDC on Base) ──

export interface CreditPackage {
  id: string;
  name: string;
  usdcPrice: number;
  credits: number;
  duration: string;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "basic", name: "Basic", usdcPrice: 3, credits: 3000, duration: "1 month" },
  { id: "pro", name: "Pro", usdcPrice: 5, credits: 5500, duration: "1 month", popular: true },
  { id: "premium", name: "Premium", usdcPrice: 9, credits: 10000, duration: "1 month" },
];

// ── Rate limit tiers ──

export interface RateLimitTier {
  id: string;
  name: string;
  minCredits: number;
  requestsPerMin: number;
  requestsPerDay: number;
  maxConcurrent: number;
  description: string;
}

export const RATE_LIMIT_TIERS: RateLimitTier[] = [
  {
    id: "free",
    name: "Free",
    minCredits: 0,
    requestsPerMin: 10,
    requestsPerDay: 500,
    maxConcurrent: 2,
    description: "Get started with basic access",
  },
  {
    id: "developer",
    name: "Developer",
    minCredits: 3000,
    requestsPerMin: 60,
    requestsPerDay: 10_000,
    maxConcurrent: 10,
    description: "For individual developers",
  },
  {
    id: "team",
    name: "Team",
    minCredits: 10000,
    requestsPerMin: 300,
    requestsPerDay: 100_000,
    maxConcurrent: 50,
    description: "For teams and production apps",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    minCredits: 50000,
    requestsPerMin: 1000,
    requestsPerDay: 1_000_000,
    maxConcurrent: 200,
    description: "Unlimited scale for large operations",
  },
];

// ── Per-endpoint credit costs ──

export const ENDPOINT_COSTS: Record<string, number> = {
  "/v1/blocks/latest": 0.5,
  "/v1/transactions/{hash}": 1,
  "/v1/wallets/{address}/balance": 1,
  "/v1/chains/{chain}/status": 0.25,
  "/v1/contracts/{address}/call": 5,
  "/v1/tokens/{address}/metadata": 1,
  "/v1/events/{contract}": 3,
  "/v1/gas/estimate": 0.5,
};

export function getCostForEndpoint(endpoint: string): number {
  return ENDPOINT_COSTS[endpoint] ?? 1;
}

// ── Tier calculation ──

export function getTierForCredits(lifetimeCreditsPurchased: number): RateLimitTier {
  const sorted = [...RATE_LIMIT_TIERS].sort((a, b) => b.minCredits - a.minCredits);
  return sorted.find((t) => lifetimeCreditsPurchased >= t.minCredits) ?? RATE_LIMIT_TIERS[0];
}

// ── USDC on Base config ──

export const BASE_CHAIN_ID = 8453;
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const PAYMENT_RECIPIENT = "0xe5092bc216f3c26F97A4b4f90E70bE273d1dbba5";
export const MIN_PAYMENT_USDC = 3;

// USDC has 6 decimals
const USDC_DECIMALS = 6;

/**
 * Encode an ERC-20 `transfer(address,uint256)` call.
 * Returns the hex data to send to the USDC contract.
 */
export function encodeUsdcTransfer(to: string, amountUsdc: number): string {
  // Function selector for transfer(address,uint256)
  const selector = "a9059cbb";
  // Pad address to 32 bytes (left-pad with zeros)
  const addr = to.toLowerCase().replace("0x", "").padStart(64, "0");
  // Convert USDC amount to 6-decimal integer and pad to 32 bytes
  const rawAmount = Math.round(amountUsdc * 10 ** USDC_DECIMALS);
  const amountHex = rawAmount.toString(16).padStart(64, "0");
  return `0x${selector}${addr}${amountHex}`;
}

// ── Transaction history ──

export interface BillingTransaction {
  id: string;
  type: "deposit" | "usage";
  amount: number;
  credits: number;
  timestamp: string;
  txHash?: string;
  packageId?: string;
  status: "confirmed" | "pending" | "failed";
}

let cachedTxs: BillingTransaction[] = [];

export function getBillingTransactions(): BillingTransaction[] {
  return cachedTxs;
}

export function addBillingTransaction(tx: BillingTransaction): void {
  cachedTxs.unshift(tx);
}

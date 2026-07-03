const RPC_ENDPOINTS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  polygon: "https://polygon-rpc.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  base: "https://mainnet.base.org",
};

// Approximate USD prices for rough estimates
const USD_PRICES: Record<string, number> = {
  ethereum: 3500,
  polygon: 0.8,
  arbitrum: 3500,
  optimism: 3500,
  base: 3500,
};

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
}

async function rpcCall(chain: string, method: string, params: unknown[] = []): Promise<string | null> {
  const url = RPC_ENDPOINTS[chain];
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });

    const data: JsonRpcResponse = await response.json();
    if (data.error) return null;
    return data.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBlockNumber(chain: string): Promise<number> {
  const result = await rpcCall(chain, "eth_blockNumber");
  if (!result) return 0;
  return parseInt(result, 16);
}

export async function fetchGasPrice(chain: string): Promise<string> {
  const result = await rpcCall(chain, "eth_gasPrice");
  if (!result) return "\u2014";
  const wei = parseInt(result, 16);
  const gwei = wei / 1e9;
  return gwei.toFixed(1);
}

export async function fetchBalance(
  chain: string,
  address: string
): Promise<{ wei: string; eth: string; usdEstimate: string }> {
  const result = await rpcCall(chain, "eth_getBalance", [address, "latest"]);
  if (!result) return { wei: "0", eth: "0", usdEstimate: "\u2014" };

  const wei = BigInt(result);
  const eth = Number(wei) / 1e18;
  const price = USD_PRICES[chain] ?? 0;
  const usd = eth * price;

  return {
    wei: wei.toString(),
    eth: eth.toFixed(6),
    usdEstimate: usd > 0 ? `$${usd.toFixed(2)}` : "\u2014",
  };
}

export async function fetchPeerCount(chain: string): Promise<number> {
  const result = await rpcCall(chain, "net_peerCount");
  if (!result) return 0;
  return parseInt(result, 16);
}

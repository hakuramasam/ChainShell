import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getTierForCredits,
  getCostForEndpoint,
  addBillingTransaction,
  BASE_CHAIN_ID,
  USDC_BASE_ADDRESS,
  PAYMENT_RECIPIENT,
  encodeUsdcTransfer,
  type CreditPackage,
  type RateLimitTier,
} from "../lib/billing";

interface BillingState {
  creditBalance: number;
  lifetimeCreditsPurchased: number;
  currentTier: RateLimitTier;
  rateLimitUsage: { minute: number; day: number };
  isPurchasing: boolean;
  purchaseError: string | null;
  purchaseCredits: (pkg: CreditPackage) => Promise<string | null>;
  consumeCredits: (endpoint: string) => boolean;
  getRemainingCredits: () => number;
  getDailyUsagePercent: () => number;
  getMinuteUsagePercent: () => number;
  clearPurchaseError: () => void;
}

const BillingContext = createContext<BillingState | null>(null);

const STORAGE_KEY = "chainshell_billing";

export function BillingProvider({ children }: { children: ReactNode }) {
  const [creditBalance, setCreditBalance] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored).creditBalance ?? 0 : 0;
    } catch { return 0; }
  });

  const [lifetimeCreditsPurchased, setLifetimeCreditsPurchased] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored).lifetimeCreditsPurchased ?? 0 : 0;
    } catch { return 0; }
  });

  const [rateLimitUsage, setRateLimitUsage] = useState({ minute: 0, day: 0 });
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const currentTier = getTierForCredits(lifetimeCreditsPurchased);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ creditBalance, lifetimeCreditsPurchased }),
    );
  }, [creditBalance, lifetimeCreditsPurchased]);

  // Rate limit window resets
  useEffect(() => {
    const minuteInterval = setInterval(() => {
      setRateLimitUsage((prev) => ({ ...prev, minute: 0 }));
    }, 60_000);

    const dayInterval = setInterval(() => {
      setRateLimitUsage((prev) => ({ ...prev, day: 0 }));
    }, 86_400_000);

    return () => {
      clearInterval(minuteInterval);
      clearInterval(dayInterval);
    };
  }, []);

  const purchaseCredits = useCallback(async (pkg: CreditPackage): Promise<string | null> => {
    setPurchaseError(null);
    setIsPurchasing(true);

    try {
      // 1. Get the injected wallet provider
      const eth = (window as unknown as {
        ethereum?: {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
      }).ethereum;

      if (!eth) {
        throw new Error("No wallet detected. Install MetaMask or another Web3 wallet.");
      }

      // 2. Ensure user is on Base network (chain ID 8453)
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      if (parseInt(chainId, 16) !== BASE_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchErr: unknown) {
          const err = switchErr as { code?: number };
          if (err.code === 4902) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }],
            });
          } else {
            throw new Error("Please switch to the Base network in your wallet.");
          }
        }
      }

      // 3. Get the connected account
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No wallet connected. Please connect your wallet first.");
      }
      const from = accounts[0];

      // 4. Build the ERC-20 transfer calldata
      const data = encodeUsdcTransfer(PAYMENT_RECIPIENT, pkg.usdcPrice);

      // 5. Send the USDC transfer transaction
      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from,
          to: USDC_BASE_ADDRESS,
          data,
          value: "0x0",
        }],
      })) as string;

      if (!txHash) {
        throw new Error("Transaction was rejected or failed.");
      }

      // 6. Record the pending transaction
      addBillingTransaction({
        id: `tx_${Date.now().toString(36)}`,
        type: "deposit",
        amount: pkg.usdcPrice,
        credits: 0,
        timestamp: new Date().toISOString(),
        txHash,
        packageId: pkg.id,
        status: "pending",
      });

      // 7. Add credits (optimistic — tx is signed and broadcast)
      setCreditBalance((prev: number) => Math.round((prev + pkg.credits) * 100) / 100);
      setLifetimeCreditsPurchased((prev: number) => prev + pkg.credits);

      // Update transaction to confirmed
      addBillingTransaction({
        id: `tx_conf_${Date.now().toString(36)}`,
        type: "deposit",
        amount: pkg.usdcPrice,
        credits: pkg.credits,
        timestamp: new Date().toISOString(),
        txHash,
        packageId: pkg.id,
        status: "confirmed",
      });

      return txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setPurchaseError(msg);
      return null;
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const consumeCredits = useCallback((endpoint: string): boolean => {
    const cost = getCostForEndpoint(endpoint);

    if (rateLimitUsage.minute >= currentTier.requestsPerMin) return false;
    if (rateLimitUsage.day >= currentTier.requestsPerDay) return false;
    if (creditBalance < cost) return false;

    setCreditBalance((prev: number) => Math.round((prev - cost) * 100) / 100);
    setRateLimitUsage((prev) => ({
      minute: prev.minute + 1,
      day: prev.day + 1,
    }));

    return true;
  }, [creditBalance, rateLimitUsage, currentTier]);

  const getRemainingCredits = useCallback(() => creditBalance, [creditBalance]);

  const getDailyUsagePercent = useCallback(
    () => Math.min(100, (rateLimitUsage.day / currentTier.requestsPerDay) * 100),
    [rateLimitUsage.day, currentTier.requestsPerDay],
  );

  const getMinuteUsagePercent = useCallback(
    () => Math.min(100, (rateLimitUsage.minute / currentTier.requestsPerMin) * 100),
    [rateLimitUsage.minute, currentTier.requestsPerMin],
  );

  const clearPurchaseError = useCallback(() => setPurchaseError(null), []);

  return (
    <BillingContext.Provider
      value={{
        creditBalance,
        lifetimeCreditsPurchased,
        currentTier,
        rateLimitUsage,
        isPurchasing,
        purchaseError,
        purchaseCredits,
        consumeCredits,
        getRemainingCredits,
        getDailyUsagePercent,
        getMinuteUsagePercent,
        clearPurchaseError,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling(): BillingState {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}

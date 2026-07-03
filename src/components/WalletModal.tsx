import { useState, useEffect, useCallback } from "react";

export type WalletId = "metamask" | "coinbase" | "walletconnect" | "phantom" | "brave" | "injected";

export interface WalletOption {
  id: WalletId;
  name: string;
  icon: string;
  description: string;
  detectKey?: string; // key on window.ethereum to detect
  downloadUrl: string;
  mobile?: boolean; // available on mobile
  desktop?: boolean; // available on desktop
}

const WALLETS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect with MetaMask browser extension or mobile app",
    downloadUrl: "https://metamask.io/download",
    mobile: true,
    desktop: true,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    description: "Connect with Coinbase Wallet app or extension",
    downloadUrl: "https://www.coinbase.com/wallet",
    mobile: true,
    desktop: true,
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan a QR code with any WalletConnect-compatible mobile wallet",
    downloadUrl: "https://walletconnect.com/explorer",
    mobile: true,
    desktop: true,
  },
  {
    id: "brave",
    name: "Brave Wallet",
    icon: "🦁",
    description: "Built into the Brave browser",
    downloadUrl: "https://brave.com/wallet",
    mobile: false,
    desktop: true,
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    description: "Multi-chain wallet for Solana, Ethereum, and more",
    downloadUrl: "https://phantom.app/download",
    mobile: true,
    desktop: true,
  },
];

function detectWallets(): Set<WalletId> {
  const available = new Set<WalletId>();
  const eth = (window as unknown as Record<string, unknown>).ethereum as
    | { isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean; providers?: Record<string, unknown>[] }
    | undefined;

  if (!eth) return available;

  // Check for multi-provider (e.g. MetaMask + Coinbase both installed)
  const providers = eth.providers
    ? eth.providers
    : [eth];

  for (const p of providers) {
    const provider = p as Record<string, unknown>;
    if (provider.isMetaMask) available.add("metamask");
    if (provider.isCoinbaseWallet) available.add("coinbase");
    if (provider.isBraveWallet) available.add("brave");
  }

  // Generic injected
  if (available.size === 0 && eth) {
    available.add("injected");
  }

  // WalletConnect and Phantom are always "available" (they use their own connection flow)
  available.add("walletconnect");
  available.add("phantom");

  return available;
}

function getProviderForWallet(walletId: WalletId) {
  const eth = (window as unknown as Record<string, unknown>).ethereum as
    | { isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean; providers?: Record<string, unknown>[]; request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    | undefined;

  if (!eth) return null;

  const providers = eth.providers ? eth.providers : [eth];

  for (const p of providers) {
    const provider = p as Record<string, unknown>;
    if (walletId === "metamask" && provider.isMetaMask) return provider;
    if (walletId === "coinbase" && provider.isCoinbaseWallet) return provider;
    if (walletId === "brave" && provider.isBraveWallet) return provider;
  }

  // Fallback to main provider
  if (walletId === "injected") return eth;
  // MetaMask is often the default provider even without explicit flag
  if (walletId === "metamask" && eth.isMetaMask) return eth;

  return null;
}

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (walletId: WalletId, address: string) => void;
  onError: (msg: string) => void;
}

export default function WalletModal({ open, onClose, onConnect, onError }: WalletModalProps) {
  const [availableWallets, setAvailableWallets] = useState<Set<WalletId>>(new Set());
  const [connecting, setConnecting] = useState<WalletId | null>(null);
  const [showWcQr, setShowWcQr] = useState(false);
  const [wcUri, setWcUri] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAvailableWallets(detectWallets());
      setShowWcQr(false);
      setWcUri(null);
      setConnecting(null);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleWalletClick = useCallback(async (wallet: WalletOption) => {
    // WalletConnect opens QR flow
    if (wallet.id === "walletconnect") {
      setConnecting("walletconnect");
      setShowWcQr(true);

      // Generate a simulated WalletConnect URI (in production, this comes from the WC relay)
      const fakeTopic = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const uri = `wc:${fakeTopic}@2?relay-protocol=irn&symKey=${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      setWcUri(uri);

      // Simulate a mobile wallet scanning & approving after 4 seconds
      setTimeout(() => {
        const fakeAddr = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
        setConnecting(null);
        setShowWcQr(false);
        setWcUri(null);
        onConnect("walletconnect", fakeAddr);
      }, 4000);
      return;
    }

    // Phantom — redirect to app or extension
    if (wallet.id === "phantom") {
      const phantom = (window as unknown as Record<string, unknown>).phantom as
        | { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
        | undefined;

      if (phantom?.ethereum) {
        setConnecting("phantom");
        try {
          const accounts = (await phantom.ethereum.request({
            method: "eth_requestAccounts",
          })) as string[];
          if (accounts?.length) {
            onConnect("phantom", accounts[0]);
          }
        } catch (err) {
          onError(err instanceof Error ? err.message : "Phantom connection failed");
        } finally {
          setConnecting(null);
        }
        return;
      }

      // Phantom not installed — open deep link on mobile, download page on desktop
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        window.open(`https://phantom.app/ul/browse/${encodeURIComponent(window.location.origin)}`, "_blank");
      } else {
        window.open(wallet.downloadUrl, "_blank");
      }
      return;
    }

    // Injected wallets (MetaMask, Coinbase, Brave)
    setConnecting(wallet.id);
    try {
      const provider = getProviderForWallet(wallet.id) as
        | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        | null;

      if (!provider) {
        // Not installed — redirect
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (wallet.id === "metamask" && isMobile) {
          // MetaMask mobile deep link
          window.open(`https://metamask.app.link/dapp/${window.location.host}`, "_blank");
        } else {
          window.open(wallet.downloadUrl, "_blank");
        }
        setConnecting(null);
        return;
      }

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts?.length) {
        throw new Error("No accounts returned. Please unlock your wallet.");
      }

      onConnect(wallet.id, accounts[0]);
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        onError("Connection rejected by user.");
      } else {
        onError(err instanceof Error ? err.message : "Failed to connect wallet");
      }
    } finally {
      setConnecting(null);
    }
  }, [onConnect, onError]);

  if (!open) return null;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        {/* QR Code view for WalletConnect */}
        {showWcQr ? (
          <div className="wallet-modal__qr">
            <div className="wallet-modal__qr-header">
              <button className="wallet-modal__back" onClick={() => { setShowWcQr(false); setConnecting(null); }}>
                ← Back
              </button>
              <h2>WalletConnect</h2>
              <button className="wallet-modal__close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="wallet-modal__qr-body">
              <div className="wallet-modal__qr-code">
                <div className="wallet-modal__qr-placeholder">
                  {/* QR code rendered as CSS grid pattern */}
                  <div className="wallet-modal__qr-grid">
                    {Array.from({ length: 64 }, (_, i) => (
                      <div
                        key={i}
                        className={`wallet-modal__qr-cell${Math.random() > 0.45 ? " wallet-modal__qr-cell--filled" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="wallet-modal__qr-instructions">
                Scan this code with a WalletConnect-compatible mobile wallet
              </p>
              <div className="wallet-modal__qr-uri">
                <code>{wcUri ? `${wcUri.slice(0, 24)}...${wcUri.slice(-16)}` : "Generating..."}</code>
              </div>
              <div className="wallet-modal__qr-status">
                <span className="wallet-modal__qr-spinner" />
                Waiting for approval...
              </div>
              <div className="wallet-modal__qr-apps">
                <span className="wallet-modal__qr-apps-label">Popular mobile wallets:</span>
                <div className="wallet-modal__qr-apps-list">
                  <span>Trust Wallet</span>
                  <span>Rainbow</span>
                  <span>imToken</span>
                  <span>Argent</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="wallet-modal__header">
              <h2>Connect Wallet</h2>
              <p>Choose a wallet to sign in to ChainShell</p>
              <button className="wallet-modal__close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="wallet-modal__list">
              {WALLETS.map((wallet) => {
                const isDetected = availableWallets.has(wallet.id);
                const isConnecting = connecting === wallet.id;

                return (
                  <button
                    key={wallet.id}
                    className={`wallet-modal__wallet${isConnecting ? " wallet-modal__wallet--connecting" : ""}`}
                    onClick={() => handleWalletClick(wallet)}
                    disabled={connecting !== null}
                  >
                    <span className="wallet-modal__wallet-icon">{wallet.icon}</span>
                    <div className="wallet-modal__wallet-info">
                      <span className="wallet-modal__wallet-name">{wallet.name}</span>
                      <span className="wallet-modal__wallet-desc">
                        {isDetected && wallet.id !== "walletconnect" && wallet.id !== "phantom"
                          ? "Detected"
                          : wallet.id === "walletconnect"
                            ? "Scan QR code with mobile wallet"
                            : wallet.description}
                      </span>
                    </div>
                    {isConnecting ? (
                      <span className="wallet-modal__wallet-spinner" />
                    ) : isDetected && wallet.id !== "walletconnect" && wallet.id !== "phantom" ? (
                      <span className="wallet-modal__wallet-badge wallet-modal__wallet-badge--detected">Installed</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="wallet-modal__footer">
              <p>
                New to Ethereum?{" "}
                <a href="https://ethereum.org/en/wallets" target="_blank" rel="noopener noreferrer">
                  Learn about wallets
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

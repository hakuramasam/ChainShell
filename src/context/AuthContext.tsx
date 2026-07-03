import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface User {
  address: string;
  createdAt: string;
  apiKey: string;
  walletId?: string;
}

interface AuthState {
  user: User | null;
  isConnecting: boolean;
  isSigningIn: boolean;
  error: string | null;
  connectedAddress: string | null;
  connect: () => Promise<void>;
  connectWallet: (walletId: string, address: string) => void;
  signIn: () => Promise<void>;
  disconnect: () => void;
  regenerateApiKey: () => void;
  setError: (err: string | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "chainshell_user";

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = [4, 4, 4, 4];
  return (
    "cs_" +
    segments
      .map((len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(""))
      .join("-")
  );
}

function generateSiweMessage(address: string, nonce: string, chainId: number): string {
  const domain = window.location.host;
  const origin = window.location.origin;
  const issuedAt = new Date().toISOString();
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Welcome to ChainShell. Sign this message to authenticate.

URI: ${origin}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

function randomNonce(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
      if (!eth) {
        throw new Error("No wallet detected. Install MetaMask or another Web3 wallet.");
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned. Please unlock your wallet.");
      }
      setConnectedAddress(accounts[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectWallet = useCallback((_walletId: string, address: string) => {
    setError(null);
    setConnectedAddress(address);
  }, []);

  const signIn = useCallback(async () => {
    if (!connectedAddress) {
      setError("Connect your wallet first");
      return;
    }
    setError(null);
    setIsSigningIn(true);
    try {
      const eth = (window as unknown as {
        ethereum?: {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          providers?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }[];
        };
      }).ethereum;

      if (!eth) {
        throw new Error("No wallet provider available. Please use a browser wallet or reconnect.");
      }

      const provider = eth.providers?.length
        ? eth.providers[0]
        : eth;

      const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainIdHex, 16) || 1;

      const nonce = randomNonce();
      const message = generateSiweMessage(connectedAddress, nonce, chainId);

      // Sign the SIWE message
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, connectedAddress],
      })) as string;

      // Verify signature with server
      const res = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Signature verification failed");
      }

      const { token, address } = (await res.json()) as { token: string; address: string };

      // Store session token
      localStorage.setItem("chainshell_session", token);

      const newUser: User = {
        address: address || connectedAddress,
        createdAt: new Date().toISOString(),
        apiKey: generateApiKey(),
      };
      setUser(newUser);
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Signature rejected. You must sign to authenticate.");
      } else {
        setError(err instanceof Error ? err.message : "SIWE sign-in failed");
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [connectedAddress]);

  const disconnect = useCallback(() => {
    setUser(null);
    setConnectedAddress(null);
    setError(null);
  }, []);

  const regenerateApiKey = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, apiKey: generateApiKey() };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isConnecting,
        isSigningIn,
        error,
        connectedAddress,
        connect,
        connectWallet,
        signIn,
        disconnect,
        regenerateApiKey,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { AuthContext };

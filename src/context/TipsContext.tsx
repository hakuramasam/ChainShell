import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { getNextTip, type SponsoredTip } from "../lib/tips";

export interface EarnEvent {
  id: string;
  tipId: string;
  sponsor: string;
  headline: string;
  credits: number;
  timestamp: string;
}

interface TipsState {
  enabled: boolean;
  credits: number;
  impressions: number;
  history: EarnEvent[];
  currentTip: SponsoredTip | null;
  isShowing: boolean;
  toggleEnabled: () => void;
  showTip: () => void;
  dismissTip: () => void;
  impressionComplete: () => void;
}

const STORAGE_KEY = "chainshell_tips_prefs";

const TipsContext = createContext<TipsState | null>(null);

export function TipsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.enabled ?? false;
      }
    } catch {}
    return false;
  });

  const [credits, setCredits] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored).credits ?? 0;
    } catch {}
    return 0;
  });

  const [impressions, setImpressions] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored).impressions ?? 0;
    } catch {}
    return 0;
  });

  const [history, setHistory] = useState<EarnEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored).history ?? [];
    } catch {}
    return [];
  });

  const [currentTip, setCurrentTip] = useState<SponsoredTip | null>(null);
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled, credits, impressions, history }),
    );
  }, [enabled, credits, impressions, history]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev: boolean) => {
      if (prev) {
        setIsShowing(false);
        setCurrentTip(null);
      }
      return !prev;
    });
  }, []);

  const showTip = useCallback(() => {
    if (!enabled) return;
    const tip = getNextTip();
    setCurrentTip(tip);
    setIsShowing(true);
  }, [enabled]);

  const dismissTip = useCallback(() => {
    setIsShowing(false);
    setTimeout(() => setCurrentTip(null), 300);
  }, []);

  const impressionComplete = useCallback(() => {
    if (currentTip) {
      setCredits((prev: number) => Math.round((prev + currentTip.credits) * 10000) / 10000);
      setImpressions((prev: number) => prev + 1);
      setHistory((prev) => [
        {
          id: `ev_${Date.now().toString(36)}`,
          tipId: currentTip.id,
          sponsor: currentTip.sponsor,
          headline: currentTip.headline,
          credits: currentTip.credits,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  }, [currentTip]);

  return (
    <TipsContext.Provider
      value={{
        enabled,
        credits,
        impressions,
        history,
        currentTip,
        isShowing,
        toggleEnabled,
        showTip,
        dismissTip,
        impressionComplete,
      }}
    >
      {children}
    </TipsContext.Provider>
  );
}

export function useTips(): TipsState {
  const ctx = useContext(TipsContext);
  if (!ctx) throw new Error("useTips must be used within TipsProvider");
  return ctx;
}

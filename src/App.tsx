import { lazy, Suspense, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BillingProvider, useBilling } from "./context/BillingContext";
import { TipsProvider } from "./context/TipsContext";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import StatusBar from "./components/StatusBar";
import LoginPage from "./pages/LoginPage";

// Lazy-loaded views (code-split)
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const AgentsView = lazy(() => import("./components/AgentsView"));
const HiresView = lazy(() => import("./components/HiresView"));
const WalletsView = lazy(() => import("./components/WalletsView"));
const TransactionsView = lazy(() => import("./components/TransactionsView"));
const BlocksView = lazy(() => import("./components/BlocksView"));

export type ViewId = "terminal" | "wallets" | "transactions" | "blocks" | "dashboard" | "billing" | "agents" | "hires";

function ViewFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#525252" }}>
      Loading...
    </div>
  );
}

function AppShell() {
  const { user } = useAuth();
  const { creditBalance } = useBilling();
  const [activeChain, setActiveChain] = useState("ethereum");
  const [activeView, setActiveView] = useState<ViewId>("terminal");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!user) {
    return <LoginPage />;
  }

  const handleNavSelect = (view: ViewId) => {
    setActiveView(view);
    if (isMobile) setSidebarOpen(false);
  };

  const handleChainSelect = (chain: string) => {
    setActiveChain(chain);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="app">
      {isMobile && sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        activeChain={activeChain}
        onChainSelect={handleChainSelect}
        activeView={activeView}
        onNavSelect={handleNavSelect}
        open={sidebarOpen}
        isMobile={isMobile}
      />
      <div className="main">
        <div className="topbar">
          {isMobile && (
            <button
              className="topbar__hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <span />
              <span />
              <span />
            </button>
          )}
          <div className="topbar__title">
            <span className="topbar__icon">⬡</span>
            ChainShell
          </div>
          <div className="topbar__right">
            <button
              className="topbar__credits"
              onClick={() => setActiveView("billing")}
              title="View billing & credits"
            >
              <span className="topbar__credits-icon">◆</span>
              {creditBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </button>
            <span className="topbar__chain">
              <span className="topbar__dot topbar__dot--green" />
              {activeChain}
            </span>
          </div>
        </div>
        <div className="view-area">
          {activeView === "terminal" && <Terminal />}
          <Suspense fallback={<ViewFallback />}>
            {activeView === "dashboard" && <DashboardPage />}
            {activeView === "billing" && <BillingPage />}
            {activeView === "agents" && <AgentsView />}
            {activeView === "hires" && <HiresView />}
            {activeView === "wallets" && <WalletsView />}
            {activeView === "transactions" && <TransactionsView />}
            {activeView === "blocks" && <BlocksView />}
          </Suspense>
        </div>
        <StatusBar
          activeChain={activeChain}
          blockNumber={19_284_102}
          peerCount={42}
          latency={12}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TipsProvider>
        <BillingProvider>
          <AppShell />
        </BillingProvider>
      </TipsProvider>
    </AuthProvider>
  );
}

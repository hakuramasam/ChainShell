import { useAuth } from "../context/AuthContext";
import type { ViewId } from "../App";

interface SidebarProps {
  activeChain: string;
  onChainSelect: (chain: string) => void;
  activeView: ViewId;
  onNavSelect: (view: ViewId) => void;
  open: boolean;
  isMobile: boolean;
}

const chains = [
  { id: "ethereum", name: "Ethereum", status: "connected" as const },
  { id: "polygon", name: "Polygon", status: "connected" as const },
  { id: "arbitrum", name: "Arbitrum", status: "syncing" as const },
  { id: "optimism", name: "Optimism", status: "disconnected" as const },
  { id: "base", name: "Base", status: "disconnected" as const },
  { id: "solana", name: "Solana", status: "disconnected" as const },
];

const navItems: { id: ViewId; label: string; icon: string }[] = [
  { id: "terminal", label: "Terminal", icon: "▸" },
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "billing", label: "Billing", icon: "◆" },
  { id: "agents", label: "Agents", icon: "⬡" },
  { id: "hires", label: "My Hires", icon: "◎" },
  { id: "wallets", label: "Wallets", icon: "◇" },
  { id: "transactions", label: "Transactions", icon: "↗" },
  { id: "blocks", label: "Blocks", icon: "▦" },
];

export default function Sidebar({
  activeChain,
  onChainSelect,
  activeView,
  onNavSelect,
  open,
  isMobile,
}: SidebarProps) {
  const { user } = useAuth();
  const collapsed = !isMobile && !open;
  const shortAddr = user ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : null;

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}${isMobile && open ? " sidebar--open" : ""}`}>
      <div className="sidebar__header">
        <span className="sidebar__logo">
          <span className="sidebar__logo-icon">⬡</span>
          {!collapsed && <span className="sidebar__logo-text">ChainShell</span>}
        </span>
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__nav-item${activeView === item.id ? " sidebar__nav-item--active" : ""}`}
            onClick={() => onNavSelect(item.id)}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="sidebar__section">
          <div className="sidebar__section-title">Chains</div>
          <div className="sidebar__chains">
            {chains.map((chain) => (
              <button
                key={chain.id}
                className={`sidebar__chain${activeChain === chain.id ? " sidebar__chain--active" : ""}`}
                onClick={() => onChainSelect(chain.id)}
              >
                <span className={`sidebar__chain-dot sidebar__chain-dot--${chain.status}`} />
                <span className="sidebar__chain-name">{chain.name}</span>
                <span className="sidebar__chain-status">{chain.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar__footer">
        {!collapsed && shortAddr && (
          <div className="sidebar__wallet">
            <div className="sidebar__wallet-addr">{shortAddr}</div>
            <div className="sidebar__wallet-balance">Connected</div>
          </div>
        )}
      </div>
    </aside>
  );
}

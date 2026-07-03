import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBilling } from "../context/BillingContext";
import { getUsageStats, getUsageRecords, type UsageRecord } from "../lib/usage";

export default function DashboardPage() {
  const { user, disconnect, regenerateApiKey } = useAuth();
  const { creditBalance, currentTier } = useBilling();
  const [activeTab, setActiveTab] = useState<"overview" | "api-keys" | "usage">("overview");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const stats = getUsageStats();
  const records = getUsageRecords().slice(0, 20);

  const shortAddr = `${user.address.slice(0, 6)}...${user.address.slice(-4)}`;
  const maskedKey = showKey
    ? user.apiKey
    : user.apiKey.slice(0, 3) + "•".repeat(user.apiKey.length - 7) + user.apiKey.slice(-4);

  const copyKey = () => {
    navigator.clipboard.writeText(user.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__user">
          <div className="dashboard__avatar">
            <span className="dashboard__avatar-icon">⬡</span>
          </div>
          <div>
            <div className="dashboard__address">{shortAddr}</div>
            <div className="dashboard__joined">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="dashboard__header-actions">
          <button className="dashboard__btn dashboard__btn--ghost" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>

      <div className="dashboard__tabs">
        {(["overview", "api-keys", "usage"] as const).map((tab) => (
          <button
            key={tab}
            className={`dashboard__tab${activeTab === tab ? " dashboard__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" ? "Overview" : tab === "api-keys" ? "API Keys" : "Usage"}
          </button>
        ))}
      </div>

      <div className="dashboard__content">
        {activeTab === "overview" && (
          <div className="overview">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card__label">Total Requests</div>
                <div className="stat-card__value">{stats.totalRequests.toLocaleString()}</div>
                <div className="stat-card__trend stat-card__trend--up">+12% this week</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Avg Latency</div>
                <div className="stat-card__value">{stats.avgLatency}ms</div>
                <div className="stat-card__trend stat-card__trend--down">-3ms from last week</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Success Rate</div>
                <div className="stat-card__value">{stats.successRate}%</div>
                <div className="stat-card__trend stat-card__trend--up">99.2% uptime</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Credit Balance</div>
                <div className="stat-card__value">{creditBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="stat-card__trend stat-card__trend--up">{currentTier.name} tier</div>
              </div>
            </div>

            <div className="overview__section">
              <h3>Usage by Chain</h3>
              <div className="chain-bars">
                {stats.byChain.map((c) => (
                  <div key={c.chain} className="chain-bar">
                    <div className="chain-bar__label">
                      <span className="chain-bar__name">{c.chain}</span>
                      <span className="chain-bar__count">{c.count}</span>
                    </div>
                    <div className="chain-bar__track">
                      <div
                        className="chain-bar__fill"
                        style={{ width: `${(c.count / stats.byChain[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overview__section">
              <h3>Daily Requests (7 days)</h3>
              <div className="mini-chart">
                {stats.dailyUsage.map((d) => {
                  const max = Math.max(...stats.dailyUsage.map((x) => x.count));
                  return (
                    <div key={d.date} className="mini-chart__bar-group">
                      <div className="mini-chart__bar-wrap">
                        <div
                          className="mini-chart__bar"
                          style={{ height: `${(d.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="mini-chart__label">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "api-keys" && (
          <div className="api-keys">
            <div className="api-key-card">
              <div className="api-key-card__header">
                <div>
                  <h3>Primary API Key</h3>
                  <p className="api-key-card__desc">Use this key to authenticate API requests.</p>
                </div>
                <span className="api-key-card__badge api-key-card__badge--active">Active</span>
              </div>

              <div className="api-key-card__key-row">
                <code className="api-key-card__key">{maskedKey}</code>
                <button
                  className="api-key-card__btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? "Hide" : "Reveal"}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button className="api-key-card__btn" onClick={copyKey} title="Copy">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="api-key-card__usage">
                <span className="api-key-card__usage-label">Usage this month:</span>
                <span className="api-key-card__usage-value">{stats.totalRequests} / 10,000 requests</span>
              </div>

              <div className="api-key-card__actions">
                <button className="dashboard__btn dashboard__btn--outline" onClick={regenerateApiKey}>
                  Regenerate Key
                </button>
              </div>
            </div>

            <div className="api-key-docs">
              <h3>Quick Start</h3>
              <pre className="api-key-docs__code">
{`curl -H "Authorization: Bearer ${showKey ? user.apiKey : "cs_xxxx-xxxx-xxxx-xxxx"}" \\
  https://api.chainshell.io/v1/blocks/latest`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="usage-logs">
            <div className="usage-logs__header">
              <h3>Recent API Requests</h3>
              <span className="usage-logs__count">{records.length} latest</span>
            </div>
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: UsageRecord) => (
                    <tr key={r.id}>
                      <td className="usage-table__time">{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td>
                        <span className={`usage-table__method usage-table__method--${r.method.toLowerCase()}`}>
                          {r.method}
                        </span>
                      </td>
                      <td className="usage-table__endpoint">{r.endpoint}</td>
                      <td>
                        <span
                          className={`usage-table__status usage-table__status--${r.statusCode < 300 ? "ok" : r.statusCode < 500 ? "warn" : "err"}`}
                        >
                          {r.statusCode}
                        </span>
                      </td>
                      <td className="usage-table__latency">{r.latencyMs}ms</td>
                      <td className="usage-table__chain">{r.chain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

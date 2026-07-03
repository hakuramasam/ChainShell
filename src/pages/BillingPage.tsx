import { useState } from "react";
import { useBilling } from "../context/BillingContext";
import {
  CREDIT_PACKAGES,
  RATE_LIMIT_TIERS,
  PAYMENT_RECIPIENT,
  getBillingTransactions,
  type BillingTransaction,
} from "../lib/billing";

export default function BillingPage() {
  const {
    creditBalance,
    lifetimeCreditsPurchased,
    currentTier,
    rateLimitUsage,
    isPurchasing,
    purchaseError,
    purchaseCredits,
    clearPurchaseError,
    getDailyUsagePercent,
    getMinuteUsagePercent,
  } = useBilling();

  const [activeTab, setActiveTab] = useState<"packages" | "limits" | "history">("packages");
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const transactions = getBillingTransactions();

  const dailyPct = getDailyUsagePercent();
  const minutePct = getMinuteUsagePercent();

  const handlePurchase = async (pkgId: string) => {
    setSuccessTx(null);
    clearPurchaseError();
    const pkg = CREDIT_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) return;
    const txHash = await purchaseCredits(pkg);
    if (txHash) {
      setSuccessTx(txHash);
      setSelectedPkg(null);
    }
  };

  return (
    <div className="billing">
      {/* Credit balance hero */}
      <div className="billing__hero">
        <div className="billing__hero-left">
          <div className="billing__hero-label">Credit Balance</div>
          <div className="billing__hero-value">
            {creditBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="billing__hero-sub">
            Lifetime purchased: {lifetimeCreditsPurchased.toLocaleString()} credits
          </div>
        </div>
        <div className="billing__hero-right">
          <div className="billing__tier-badge">
            <span className="billing__tier-icon">◈</span>
            <span className="billing__tier-name">{currentTier.name} Tier</span>
          </div>
          <div className="billing__tier-limits">
            {currentTier.requestsPerMin.toLocaleString()} req/min &middot;{" "}
            {currentTier.requestsPerDay.toLocaleString()} req/day
          </div>
        </div>
      </div>

      {/* Payment feedback */}
      {purchaseError && (
        <div className="billing__alert billing__alert--error">
          <span className="billing__alert-icon">!</span>
          {purchaseError}
        </div>
      )}
      {successTx && (
        <div className="billing__alert billing__alert--success">
          <span className="billing__alert-icon">✓</span>
          Payment sent! Tx: {successTx.slice(0, 10)}...{successTx.slice(-8)} — Credits added to your balance.
        </div>
      )}

      {/* Rate limit meters */}
      <div className="billing__meters">
        <div className="billing__meter">
          <div className="billing__meter-header">
            <span className="billing__meter-label">Minute Usage</span>
            <span className="billing__meter-value">
              {rateLimitUsage.minute} / {currentTier.requestsPerMin}
            </span>
          </div>
          <div className="billing__meter-track">
            <div
              className={`billing__meter-fill${minutePct > 80 ? " billing__meter-fill--warn" : ""}`}
              style={{ width: `${minutePct}%` }}
            />
          </div>
        </div>
        <div className="billing__meter">
          <div className="billing__meter-header">
            <span className="billing__meter-label">Daily Usage</span>
            <span className="billing__meter-value">
              {rateLimitUsage.day.toLocaleString()} / {currentTier.requestsPerDay.toLocaleString()}
            </span>
          </div>
          <div className="billing__meter-track">
            <div
              className={`billing__meter-fill${dailyPct > 80 ? " billing__meter-fill--warn" : ""}`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="billing__tabs">
        {(["packages", "limits", "history"] as const).map((tab) => (
          <button
            key={tab}
            className={`billing__tab${activeTab === tab ? " billing__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "packages" ? "Buy Credits" : tab === "limits" ? "Rate Limits" : "History"}
          </button>
        ))}
      </div>

      <div className="billing__content">
        {/* Buy Credits */}
        {activeTab === "packages" && (
          <div className="billing__packages">
            <div className="billing__packages-grid">
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`billing__pkg${pkg.popular ? " billing__pkg--popular" : ""}${selectedPkg === pkg.id ? " billing__pkg--selected" : ""}`}
                  onClick={() => setSelectedPkg(pkg.id)}
                >
                  {pkg.popular && <div className="billing__pkg-badge">Best Value</div>}
                  <div className="billing__pkg-name">{pkg.name}</div>
                  <div className="billing__pkg-price">
                    <span className="billing__pkg-usdc">${pkg.usdcPrice}</span>
                    <span className="billing__pkg-currency">USDC</span>
                  </div>
                  <div className="billing__pkg-credits">
                    {pkg.credits.toLocaleString()} credits
                  </div>
                  <div className="billing__pkg-duration">{pkg.duration}</div>
                  <div className="billing__pkg-rate">
                    ${(pkg.usdcPrice / pkg.credits * 1000).toFixed(2)} / 1k credits
                  </div>
                  <button
                    className="billing__pkg-btn"
                    disabled={isPurchasing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchase(pkg.id);
                    }}
                  >
                    {isPurchasing && selectedPkg === pkg.id ? (
                      <span className="billing__spinner" />
                    ) : (
                      "Pay with USDC"
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className="billing__packages-note">
              <span className="billing__note-icon">i</span>
              Payments are processed on <strong>Base</strong> (Chain ID 8453). USDC is sent directly
              from your wallet to the ChainShell treasury. Your wallet will prompt you to confirm the
              transfer. Credits are added immediately after you sign.
            </div>
            <div className="billing__packages-note">
              <span className="billing__note-icon">◈</span>
              Treasury: <code className="billing__code">{PAYMENT_RECIPIENT}</code>
            </div>
          </div>
        )}

        {/* Rate Limits */}
        {activeTab === "limits" && (
          <div className="billing__limits">
            <div className="billing__limits-grid">
              {RATE_LIMIT_TIERS.map((tier) => {
                const isActive = tier.id === currentTier.id;
                return (
                  <div
                    key={tier.id}
                    className={`billing__limit-card${isActive ? " billing__limit-card--active" : ""}`}
                  >
                    {isActive && <div className="billing__limit-active">Current</div>}
                    <div className="billing__limit-name">{tier.name}</div>
                    <div className="billing__limit-desc">{tier.description}</div>
                    <div className="billing__limit-req">
                      {tier.minCredits > 0 ? (
                        <span>{tier.minCredits.toLocaleString()}+ credits purchased</span>
                      ) : (
                        <span>No purchase required</span>
                      )}
                    </div>
                    <div className="billing__limit-specs">
                      <div className="billing__limit-spec">
                        <span className="billing__limit-spec-val">{tier.requestsPerMin.toLocaleString()}</span>
                        <span className="billing__limit-spec-label">req/min</span>
                      </div>
                      <div className="billing__limit-spec">
                        <span className="billing__limit-spec-val">{tier.requestsPerDay.toLocaleString()}</span>
                        <span className="billing__limit-spec-label">req/day</span>
                      </div>
                      <div className="billing__limit-spec">
                        <span className="billing__limit-spec-val">{tier.maxConcurrent}</span>
                        <span className="billing__limit-spec-label">concurrent</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div className="billing__history">
            {transactions.length === 0 ? (
              <div className="billing__empty">
                <p>No transactions yet. Buy credits to get started.</p>
              </div>
            ) : (
              <div className="usage-table-wrap">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Credits</th>
                      <th>Status</th>
                      <th>Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx: BillingTransaction) => (
                      <tr key={tx.id}>
                        <td className="usage-table__time">
                          {new Date(tx.timestamp).toLocaleDateString()}{" "}
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>
                          <span className={`billing__tx-type billing__tx-type--${tx.type}`}>
                            {tx.type === "deposit" ? "Deposit" : "Usage"}
                          </span>
                        </td>
                        <td>
                          {tx.type === "deposit" ? (
                            <span className="billing__tx-amount">${tx.amount} USDC</span>
                          ) : (
                            <span className="billing__tx-muted">&mdash;</span>
                          )}
                        </td>
                        <td>
                          <span className={tx.credits >= 0 ? "billing__tx-credits-pos" : "billing__tx-credits-neg"}>
                            {tx.credits >= 0 ? "+" : ""}
                            {tx.credits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td>
                          <span className={`billing__tx-status billing__tx-status--${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="billing__tx-hash">
                          {tx.txHash ? (
                            <a
                              href={`https://basescan.org/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="billing__tx-link"
                            >
                              {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                            </a>
                          ) : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import {
  getActiveHires,
  addHireMessage,
  createHire,
  type ActiveHire,
  type Agent,
} from "../lib/agents";
import { encodeUsdcTransfer, USDC_BASE_ADDRESS, PAYMENT_RECIPIENT, BASE_CHAIN_ID } from "../lib/billing";

export default function HiresView() {
  const [hires, setHires] = useState<ActiveHire[]>(getActiveHires());
  const [selectedHire, setSelectedHire] = useState<ActiveHire | null>(hires[0] ?? null);
  const [messageInput, setMessageInput] = useState("");
  const [hiringAgent, setHiringAgent] = useState<Agent | null>(null);
  const [hireTask, setHireTask] = useState("");
  const [hireBudget, setHireBudget] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for agent hire events from the marketplace
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.agent) {
        setHiringAgent(detail.agent);
        setHireTask("");
        setHireBudget("");
        setPayError(null);
      }
    };
    window.addEventListener("chainshell:hire-agent", handler);
    return () => window.removeEventListener("chainshell:hire-agent", handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedHire?.messages.length]);

  const refreshHires = () => {
    setHires(getActiveHires());
  };

  const handleSendMessage = () => {
    if (!selectedHire || !messageInput.trim()) return;
    addHireMessage(selectedHire.id, "user", messageInput.trim());
    setMessageInput("");
    refreshHires();
    // Simulate agent reply
    setTimeout(() => {
      addHireMessage(selectedHire.id, "agent", "Got it. I'll review and get back to you shortly.");
      refreshHires();
    }, 2000);
  };

  const handleHireSubmit = async () => {
    if (!hiringAgent || !hireTask.trim()) return;
    setPayError(null);
    setIsPaying(true);

    try {
      const budget = parseFloat(hireBudget) || hiringAgent.hourlyRateUsdc;
      const eth = (window as unknown as {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
      }).ethereum;

      if (!eth) throw new Error("No wallet detected.");

      // Switch to Base
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
            throw new Error("Please switch to the Base network.");
          }
        }
      }

      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (!accounts?.length) throw new Error("No wallet connected.");

      // Send USDC payment for agent hire
      const data = encodeUsdcTransfer(PAYMENT_RECIPIENT, budget);
      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: accounts[0],
          to: USDC_BASE_ADDRESS,
          data,
          value: "0x0",
        }],
      })) as string;

      if (!txHash) throw new Error("Transaction rejected.");

      // Create the hire record
      const hire = createHire(
        { agentId: hiringAgent.id, taskDescription: hireTask.trim(), budgetUsdc: budget },
        hiringAgent.name,
      );

      refreshHires();
      setSelectedHire(hire);
      setHiringAgent(null);
      setHireTask("");
      setHireBudget("");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsPaying(false);
    }
  };

  // Show hire modal
  if (hiringAgent) {
    return (
      <div className="hires">
        <div className="hires__hire-form">
          <div className="hires__hire-header">
            <span className="hires__hire-avatar">{hiringAgent.avatar}</span>
            <div>
              <h3>Hire {hiringAgent.name}</h3>
              <p className="hires__hire-rate">${hiringAgent.hourlyRateUsdc} USDC/hr &middot; {hiringAgent.responseTime} response</p>
            </div>
          </div>

          {payError && (
            <div className="hires__error">
              <span>!</span> {payError}
            </div>
          )}

          <label className="hires__label">Describe your task</label>
          <textarea
            className="hires__textarea"
            placeholder="e.g. Create an ERC-721A collection with Merkle whitelist, 10k supply, on Base..."
            value={hireTask}
            onChange={(e) => setHireTask(e.target.value)}
            rows={4}
          />

          <label className="hires__label">Budget (USDC)</label>
          <input
            className="hires__input"
            type="number"
            placeholder={`Min $${hiringAgent.hourlyRateUsdc}`}
            value={hireBudget}
            onChange={(e) => setHireBudget(e.target.value)}
            min={hiringAgent.hourlyRateUsdc}
          />

          <div className="hires__hire-actions">
            <button className="hires__btn hires__btn--ghost" onClick={() => setHiringAgent(null)}>Cancel</button>
            <button
              className="hires__btn hires__btn--primary"
              disabled={!hireTask.trim() || isPaying}
              onClick={handleHireSubmit}
            >
              {isPaying ? <span className="hires__spinner" /> : `Pay & Hire ($${parseFloat(hireBudget) || hiringAgent.hourlyRateUsdc} USDC)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hires">
      <div className="hires__layout">
        {/* Sidebar: hire list */}
        <div className="hires__sidebar">
          <div className="hires__sidebar-header">
            <h3>Active Hires</h3>
            <span className="hires__count">{hires.length}</span>
          </div>
          <div className="hires__list">
            {hires.length === 0 ? (
              <div className="hires__empty-list">
                <p>No active hires.</p>
                <p className="hires__empty-hint">Browse the Agent Marketplace to hire an agent.</p>
              </div>
            ) : (
              hires.map((hire) => (
                <button
                  key={hire.id}
                  className={`hires__item${selectedHire?.id === hire.id ? " hires__item--active" : ""}`}
                  onClick={() => setSelectedHire(hire)}
                >
                  <div className="hires__item-name">{hire.agentName}</div>
                  <div className="hires__item-preview">
                    {hire.messages[hire.messages.length - 1]?.content.slice(0, 60)}...
                  </div>
                  <div className="hires__item-meta">
                    <span className={`hires__status hires__status--${hire.status}`}>{hire.status}</span>
                    <span className="hires__item-budget">${hire.budgetUsdc} USDC</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main: chat view */}
        <div className="hires__chat">
          {selectedHire ? (
            <>
              <div className="hires__chat-header">
                <div>
                  <h3>{selectedHire.agentName}</h3>
                  <span className={`hires__status hires__status--${selectedHire.status}`}>{selectedHire.status}</span>
                </div>
                <span className="hires__chat-budget">${selectedHire.budgetUsdc} USDC</span>
              </div>

              <div className="hires__chat-task">
                <strong>Task:</strong> {selectedHire.taskDescription}
              </div>

              <div className="hires__messages">
                {selectedHire.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`hires__msg hires__msg--${msg.from}`}
                  >
                    <div className="hires__msg-meta">
                      <span className="hires__msg-from">{msg.from === "user" ? "You" : selectedHire.agentName}</span>
                      <span className="hires__msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="hires__msg-content">{msg.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="hires__input-row">
                <input
                  className="hires__chat-input"
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                />
                <button
                  className="hires__send-btn"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="hires__no-selection">
              <span className="hires__no-selection-icon">💬</span>
              <p>Select a hire to view the conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

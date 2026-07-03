import { useState } from "react";
import { type Agent, SKILL_LABELS, type AgentSkill } from "../lib/agents";

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

export default function AgentDetailModal({ agent, onClose }: Props) {
  const [tab, setTab] = useState<"overview" | "reviews">("overview");

  if (!agent) return null;

  return (
    <div className="agent-modal-overlay" onClick={onClose}>
      <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-modal__header">
          <div className="agent-modal__header-left">
            <span className="agent-modal__avatar">{agent.avatar}</span>
            <div>
              <div className="agent-modal__name">
                {agent.name}
                {agent.verified && <span className="agents__verified">✓</span>}
                <span className={`agents__online-dot agents__online-dot--sm${agent.online ? " agents__online-dot--on" : ""}`} />
              </div>
              <div className="agent-modal__tagline">{agent.tagline}</div>
            </div>
          </div>
          <button className="agent-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Quick stats */}
        <div className="agent-modal__stats">
          <div className="agent-modal__stat">
            <span className="agent-modal__stat-val">{agent.rating}</span>
            <span className="agent-modal__stat-label">Rating</span>
          </div>
          <div className="agent-modal__stat">
            <span className="agent-modal__stat-val">{agent.completedJobs}</span>
            <span className="agent-modal__stat-label">Jobs</span>
          </div>
          <div className="agent-modal__stat">
            <span className="agent-modal__stat-val">{agent.successRate}%</span>
            <span className="agent-modal__stat-label">Success</span>
          </div>
          <div className="agent-modal__stat">
            <span className="agent-modal__stat-val">${agent.hourlyRateUsdc}</span>
            <span className="agent-modal__stat-label">/hr</span>
          </div>
          <div className="agent-modal__stat">
            <span className="agent-modal__stat-val">{agent.responseTime}</span>
            <span className="agent-modal__stat-label">Response</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="agent-modal__tabs">
          <button
            className={`agent-modal__tab${tab === "overview" ? " agent-modal__tab--active" : ""}`}
            onClick={() => setTab("overview")}
          >Overview</button>
          <button
            className={`agent-modal__tab${tab === "reviews" ? " agent-modal__tab--active" : ""}`}
            onClick={() => setTab("reviews")}
          >Reviews ({agent.reviewCount})</button>
        </div>

        <div className="agent-modal__content">
          {tab === "overview" && (
            <div className="agent-modal__overview">
              <p className="agent-modal__desc">{agent.description}</p>

              <div className="agent-modal__section">
                <h4>Skills</h4>
                <div className="agent-modal__skill-list">
                  {agent.skills.map((s) => (
                    <span key={s} className="agents__skill-tag">{SKILL_LABELS[s as AgentSkill] ?? s}</span>
                  ))}
                </div>
              </div>

              <div className="agent-modal__section">
                <h4>Chain Expertise</h4>
                <div className="agent-modal__chain-list">
                  {agent.chainExpertise.map((c) => (
                    <span key={c} className="agents__chain-tag">{c}</span>
                  ))}
                </div>
              </div>

              <div className="agent-modal__section">
                <h4>Member Since</h4>
                <p className="agent-modal__meta">{new Date(agent.joinedAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>
              </div>
            </div>
          )}

          {tab === "reviews" && (
            <div className="agent-modal__reviews">
              {agent.reviews.length === 0 ? (
                <p className="agent-modal__no-reviews">No reviews yet.</p>
              ) : (
                agent.reviews.map((r) => (
                  <div key={r.id} className="agent-modal__review">
                    <div className="agent-modal__review-header">
                      <span className="agent-modal__reviewer">{r.reviewer}</span>
                      <span className="agent-modal__review-rating">
                        {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                      </span>
                      <span className="agent-modal__review-date">{r.timestamp}</span>
                    </div>
                    <div className="agent-modal__review-task">{r.taskType}</div>
                    <p className="agent-modal__review-text">{r.comment}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Hire CTA */}
        <div className="agent-modal__footer">
          <div className="agent-modal__price">
            Starting at <strong>${agent.hourlyRateUsdc} USDC</strong>/hr
          </div>
          <button
            className="agent-modal__hire-btn"
            onClick={() => {
              // Navigate to hire flow — for now, open in terminal
              window.dispatchEvent(new CustomEvent("chainshell:hire-agent", { detail: { agent } }));
              onClose();
            }}
          >
            Hire {agent.name}
          </button>
        </div>
      </div>
    </div>
  );
}

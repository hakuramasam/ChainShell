import { useState } from "react";
import {
  getAllAgents,
  searchAgents,
  SKILL_LABELS,
  type Agent,
  type AgentSkill,
} from "../lib/agents";
import AgentDetailModal from "./AgentDetailModal";

const ALL_CHAINS = ["Ethereum", "Base", "Arbitrum", "Polygon", "Optimism", "Solana"];

export default function AgentsView() {
  const [query, setQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState<AgentSkill | "">("");
  const [chainFilter, setChainFilter] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "jobs" | "price">("rating");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  let agents = getAllAgents();

  if (query) agents = searchAgents(query);
  if (skillFilter) agents = agents.filter((a) => a.skills.includes(skillFilter));
  if (chainFilter) agents = agents.filter((a) =>
    a.chainExpertise.some((c) => c.toLowerCase() === chainFilter.toLowerCase()),
  );

  agents = [...agents].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "jobs") return b.completedJobs - a.completedJobs;
    return a.hourlyRateUsdc - b.hourlyRateUsdc;
  });

  return (
    <div className="agents">
      <div className="agents__header">
        <div>
          <h2 className="agents__title">Agent Marketplace</h2>
          <p className="agents__subtitle">
            Browse, hire, and pay specialized Web3 agents to build your project.
          </p>
        </div>
        <div className="agents__stats">
          <span className="agents__stat">{agents.length} agents</span>
          <span className="agents__stat-dot">·</span>
          <span className="agents__stat">{agents.filter((a) => a.online).length} online</span>
        </div>
      </div>

      {/* Filters */}
      <div className="agents__filters">
        <div className="agents__search-wrap">
          <input
            className="agents__search"
            type="text"
            placeholder="Search by name, skill, or chain..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="agents__filter-row">
          <select
            className="agents__select"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value as AgentSkill | "")}
          >
            <option value="">All Skills</option>
            {Object.entries(SKILL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            className="agents__select"
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
          >
            <option value="">All Chains</option>
            {ALL_CHAINS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="agents__select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "rating" | "jobs" | "price")}
          >
            <option value="rating">Sort: Rating</option>
            <option value="jobs">Sort: Jobs Done</option>
            <option value="price">Sort: Price (Low)</option>
          </select>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="agents__grid">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className="agents__card"
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="agents__card-top">
              <div className="agents__card-avatar">{agent.avatar}</div>
              <div className="agents__card-info">
                <div className="agents__card-name">
                  {agent.name}
                  {agent.verified && <span className="agents__verified" title="Verified">✓</span>}
                </div>
                <div className="agents__card-tagline">{agent.tagline}</div>
              </div>
              <span className={`agents__online-dot${agent.online ? " agents__online-dot--on" : ""}`} />
            </div>

            <div className="agents__card-skills">
              {agent.skills.slice(0, 3).map((s) => (
                <span key={s} className="agents__skill-tag">{SKILL_LABELS[s as AgentSkill] ?? s}</span>
              ))}
            </div>

            <div className="agents__card-stats">
              <div className="agents__card-stat">
                <span className="agents__card-stat-val">{agent.rating}</span>
                <span className="agents__card-stat-label">★ ({agent.reviewCount})</span>
              </div>
              <div className="agents__card-stat">
                <span className="agents__card-stat-val">{agent.completedJobs}</span>
                <span className="agents__card-stat-label">jobs</span>
              </div>
              <div className="agents__card-stat">
                <span className="agents__card-stat-val">{agent.successRate}%</span>
                <span className="agents__card-stat-label">success</span>
              </div>
              <div className="agents__card-stat">
                <span className="agents__card-stat-val">${agent.hourlyRateUsdc}</span>
                <span className="agents__card-stat-label">/hr</span>
              </div>
            </div>

            <div className="agents__card-chains">
              {agent.chainExpertise.slice(0, 4).map((c) => (
                <span key={c} className="agents__chain-tag">{c}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="agents__empty">
          <p>No agents match your filters. Try broadening your search.</p>
        </div>
      )}

      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

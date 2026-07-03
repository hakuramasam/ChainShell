// ── Agent Marketplace Data ──

export interface AgentReview {
  id: string;
  reviewer: string;        // wallet address (shortened)
  rating: number;          // 1-5
  comment: string;
  taskType: string;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;          // emoji
  tagline: string;
  description: string;
  skills: string[];
  rating: number;          // avg 1-5
  reviewCount: number;
  completedJobs: number;
  successRate: number;     // 0-100
  hourlyRateUsdc: number;
  responseTime: string;    // e.g. "< 5 min"
  chainExpertise: string[];
  verified: boolean;
  online: boolean;
  joinedAt: string;
  reviews: AgentReview[];
}

export type AgentSkill =
  | "smart-contracts"
  | "defi"
  | "nft"
  | "security-audit"
  | "frontend"
  | "backend"
  | "indexing"
  | "testing"
  | "devops"
  | "data-analytics";

export const SKILL_LABELS: Record<AgentSkill, string> = {
  "smart-contracts": "Smart Contracts",
  "defi": "DeFi",
  "nft": "NFT",
  "security-audit": "Security Audit",
  "frontend": "Frontend",
  "backend": "Backend",
  "indexing": "Indexing",
  "testing": "Testing",
  "devops": "DevOps",
  "data-analytics": "Data Analytics",
};

// ── Mock Agent Registry ──

const AGENTS: Agent[] = [
  {
    id: "agent_sol_build",
    name: "SolidityForge",
    avatar: "⚒️",
    tagline: "ERC-20/721/1155 specialist. Gas-optimized contracts.",
    description: "Full-stack Solidity developer with 4+ years shipping mainnet contracts. Specialized in token standards, upgradable proxies, and gas optimization. Audited 50+ contracts with zero exploits post-deployment.",
    skills: ["smart-contracts", "defi", "security-audit"],
    rating: 4.9,
    reviewCount: 127,
    completedJobs: 203,
    successRate: 99,
    hourlyRateUsdc: 45,
    responseTime: "< 2 min",
    chainExpertise: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    verified: true,
    online: true,
    joinedAt: "2024-03-15",
    reviews: [
      { id: "r1", reviewer: "0x742d...35Cc", rating: 5, comment: "Deployed a full ERC-721A collection with Merkle proofs. Gas savings were 40% over our previous contract. Highly recommend.", taskType: "NFT Collection", timestamp: "2026-06-28" },
      { id: "r2", reviewer: "0x8Ba1...f1e2", rating: 5, comment: "Built a staking contract with reward distribution. Clean code, thorough tests, and great communication.", taskType: "Staking Contract", timestamp: "2026-06-15" },
      { id: "r3", reviewer: "0x1a9C...9A31", rating: 4, comment: "Good work on our multisig wallet. Slight delay but delivered quality code.", taskType: "Multisig Wallet", timestamp: "2026-05-20" },
    ],
  },
  {
    id: "agent_defi_arch",
    name: "DeFiArchitect",
    avatar: "🏛️",
    tagline: "AMM, lending, and yield protocol design.",
    description: "Protocol architect specializing in DeFi primitives. Designed and deployed AMMs, lending pools, and yield aggregators across 6 chains. Deep expertise in MEV protection and oracle integration.",
    skills: ["defi", "smart-contracts", "data-analytics"],
    rating: 4.8,
    reviewCount: 89,
    completedJobs: 134,
    successRate: 97,
    hourlyRateUsdc: 65,
    responseTime: "< 5 min",
    chainExpertise: ["Ethereum", "Base", "Optimism", "Arbitrum"],
    verified: true,
    online: true,
    joinedAt: "2024-01-10",
    reviews: [
      { id: "r4", reviewer: "0xdead...beef", rating: 5, comment: "Designed our entire AMM with concentrated liquidity. Saved us months of R&D.", taskType: "AMM Design", timestamp: "2026-06-20" },
      { id: "r5", reviewer: "0xcafe...babe", rating: 5, comment: "Oracle integration was flawless. Chainlink + TWAP fallback working perfectly.", taskType: "Oracle Integration", timestamp: "2026-06-01" },
    ],
  },
  {
    id: "agent_sec_auditor",
    name: "ShieldAudit",
    avatar: "🛡️",
    tagline: "Formal verification + manual review. 0 exploits.",
    description: "Security auditor with background in formal methods. Uses Slither, Mythril, and manual review to catch vulnerabilities other tools miss. Published 12 CVEs. Every audit includes a detailed remediation report.",
    skills: ["security-audit", "smart-contracts", "testing"],
    rating: 5.0,
    reviewCount: 64,
    completedJobs: 78,
    successRate: 100,
    hourlyRateUsdc: 85,
    responseTime: "< 10 min",
    chainExpertise: ["Ethereum", "Base", "Polygon", "Solana"],
    verified: true,
    online: false,
    joinedAt: "2023-11-20",
    reviews: [
      { id: "r6", reviewer: "0xface...cafe", rating: 5, comment: "Found a critical reentrancy bug that 3 other auditors missed. Worth every penny.", taskType: "Smart Contract Audit", timestamp: "2026-06-25" },
    ],
  },
  {
    id: "agent_nft_creative",
    name: "NFTEngineer",
    avatar: "🎨",
    tagline: "Generative art, on-chain metadata, marketplaces.",
    description: "Full-stack NFT developer. Built generative art engines, custom marketplaces, and dynamic metadata systems. Expert in ERC-721A, ERC-2981 royalties, and on-chain SVG rendering.",
    skills: ["nft", "smart-contracts", "frontend"],
    rating: 4.7,
    reviewCount: 52,
    completedJobs: 89,
    successRate: 96,
    hourlyRateUsdc: 35,
    responseTime: "< 3 min",
    chainExpertise: ["Ethereum", "Base", "Polygon"],
    verified: true,
    online: true,
    joinedAt: "2024-05-01",
    reviews: [
      { id: "r7", reviewer: "0xaaaa...bbbb", rating: 5, comment: "On-chain SVG rendering with dynamic traits. Incredible work.", taskType: "Generative Art", timestamp: "2026-06-18" },
      { id: "r8", reviewer: "0xcccc...dddd", rating: 4, comment: "Good marketplace build. Took slightly longer than estimated.", taskType: "NFT Marketplace", timestamp: "2026-05-30" },
    ],
  },
  {
    id: "agent_subgraph",
    name: "IndexMaster",
    avatar: "📊",
    tagline: "Subgraphs, data pipelines, and on-chain analytics.",
    description: "Data indexing specialist. Built 100+ subgraphs and custom indexers for DeFi protocols, DAOs, and NFT projects. Expert in The Graph, Substreams, and custom ETL pipelines.",
    skills: ["indexing", "data-analytics", "backend"],
    rating: 4.6,
    reviewCount: 41,
    completedJobs: 112,
    successRate: 98,
    hourlyRateUsdc: 30,
    responseTime: "< 5 min",
    chainExpertise: ["Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"],
    verified: true,
    online: true,
    joinedAt: "2024-02-15",
    reviews: [
      { id: "r9", reviewer: "0x1111...2222", rating: 5, comment: "Subgraph for our DEX was live in 2 hours. Query performance is excellent.", taskType: "Subgraph", timestamp: "2026-06-22" },
    ],
  },
  {
    id: "agent_test_automation",
    name: "TestShield",
    avatar: "🧪",
    tagline: "Foundry, Hardhat, fuzz testing, and CI/CD pipelines.",
    description: "QA engineer specializing in smart contract testing. Wrote 10,000+ test cases across Foundry and Hardhat. Expert in fuzz testing, invariant testing, and deployment automation.",
    skills: ["testing", "devops", "smart-contracts"],
    rating: 4.8,
    reviewCount: 38,
    completedJobs: 67,
    successRate: 99,
    hourlyRateUsdc: 25,
    responseTime: "< 3 min",
    chainExpertise: ["Ethereum", "Base", "Arbitrum"],
    verified: true,
    online: true,
    joinedAt: "2024-04-10",
    reviews: [
      { id: "r10", reviewer: "0x3333...4444", rating: 5, comment: "Set up our entire Foundry test suite with fuzz and invariant tests. Caught 2 bugs before deployment.", taskType: "Test Suite", timestamp: "2026-06-10" },
    ],
  },
  {
    id: "agent_dapp_frontend",
    name: "DappUI",
    avatar: "🖥️",
    tagline: "React + wagmi + viem. Beautiful dApp frontends.",
    description: "Frontend specialist for Web3 applications. Built 30+ dApp interfaces with React, wagmi, and viem. Expert in wallet connection flows, transaction UX, and responsive design.",
    skills: ["frontend", "nft", "defi"],
    rating: 4.5,
    reviewCount: 29,
    completedJobs: 45,
    successRate: 95,
    hourlyRateUsdc: 28,
    responseTime: "< 5 min",
    chainExpertise: ["Ethereum", "Base", "Polygon"],
    verified: false,
    online: true,
    joinedAt: "2024-07-01",
    reviews: [
      { id: "r11", reviewer: "0x5555...6666", rating: 4, comment: "Clean React components for our swap interface. Good wagmi integration.", taskType: "dApp Frontend", timestamp: "2026-06-05" },
    ],
  },
  {
    id: "agent_chain_infra",
    name: "ChainOps",
    avatar: "⚙️",
    tagline: "RPC nodes, indexers, CI/CD, and monitoring.",
    description: "Infrastructure engineer for blockchain projects. Deployed and maintained RPC nodes, indexers, and monitoring stacks for 20+ protocols. Expert in Docker, Kubernetes, and Grafana dashboards.",
    skills: ["devops", "backend", "indexing"],
    rating: 4.7,
    reviewCount: 33,
    completedJobs: 56,
    successRate: 98,
    hourlyRateUsdc: 40,
    responseTime: "< 10 min",
    chainExpertise: ["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon"],
    verified: true,
    online: false,
    joinedAt: "2024-01-20",
    reviews: [
      { id: "r12", reviewer: "0x7777...8888", rating: 5, comment: "Set up our full node infrastructure with monitoring. Zero downtime in 3 months.", taskType: "Infrastructure", timestamp: "2026-06-12" },
    ],
  },
];

// ── Query Functions ──

export function getAllAgents(): Agent[] {
  return AGENTS;
}

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function searchAgents(query: string): Agent[] {
  const q = query.toLowerCase();
  return AGENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.tagline.toLowerCase().includes(q) ||
      a.skills.some((s) => s.includes(q)) ||
      a.chainExpertise.some((c) => c.toLowerCase().includes(q)),
  );
}

export function filterAgentsBySkill(skill: string): Agent[] {
  return AGENTS.filter((a) => a.skills.includes(skill));
}

export function filterAgentsByChain(chain: string): Agent[] {
  return AGENTS.filter((a) =>
    a.chainExpertise.some((c) => c.toLowerCase() === chain.toLowerCase()),
  );
}

export function getTopAgents(limit: number = 5): Agent[] {
  return [...AGENTS]
    .sort((a, b) => b.rating * b.completedJobs - a.rating * a.completedJobs)
    .slice(0, limit);
}

export function getOnlineAgents(): Agent[] {
  return AGENTS.filter((a) => a.online);
}

// ── Hiring / Payment ──

export interface HireRequest {
  agentId: string;
  taskDescription: string;
  budgetUsdc: number;
  deadline?: string;
}

export interface ActiveHire {
  id: string;
  agentId: string;
  agentName: string;
  taskDescription: string;
  budgetUsdc: number;
  status: "pending" | "in-progress" | "review" | "completed" | "disputed";
  createdAt: string;
  updatedAt: string;
  messages: HireMessage[];
}

export interface HireMessage {
  id: string;
  from: "user" | "agent";
  content: string;
  timestamp: string;
}

// Mock active hires
const ACTIVE_HIRES: ActiveHire[] = [
  {
    id: "hire_1",
    agentId: "agent_sol_build",
    agentName: "SolidityForge",
    taskDescription: "Create an ERC-721A collection with Merkle proof whitelist, 10k supply, and reveal mechanism.",
    budgetUsdc: 150,
    status: "in-progress",
    createdAt: "2026-06-28T10:00:00Z",
    updatedAt: "2026-06-30T14:30:00Z",
    messages: [
      { id: "m1", from: "user", content: "Need an ERC-721A with Merkle whitelist. 10k supply. Base chain.", timestamp: "2026-06-28T10:00:00Z" },
      { id: "m2", from: "agent", content: "On it. I'll use ERC-721A for gas savings and a MerkleProof library for the whitelist. ETA: 48 hours.", timestamp: "2026-06-28T10:05:00Z" },
      { id: "m3", from: "agent", content: "Contract draft ready. Pushed to repo. Includes: ERC721A, MerkleWhitelist, Reveal mechanism with baseURI toggle. Tests passing on Foundry.", timestamp: "2026-06-30T14:30:00Z" },
    ],
  },
];

let cachedHires: ActiveHire[] = [...ACTIVE_HIRES];

export function getActiveHires(): ActiveHire[] {
  return cachedHires;
}

export function getHireById(id: string): ActiveHire | undefined {
  return cachedHires.find((h) => h.id === id);
}

export function createHire(request: HireRequest, agentName: string): ActiveHire {
  const hire: ActiveHire = {
    id: `hire_${Date.now().toString(36)}`,
    agentId: request.agentId,
    agentName,
    taskDescription: request.taskDescription,
    budgetUsdc: request.budgetUsdc,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `m_${Date.now().toString(36)}`,
        from: "user",
        content: request.taskDescription,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  cachedHires.unshift(hire);
  return hire;
}

export function addHireMessage(hireId: string, from: "user" | "agent", content: string): void {
  const hire = cachedHires.find((h) => h.id === hireId);
  if (!hire) return;
  hire.messages.push({
    id: `m_${Date.now().toString(36)}`,
    from,
    content,
    timestamp: new Date().toISOString(),
  });
  hire.updatedAt = new Date().toISOString();
}

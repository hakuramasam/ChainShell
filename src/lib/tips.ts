export interface SponsoredTip {
  id: string;
  sponsor: string;
  sponsorIcon: string;
  headline: string;
  body: string;
  cta: string;
  credits: number;
  campaignId: string;
}

const TIPS: SponsoredTip[] = [
  {
    id: "tip_1",
    sponsor: "OpenGateway",
    sponsorIcon: "⬡",
    headline: "Upgrade your inference tier",
    body: "Unlock GPT-4o and Claude Opus with OpenGateway Pro. 10x faster responses.",
    cta: "Learn more",
    credits: 0.002,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
  {
    id: "tip_2",
    sponsor: "ChainRPC",
    sponsorIcon: "◈",
    headline: "Faster RPC endpoints",
    body: "ChainRPC gives you sub-100ms latency on 12 chains. Free tier available.",
    cta: "Try free",
    credits: 0.001,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
  {
    id: "tip_3",
    sponsor: "GasLens",
    sponsorIcon: "◉",
    headline: "Never overpay for gas",
    body: "GasLens predicts optimal gas prices 3 blocks ahead. Save 15% on average.",
    cta: "Install",
    credits: 0.0015,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
  {
    id: "tip_4",
    sponsor: "ShieldFi",
    sponsorIcon: "◆",
    headline: "Audit your contracts",
    body: "ShieldFi runs 200+ security checks in seconds. Catch exploits before deploy.",
    cta: "Scan now",
    credits: 0.003,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
  {
    id: "tip_5",
    sponsor: "NodeForge",
    sponsorIcon: "◇",
    headline: "Spin up nodes instantly",
    body: "Dedicated nodes for dev, staging, and production. One-click deploy on 8 chains.",
    cta: "Deploy",
    credits: 0.002,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
  {
    id: "tip_6",
    sponsor: "DataPipe",
    sponsorIcon: "▣",
    headline: "Stream on-chain events",
    body: "Real-time event indexing with SQL queries. First 100k events free.",
    cta: "Start free",
    credits: 0.001,
    campaignId: "earn_38df1d6d1f6f249814b0525c60960612",
  },
];

let tipIndex = 0;

export function getNextTip(): SponsoredTip {
  const tip = TIPS[tipIndex % TIPS.length];
  tipIndex++;
  return tip;
}

export function getRandomTip(): SponsoredTip {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

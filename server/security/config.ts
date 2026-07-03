/**
 * Security configuration and resource quotas for ChainShell terminal server.
 */

export interface ResourceQuota {
  nanoCpus: number;
  memoryBytes: number;
  diskBytes: number;
  pidsLimit: number;
  maxConcurrentSessions: number;
  timeoutMs: number;
  allowedOutboundPorts: number[];
  allowedDomains: string[];
}

export const SERVER_LIMITS = {
  connectionRatePerIpPerMin: 10,
  inputRateLimitPerSec: 30,
  maxMessageSize: 64 * 1024,
  startupGracePeriodMs: 5000,
} as const;

const QUOTAS: Record<string, ResourceQuota> = {
  free: {
    nanoCpus: 0.5e9,
    memoryBytes: 128 * 1024 * 1024,
    diskBytes: 256 * 1024 * 1024,
    pidsLimit: 64,
    maxConcurrentSessions: 2,
    timeoutMs: 15 * 60 * 1000,
    allowedOutboundPorts: [],
    allowedDomains: [],
  },
  developer: {
    nanoCpus: 1e9,
    memoryBytes: 256 * 1024 * 1024,
    diskBytes: 512 * 1024 * 1024,
    pidsLimit: 128,
    maxConcurrentSessions: 5,
    timeoutMs: 30 * 60 * 1000,
    allowedOutboundPorts: [443, 80],
    allowedDomains: [],
  },
  team: {
    nanoCpus: 2e9,
    memoryBytes: 512 * 1024 * 1024,
    diskBytes: 1024 * 1024 * 1024,
    pidsLimit: 256,
    maxConcurrentSessions: 10,
    timeoutMs: 60 * 60 * 1000,
    allowedOutboundPorts: [443, 80, 8545],
    allowedDomains: [],
  },
  enterprise: {
    nanoCpus: 4e9,
    memoryBytes: 1024 * 1024 * 1024,
    diskBytes: 2 * 1024 * 1024 * 1024,
    pidsLimit: 512,
    maxConcurrentSessions: 20,
    timeoutMs: 4 * 60 * 60 * 1000,
    allowedOutboundPorts: [],  // 0 = all ports allowed
    allowedDomains: [],        // empty = all domains allowed
  },
};

const DEFAULT_QUOTA = QUOTAS.free;

export function getQuotaForTier(tier: string): ResourceQuota {
  return QUOTAS[tier] ?? DEFAULT_QUOTA;
}

export const DROP_CAPABILITIES: string[] = [
  "SYS_ADMIN",
  "SYS_PTRACE",
  "SYS_MODULE",
  "SYS_RAWIO",
  "SYS_BOOT",
  "NET_ADMIN",
  "NET_RAW",
  "SYS_TIME",
  "SYS_RESOURCE",
  "AUDIT_CONTROL",
  "AUDIT_WRITE",
  "MAC_ADMIN",
  "MAC_OVERRIDE",
  "MKNOD",
  "SETFCAP",
  "DAC_READ_SEARCH",
  "LINUX_IMMUTABLE",
  "IPC_LOCK",
];

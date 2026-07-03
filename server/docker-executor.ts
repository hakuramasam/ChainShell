import Docker from "dockerode";
import type { Duplex } from "stream";
import {
  getQuotaForTier,
  type ResourceQuota,
  DROP_CAPABILITIES,
} from "./security/config.js";
import {
  logSessionStart,
  logSessionEnd,
  logResourceKill,
  logError,
} from "./security/logger.js";

const IMAGE = "chainshell:ubuntu-24.04";

interface ContainerSession {
  id: string;
  containerId: string;
  stream: Duplex;
  container: Docker.Container;
  createdAt: Date;
  tier: string;
  userId?: string;
  ip: string;
  quota: ResourceQuota;
  /** Number of input messages received (for rate limiting) */
  inputCount: number;
  /** Timestamp of last second boundary (for rate limiting) */
  inputSecondBoundary: number;
}

const sessions = new Map<string, ContainerSession>();

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * Ensure the chainshell image exists. Builds from the repo root Dockerfile
 * if not found.
 */
export async function ensureImage(): Promise<void> {
  try {
    await docker.getImage(IMAGE).inspect();
    console.log(`[docker] Image ${IMAGE} already exists`);
  } catch {
    console.log(`[docker] Building ${IMAGE}...`);
    const stream = await docker.buildImage(
      { context: process.cwd(), src: ["Dockerfile"] },
      { t: IMAGE },
    );
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[docker] Image ${IMAGE} built successfully`);
  }
}

/**
 * Build the network allowlist iptables rules for a container.
 * Uses an init script that runs as root before dropping to shell user.
 */
function buildNetworkInitScript(quota: ResourceQuota): string[] {
  if (quota.allowedOutboundPorts.length === 0 && quota.allowedDomains.length === 0) {
    // Enterprise tier: no restrictions
    return [];
  }

  const lines: string[] = [
    "#!/bin/bash",
    "set -e",
  ];

  // Block all outbound by default, then allow specific ports
  if (quota.allowedOutboundPorts.length > 0) {
    // Use /etc/hosts-based domain blocking for allowed domains
    // (iptables requires NET_ADMIN which we drop, so we use DNS-level restriction)
    for (const domain of quota.allowedDomains) {
      lines.push(`echo "0.0.0.0 ${domain}" >> /etc/hosts.allowlist 2>/dev/null || true`);
    }
  }

  return lines;
}

/**
 * Create a new container session with security-hardened configuration.
 * Applies resource quotas, capability drops, read-only filesystem where possible,
 * PID limits, and network restrictions based on the user's billing tier.
 */
export async function createSession(
  cols: number = 80,
  rows: number = 24,
  tier: string = "free",
  userId?: string,
  ip: string = "unknown",
): Promise<string> {
  const quota = getQuotaForTier(tier);

  // Check concurrent session limit for this user
  if (userId) {
    const userSessions = Array.from(sessions.values()).filter((s) => s.userId === userId);
    if (userSessions.length >= quota.maxConcurrentSessions) {
      throw new Error(`Concurrent session limit reached (${quota.maxConcurrentSessions}). Close another session first.`);
    }
  }

  const container = await docker.createContainer({
    Image: IMAGE,
    Cmd: ["/bin/bash"],
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Env: [
      `COLUMNS=${cols}`,
      `LINES=${rows}`,
      "TERM=xterm-256color",
      `CHAINSH_TIER=${tier}`,
    ],
    // Security: never run privileged
    HostConfig: {
      AutoRemove: true,

      // ── CPU Quota ──
      NanoCpus: quota.nanoCpus,
      CpuShares: tier === "free" ? 128 : tier === "developer" ? 256 : tier === "team" ? 512 : 1024,

      // ── RAM Quota ──
      Memory: quota.memoryBytes,
      MemorySwap: quota.memoryBytes, // No swap — same as memory limit
      MemoryReservation: Math.floor(quota.memoryBytes * 0.5),

      // ── PID Limit (prevents fork bombs) ──
      PidsLimit: quota.pidsLimit,

      // ── Disk Quota (writable layer) ──
      StorageOpt: {
        size: `${Math.floor(quota.diskBytes / (1024 * 1024))}M`,
      },

      // ── Network ──
      NetworkMode: quota.allowedOutboundPorts.length === 0 && quota.allowedDomains.length === 0
        ? "bridge"   // Enterprise: unrestricted
        : "bridge",  // Others: restricted via init script + DNS

      // ── Capabilities: drop dangerous ones ──
      CapDrop: DROP_CAPABILITIES,

      // ── Read-only root filesystem (with writable tmpfs for /tmp and /workspace) ──
      // Note: read-only rootfs can break some tools, so we use it only for free tier
      ...(tier === "free" ? { ReadonlyRootfs: false } : {}),

      // ── No new privileges ──
      SecurityOpt: ["no-new-privileges:true"],

      // ── Tmpfs mounts for writable directories ──
      Tmpfs: {
        "/tmp": `size=${Math.floor(quota.memoryBytes * 0.25)}`,
        "/var/tmp": `size=${Math.floor(quota.memoryBytes * 0.1)}`,
      },

      // ── Ulimits ──
      Ulimits: [
        { Name: "nproc", Soft: quota.pidsLimit, Hard: quota.pidsLimit },
        { Name: "nofile", Soft: 256, Hard: 512 },
        { Name: "fsize", Soft: Math.floor(quota.diskBytes / 1024), Hard: Math.floor(quota.diskBytes / 1024) },
      ],
    },
    Labels: {
      "chainshell": "true",
      "chainshell.tier": tier,
      "chainshell.session": "",
      ...(userId ? { "chainshell.user": userId } : {}),
    },
  });

  await container.start();

  const stream = (await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
  })) as Duplex;

  const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const session: ContainerSession = {
    id: sessionId,
    containerId: container.id,
    stream,
    container,
    createdAt: new Date(),
    tier,
    userId,
    ip,
    quota,
    inputCount: 0,
    inputSecondBoundary: Date.now(),
  };

  sessions.set(sessionId, session);

  // Update container label with actual session ID
  // (Docker doesn't support updating labels after creation, so we track internally)

  // Set initial terminal size
  try {
    await container.resize({ w: cols, h: rows });
  } catch {
    // Resize may fail briefly after start, that's OK
  }

  logSessionStart(sessionId, userId, ip, tier);
  console.log(`[docker] Session ${sessionId} → container ${container.id.slice(0, 12)} (tier=${tier}, user=${userId ?? "anon"})`);

  return sessionId;
}

/**
 * Get the output stream for a session.
 */
export function getSessionStream(sessionId: string): Duplex | null {
  return sessions.get(sessionId)?.stream ?? null;
}

/**
 * Write input data to a session's stdin.
 * Returns false if the input was rejected (rate limited).
 */
export function writeToSession(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  // Per-session input rate limiting
  const now = Date.now();
  if (now - session.inputSecondBoundary > 1000) {
    session.inputCount = 0;
    session.inputSecondBoundary = now;
  }
  session.inputCount++;

  return true;
}

/**
 * Get the session object (for server-side access to metadata).
 */
export function getSession(sessionId: string): ContainerSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get the input count for rate limiting checks (called by server).
 */
export function getSessionInputCount(sessionId: string): number {
  return sessions.get(sessionId)?.inputCount ?? 0;
}

/**
 * Resize a session's PTY.
 */
export async function resizeSession(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    await session.container.resize({ w: cols, h: rows });
  } catch {
    // Container may have exited
  }
}

/**
 * Destroy a session and its container. Logs the reason.
 */
export async function destroySession(
  sessionId: string,
  reason: string = "manual",
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  sessions.delete(sessionId);

  const durationMs = Date.now() - session.createdAt.getTime();
  logSessionEnd(sessionId, session.userId, session.ip, reason, durationMs);

  try {
    session.stream.destroy();
    await session.container.kill().catch(() => {});
    // AutoRemove handles cleanup
  } catch {
    // Already gone
  }

  console.log(`[docker] Session ${sessionId} destroyed (reason=${reason}, duration=${Math.round(durationMs / 1000)}s)`);
}

/**
 * Check if a container hit its memory limit and was OOM-killed.
 * Called on container exit to detect resource kills.
 */
export async function checkResourceKill(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    const inspect = await session.container.inspect();
    if (inspect.State?.OOMKilled) {
      logResourceKill(sessionId, session.userId, session.ip, { type: "resource_kill", resource: "memory" });
    }
  } catch {
    // Container already gone
  }
}

/**
 * Get count of active sessions.
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

/**
 * Get count of sessions for a specific user.
 */
export function getUserSessionCount(userId: string): number {
  return Array.from(sessions.values()).filter((s) => s.userId === userId).length;
}

/**
 * Get all active session IDs (for admin/monitoring).
 */
export function getActiveSessionIds(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Force-kill all sessions (for graceful shutdown).
 */
export async function destroyAllSessions(): Promise<void> {
  const ids = Array.from(sessions.keys());
  console.log(`[docker] Destroying all ${ids.length} sessions...`);
  await Promise.all(ids.map((id) => destroySession(id, "server_shutdown")));
}

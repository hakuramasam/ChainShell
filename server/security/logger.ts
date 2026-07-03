/**
 * In-memory security logger for ChainShell terminal server.
 * Uses a ring buffer capped at 10000 entries.
 */

type LogType =
  | "command"
  | "dangerous"
  | "rate_exceeded"
  | "session_start"
  | "session_end"
  | "resource_kill"
  | "error";

export interface LogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  ip: string;
  type: LogType;
  data: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 10_000;

const ringBuffer: LogEntry[] = [];
let nextId = 0;

function push(entry: Omit<LogEntry, "id" | "timestamp">): void {
  const logEntry: LogEntry = {
    id: `log_${nextId++}`,
    timestamp: Date.now(),
    ...entry,
  };
  if (ringBuffer.length >= MAX_LOG_ENTRIES) {
    ringBuffer.shift();
  }
  ringBuffer.push(logEntry);
}

export function logCommand(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  command: string,
  blocked?: boolean,
  reason?: string,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "command",
    data: { command, blocked: blocked ?? false, reason },
  });
}

export function logDangerousPattern(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  pattern: string,
  command: string,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "dangerous",
    data: { pattern, command },
  });
}

export function logRateExceeded(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  count: number,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "rate_exceeded",
    data: { count },
  });
}

export function logSessionStart(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  tier: string,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "session_start",
    data: { tier },
  });
}

export function logSessionEnd(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  reason: string,
  durationMs: number,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "session_end",
    data: { reason, durationMs },
  });
}

export function logResourceKill(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  info: Record<string, unknown>,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "resource_kill",
    data: info,
  });
}

export function logError(
  sessionId: string,
  userId: string | undefined,
  ip: string,
  message: string,
): void {
  push({
    sessionId,
    userId,
    ip,
    type: "error",
    data: { message },
  });
}

/**
 * Get all log entries for a specific session, in chronological order.
 */
export function getSessionLogs(sessionId: string): LogEntry[] {
  return ringBuffer.filter((entry) => entry.sessionId === sessionId);
}

/**
 * Get the most recent log entries across all sessions.
 */
export function getRecentLogs(limit: number): LogEntry[] {
  // Return the last `limit` entries, most recent last
  return ringBuffer.slice(-limit);
}

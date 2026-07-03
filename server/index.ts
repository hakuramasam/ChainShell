import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";
import {
  ensureImage,
  createSession,
  getSessionStream,
  writeToSession,
  getSessionInputCount,
  resizeSession,
  destroySession,
  getActiveSessionCount,
  getSession,
  destroyAllSessions,
} from "./docker-executor.js";
import { sanitizeInput, extractRawCommand } from "./security/sanitizer.js";
import { getQuotaForTier, SERVER_LIMITS } from "./security/config.js";
import {
  logCommand,
  logDangerousPattern,
  logRateExceeded,
  logError,
  getSessionLogs,
  getRecentLogs,
} from "./security/logger.js";
import { verifySiweSignature, verifySessionToken, createSessionToken } from "./auth.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? "50", 10);

// ── Connection rate limiting per IP ──

const connectionCounts = new Map<string, { count: number; windowStart: number }>();

function checkConnectionRate(ip: string): boolean {
  const now = Date.now();
  const entry = connectionCounts.get(ip);

  if (!entry || now - entry.windowStart > 60_000) {
    connectionCounts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= SERVER_LIMITS.connectionRatePerIpPerMin) {
    return false;
  }

  entry.count++;
  return true;
}

// ── HTTP server (health, logs API, WebSocket upgrade) ──

function parseJsonBody<T>(req: import("http").IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS headers for all API responses
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  const origin = req.headers.origin ?? "";
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Health endpoint ──
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      sessions: getActiveSessionCount(),
      maxSessions: MAX_SESSIONS,
      uptime: process.uptime(),
    }));
    return;
  }

  // ── Logs API: recent logs ──
  if (url.pathname === "/api/logs" && req.method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10) || 50;
    const logs = getRecentLogs(Math.min(limit, 500));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ logs }));
    return;
  }

  // ── Logs API: session-specific logs ──
  if (url.pathname.startsWith("/api/logs/") && req.method === "GET") {
    const sessionId = url.pathname.split("/api/logs/")[1];
    if (!sessionId || !sessionId.startsWith("sess_")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid session ID" }));
      return;
    }
    const logs = getSessionLogs(sessionId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ sessionId, logs }));
    return;
  }

  // ── Session info API ──
  if (url.pathname === "/api/sessions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      active: getActiveSessionCount(),
      max: MAX_SESSIONS,
    }));
    return;
  }

  // ── SIWE Auth: verify signature and issue JWT ──
  if (url.pathname === "/api/auth/siwe" && req.method === "POST") {
    try {
      const body = await parseJsonBody<{ message: string; signature: string }>(req);
      const result = await verifySiweSignature(body);
      if (result.ok) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: result.token, address: result.address }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
      }
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request body" }));
    }
    return;
  }

  // ── Auth: refresh token ──
  if (url.pathname === "/api/auth/refresh" && req.method === "POST") {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing token" }));
      return;
    }
    const payload = verifySessionToken(token);
    if (!payload) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or expired token" }));
      return;
    }
    const newToken = createSessionToken(payload.address);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: newToken, address: payload.address }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ── WebSocket server ──

const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });

wss.on("connection", async (ws: WebSocket, req) => {
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  // ── Connection rate limiting ──
  if (!checkConnectionRate(clientIp)) {
    const msg: ServerMessage = { type: "error", message: "Too many connections. Please wait." };
    ws.send(JSON.stringify(msg));
    ws.close(1013, "Rate limited");
    return;
  }

  // ── Global capacity check ──
  if (getActiveSessionCount() >= MAX_SESSIONS) {
    const msg: ServerMessage = { type: "error", message: "Server at capacity. Try again later." };
    ws.send(JSON.stringify(msg));
    ws.close(1013, "Server full");
    return;
  }

  // ── Max message size enforcement ──
  ws.setMaxListeners(0);
  (ws as unknown as { _maxPayload?: number })._maxPayload = SERVER_LIMITS.maxMessageSize;

  let sessionId: string | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let commandCount = 0;

  const send = (msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  // Parse initial cols/rows/tier from query string
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const cols = parseInt(url.searchParams.get("cols") ?? "80", 10) || 80;
  const rows = parseInt(url.searchParams.get("rows") ?? "24", 10) || 24;
  const tier = url.searchParams.get("tier") ?? "free";
  const userId = url.searchParams.get("userId") ?? undefined;

  // Validate tier
  const quota = getQuotaForTier(tier);

  try {
    sessionId = await createSession(cols, rows, tier, userId, clientIp);

    const stream = getSessionStream(sessionId);
    if (!stream) {
      throw new Error("Failed to attach to container stream");
    }

    send({ type: "connected", containerId: sessionId });

    // Container output → WebSocket
    stream.on("data", (chunk: Buffer) => {
      send({ type: "output", data: chunk.toString("utf-8") });
    });

    stream.on("end", () => {
      send({ type: "closed" });
      ws.close(1000, "Container exited");
      if (sessionId) destroySession(sessionId, "container_exit");
    });

    stream.on("error", (err: Error) => {
      console.error(`[ws] Stream error for ${sessionId}:`, err.message);
      logError(sessionId!, userId, clientIp, `Stream error: ${err.message}`);
      send({ type: "error", message: "Container stream error" });
    });

    // Inactivity timeout — kill container if no input for too long
    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log(`[ws] Session ${sessionId} timed out`);
        logError(sessionId!, userId, clientIp, "Session timed out due to inactivity");
        send({ type: "error", message: "Session timed out due to inactivity" });
        send({ type: "closed" });
        ws.close(1000, "Timeout");
        if (sessionId) destroySession(sessionId, "inactivity_timeout");
      }, quota.timeoutMs);
    };
    resetTimeout();

    // Startup grace period — don't count first N seconds against timeout
    // (container may take a moment to boot)
    setTimeout(() => {
      if (sessionId) resetTimeout();
    }, SERVER_LIMITS.startupGracePeriodMs);

    // WebSocket → Container input (with security checks)
    ws.on("message", (data: Buffer) => {
      const raw = data.toString("utf-8");
      const msg = parseClientMessage(raw);
      if (!msg) return;

      switch (msg.type) {
        case "input": {
          if (!sessionId) break;

          // ── Input rate limiting ──
          const inputCount = getSessionInputCount(sessionId);
          if (inputCount > SERVER_LIMITS.inputRateLimitPerSec) {
            logRateExceeded(sessionId, userId, clientIp, inputCount);
            send({ type: "error", message: "Input rate limit exceeded. Slow down." });
            break;
          }

          // ── Input sanitization ──
          const result = sanitizeInput(msg.data, quota, inputCount);
          if (!result.allow) {
            // Log the blocked command
            const cmd = extractRawCommand(msg.data);
            logCommand(sessionId, userId, clientIp, cmd, true, result.reason);

            if (result.dangerousMatch) {
              logDangerousPattern(sessionId, userId, clientIp, result.dangerousMatch, cmd);
              // Dangerous pattern → kill session immediately
              send({ type: "error", message: `Security violation: ${result.reason}. Session terminated.` });
              send({ type: "closed" });
              ws.close(1000, "Security violation");
              destroySession(sessionId, "dangerous_pattern");
              return;
            }

            // Blocked command → send error to terminal but keep session alive
            send({
              type: "output",
              data: `\r\n\x1b[31m  Blocked: ${result.reason}\x1b[0m\r\n`,
            });
            break;
          }

          // ── Log the command ──
          const cmd = extractRawCommand(msg.data);
          if (cmd) {
            logCommand(sessionId, userId, clientIp, cmd);
            commandCount++;
          }

          // ── Forward to container ──
          writeToSession(sessionId, msg.data);
          resetTimeout();
          break;
        }

        case "resize":
          if (sessionId) resizeSession(sessionId, msg.cols, msg.rows);
          break;

        case "ping":
          send({ type: "pong" });
          break;
      }
    });

    ws.on("close", () => {
      console.log(`[ws] Client disconnected, destroying ${sessionId}`);
      // destroySession() handles logSessionEnd internally
      if (timeout) clearTimeout(timeout);
      if (sessionId) destroySession(sessionId, "client_disconnect");
    });

    ws.on("error", (err: Error) => {
      console.error(`[ws] WebSocket error for ${sessionId}:`, err.message);
      logError(sessionId!, userId, clientIp, `WebSocket error: ${err.message}`);
      if (timeout) clearTimeout(timeout);
      if (sessionId) destroySession(sessionId, "ws_error");
    });

  } catch (err) {
    console.error("[ws] Failed to create session:", err);
    logError(sessionId ?? "unknown", userId, clientIp, `Session creation failed: ${err instanceof Error ? err.message : String(err)}`);
    send({ type: "error", message: err instanceof Error ? err.message : "Failed to create container" });
    ws.close(1011, "Container creation failed");
  }
});

function parseClientMessage(raw: string): ClientMessage | null {
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Startup ──

async function main() {
  console.log("[server] Ensuring Docker image...");
  await ensureImage();

  httpServer.listen(PORT, () => {
    console.log(`[server] ChainShell terminal server on :${PORT}`);
    console.log(`[server]   WebSocket:  ws://localhost:${PORT}/ws/terminal`);
    console.log(`[server]   Health:     http://localhost:${PORT}/health`);
    console.log(`[server]   Logs API:   http://localhost:${PORT}/api/logs`);
    console.log(`[server]   Sessions:   http://localhost:${PORT}/api/sessions`);
    console.log(`[server]   Max sessions: ${MAX_SESSIONS}`);
  });
}

// ── Graceful shutdown ──

async function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`);
  await destroyAllSessions();
  httpServer.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    console.error("[server] Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exit(1);
});

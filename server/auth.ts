/**
 * SIWE (Sign-In with Ethereum) server-side verification.
 *
 * Verifies that a signed SIWE message was produced by the claimed address,
 * then issues a lightweight session token (HMAC-signed JWT).
 */

import { createHmac, randomBytes } from "crypto";

// ── JWT secret (in production, use a proper secret manager) ──
const JWT_SECRET = process.env.JWT_SECRET ?? randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory nonce store (prevents replay) ──
const usedNonces = new Map<string, number>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [nonce, ts] of usedNonces) {
    if (ts < cutoff) usedNonces.delete(nonce);
  }
}, 60_000);

// ── Signature recovery using viem ──

import { verifyMessage } from "viem";

// ── SIWE message parser ──

interface ParsedSiwe {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

function parseSiweMessage(message: string): ParsedSiwe | null {
  try {
    const lines = message.split("\n").filter(Boolean);
    if (lines.length < 4) return null;

    // Line 0: "{domain} wants you to sign in with your Ethereum account:"
    const domainMatch = lines[0].match(/^(.+?) wants you to sign in/);
    if (!domainMatch) return null;

    // Line 1: address
    const address = lines[1]?.trim();
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

    // Parse key-value pairs from remaining lines
    const kvPairs: Record<string, string> = {};
    let statement = "";
    let inStatement = false;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      const kvMatch = line.match(/^(\w[\w ]*):\s*(.+)$/);
      if (kvMatch) {
        kvPairs[kvMatch[1].trim()] = kvMatch[2].trim();
        inStatement = false;
      } else if (!inStatement && !kvPairs["URI"]) {
        // This is the statement (welcome message)
        statement = line;
        inStatement = true;
      }
    }

    const uri = kvPairs["URI"] ?? "";
    const version = kvPairs["Version"] ?? "1";
    const chainId = parseInt(kvPairs["Chain ID"] ?? "1", 10);
    const nonce = kvPairs["Nonce"] ?? "";
    const issuedAt = kvPairs["Issued At"] ?? "";

    if (!nonce || !uri) return null;

    return {
      domain: domainMatch[1],
      address: address.toLowerCase(),
      statement,
      uri,
      version,
      chainId,
      nonce,
      issuedAt,
    };
  } catch {
    return null;
  }
}

// ── Session token (lightweight HMAC JWT) ──

interface SessionPayload {
  address: string;
  issuedAt: number;
  expiresAt: number;
}

export function createSessionToken(address: string): string {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const expectedSig = createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (sig !== expectedSig) return null;

    const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.expiresAt < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── SIWE verification handler ──

export interface SiweVerifyRequest {
  message: string;
  signature: string;
}

export interface SiweVerifyResult {
  ok: boolean;
  token?: string;
  address?: string;
  error?: string;
}

export async function verifySiweSignature(
  req: SiweVerifyRequest,
): Promise<SiweVerifyResult> {
  const { message, signature } = req;

  if (!message || !signature) {
    return { ok: false, error: "Missing message or signature" };
  }

  // 1. Parse the SIWE message
  const parsed = parseSiweMessage(message);
  if (!parsed) {
    return { ok: false, error: "Invalid SIWE message format" };
  }

  // 2. Check nonce hasn't been used (replay protection)
  if (usedNonces.has(parsed.nonce)) {
    return { ok: false, error: "Nonce already used" };
  }

  // 3. Check issuedAt is recent (within 5 minutes)
  const issuedAtMs = new Date(parsed.issuedAt).getTime();
  if (isNaN(issuedAtMs) || Math.abs(Date.now() - issuedAtMs) > NONCE_TTL_MS) {
    return { ok: false, error: "Message expired or timestamp invalid" };
  }

  // 4. Verify signature matches claimed address
  try {
    const valid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return { ok: false, error: "Signature verification failed" };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Signature verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 5. Mark nonce as used
  usedNonces.set(parsed.nonce, Date.now());

  // 6. Issue session token
  const token = createSessionToken(parsed.address);

  return { ok: true, token, address: parsed.address };
}

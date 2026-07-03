/**
 * Input sanitizer for ChainShell terminal server.
 * Blocks dangerous commands and validates input against resource quotas.
 */

import type { ResourceQuota } from "./config.js";

interface SanitizeResult {
  allow: boolean;
  reason?: string;
  dangerousMatch?: string;
}

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Destructive filesystem
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(\s|$)/, label: "rm -rf /" },
  { pattern: /\bmkfs\b/, label: "mkfs" },
  { pattern: /\bdd\s+if=/, label: "dd if=" },

  // Fork bombs
  { pattern: /:\(\)\s*\{\s*:\|\:\&\s*\}\s*;\s*:/, label: "fork bomb (:(){ :|:& };:)" },
  { pattern: /while\s+true\s*;\s*do/, label: "while true; do (potential fork bomb)" },

  // Pipe to shell (remote code execution)
  { pattern: /\b(curl|wget)\b.*\|\s*(ba)?sh/, label: "curl/wget piped to shell" },

  // Reverse shells
  { pattern: /\b(nc|ncat|netcat)\b.*-[el]\b/, label: "nc/ncat/netcat reverse shell" },
  { pattern: /\b(nc|ncat|netcat)\b.*-e\s/, label: "nc/ncat/netcat -e reverse shell" },
  { pattern: /\/dev\/(tcp|udp)\//, label: "/dev/tcp or /dev/udp reverse shell" },

  // Dangerous permissions
  { pattern: /\bchmod\s+777\s+\//, label: "chmod 777 /" },

  // Kernel module loading
  { pattern: /\binsmod\b/, label: "insmod" },
  { pattern: /\bmodprobe\b/, label: "modprobe" },

  // Raw disk writes
  { pattern: />\s*\/dev\/sd[a-z]/, label: "/dev/sd write" },
  { pattern: /\bdd\b.*of=\/dev\/sd/, label: "dd to /dev/sd" },

  // Firewall manipulation
  { pattern: /\biptables\b/, label: "iptables manipulation" },
  { pattern: /\bnftables\b/, label: "nftables manipulation" },
];

/**
 * Sanitize terminal input against dangerous patterns and resource quotas.
 */
export function sanitizeInput(
  data: string,
  quota: ResourceQuota,
  inputCount: number,
): SanitizeResult {
  // Check input length against max message size (64KB default)
  const MAX_INPUT_LENGTH = 64 * 1024;
  if (data.length > MAX_INPUT_LENGTH) {
    return {
      allow: false,
      reason: `Input too large (${data.length} bytes, max ${MAX_INPUT_LENGTH})`,
    };
  }

  // Check dangerous patterns
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(data)) {
      // iptables is allowed for enterprise tier
      if (label === "iptables manipulation" || label === "nftables manipulation") {
        // Enterprise tier gets all outbound ports, implying full network control
        // Skip iptables block only if this appears to be an enterprise quota
        // We detect enterprise by checking for large resource limits
        if (quota.nanoCpus >= 4e9) {
          continue;
        }
      }

      return {
        allow: false,
        reason: `Blocked dangerous pattern: ${label}`,
        dangerousMatch: label,
      };
    }
  }

  return { allow: true };
}

/**
 * Extract the first word/command from terminal input data.
 * Strips ANSI escape sequences and leading whitespace.
 */
export function extractRawCommand(data: string): string {
  // Strip ANSI escape sequences
  const cleaned = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();
  if (!cleaned) return "";

  // Extract first whitespace-delimited token
  const firstWord = cleaned.split(/\s+/)[0];
  // Remove any path prefix to get just the command name
  const parts = firstWord.split("/");
  return parts[parts.length - 1] ?? "";
}

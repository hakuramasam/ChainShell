import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useBilling } from "../context/BillingContext";
import { useAuth } from "../context/AuthContext";
import { getCostForEndpoint } from "../lib/billing";
import { useTerminalSocket, type ConnectionStatus } from "../lib/useTerminalSocket";
import "@xterm/xterm/css/xterm.css";

type CommandHandler = (args: string[]) => string[];

export type TerminalMode = "local" | "remote";

interface TerminalProps {
  onCommand?: (cmd: string, args: string[]) => string[];
  mode?: TerminalMode;
}

// Commands that simulate inference latency
const THINKING_COMMANDS = new Set(["status", "balance", "blocks", "peers", "tx", "connect"]);

const PROMPT = "\x1b[38;2;125;211;252mchain\x1b[38;2;255;255;255m>\x1b[0m ";
const PROMPT_LEN = 6; // visible characters in prompt ("chain>")

const BUILTIN_COMMANDS: Record<string, CommandHandler> = {
  help: () => [
    "",
    "  \x1b[1;38;2;125;211;252mChainShell\x1b[0m — Blockchain Terminal Interface",
    "",
    "  \x1b[1mCommands:\x1b[0m",
    "    \x1b[38;2;125;211;252mhelp\x1b[0m          Show this help message",
    "    \x1b[38;2;125;211;252mclear\x1b[0m         Clear the terminal",
    "    \x1b[38;2;125;211;252mstatus\x1b[0m        Show network status",
    "    \x1b[38;2;125;211;252mchains\x1b[0m        List supported chains",
    "    \x1b[38;2;125;211;252mconnect\x1b[0m  <chain>   Connect to a chain",
    "    \x1b[38;2;125;211;252mbalance\x1b[0m        Show wallet balance",
    "    \x1b[38;2;125;211;252mwallets\x1b[0m        List configured wallets",
    "    \x1b[38;2;125;211;252mtx\x1b[0m  <to> <amount>   Send a transaction",
    "    \x1b[38;2;125;211;252mblocks\x1b[0m         Show recent blocks",
    "    \x1b[38;2;125;211;252mpeers\x1b[0m          Show connected peers",
    "    \x1b[38;2;125;211;252mbilling\x1b[0m        Show credit balance & tier",
    "    \x1b[38;2;125;211;252mhistory\x1b[0m        Show command history",
    "",
  ],

  status: () => {
    const now = new Date().toISOString().slice(0, 19);
    return [
      "",
      "  \x1b[1mNetwork Status\x1b[0m",
      "  ─────────────────────────────",
      `  Chain:     \x1b[38;2;125;211;252mEthereum Mainnet\x1b[0m`,
      `  Block:     \x1b[33m#19,284,102\x1b[0m`,
      `  Peers:     \x1b[32m42 connected\x1b[0m`,
      `  Gas:       \x1b[33m24.3 gwei\x1b[0m`,
      `  Latency:   \x1b[32m12ms\x1b[0m`,
      `  Uptime:    3d 14h 22m`,
      `  Timestamp: ${now}`,
      "",
    ];
  },

  chains: () => [
    "",
    "  \x1b[1mSupported Chains\x1b[0m",
    "  ─────────────────────────────",
    "  \x1b[32m●\x1b[0m  ethereum     Ethereum Mainnet      \x1b[32mconnected\x1b[0m",
    "  \x1b[32m●\x1b[0m  polygon      Polygon PoS            \x1b[32mconnected\x1b[0m",
    "  \x1b[33m●\x1b[0m  arbitrum     Arbitrum One           \x1b[33msyncing\x1b[0m",
    "  \x1b[90m○\x1b[0m  optimism     Optimism               \x1b[90mdisconnected\x1b[0m",
    "  \x1b[90m○\x1b[0m  base         Base                   \x1b[90mdisconnected\x1b[0m",
    "  \x1b[90m○\x1b[0m  solana       Solana                 \x1b[90mdisconnected\x1b[0m",
    "",
  ],

  wallets: () => [
    "",
    "  \x1b[1mConfigured Wallets\x1b[0m",
    "  ─────────────────────────────",
    "  \x1b[38;2;125;211;252m0x742d\x1b[90m...35Cc\x1b[0m   main      ETH: \x1b[33m4.2180\x1b[0m   \x1b[32mactive\x1b[0m",
    "  \x1b[38;2;125;211;252m0x8Ba1\x1b[90m...f1e2\x1b[0m   trading   ETH: \x1b[33m0.0520\x1b[0m   \x1b[32mactive\x1b[0m",
    "  \x1b[38;2;125;211;252m0x1a9C\x1b[90m...9A31\x1b[0m   cold      ETH: \x1b[33m12.0000\x1b[0m  \x1b[90mlocked\x1b[0m",
    "",
  ],

  balance: () => [
    "",
    "  \x1b[1mWallet Balance\x1b[0m  \x1b[90m(0x742d...35Cc)\x1b[0m",
    "  ─────────────────────────────",
    "  ETH    \x1b[33m4.2180\x1b[0m     \x1b[38;2;125;211;252m$14,238.42\x1b[0m",
    "  USDC   \x1b[33m2,450.00\x1b[0m  \x1b[38;2;125;211;252m$2,450.00\x1b[0m",
    "  UNI    \x1b[33m120.50\x1b[0m    \x1b[38;2;125;211;252m$1,084.50\x1b[0m",
    "  LINK   \x1b[33m45.00\x1b[0m     \x1b[38;2;125;211;252m$612.00\x1b[0m",
    "  ─────────────────────────────",
    "  Total  \x1b[1;33m$18,384.92\x1b[0m",
    "",
  ],

  blocks: () => [
    "",
    "  \x1b[1mRecent Blocks\x1b[0m",
    "  ─────────────────────────────",
    "  \x1b[33m#19,284,102\x1b[0m  12 txns  \x1b[90m2 secs ago\x1b[0m   24.3 gwei",
    "  \x1b[33m#19,284,101\x1b[0m  156 txns \x1b[90m14 secs ago\x1b[0m  25.1 gwei",
    "  \x1b[33m#19,284,100\x1b[0m  89 txns  \x1b[90m26 secs ago\x1b[0m  23.8 gwei",
    "  \x1b[33m#19,284,099\x1b[0m  201 txns \x1b[90m38 secs ago\x1b[0m  24.0 gwei",
    "  \x1b[33m#19,284,098\x1b[0m  134 txns \x1b[90m50 secs ago\x1b[0m  22.5 gwei",
    "",
  ],

  peers: () => [
    "",
    "  \x1b[1mConnected Peers\x1b[0m",
    "  ─────────────────────────────",
    "  \x1b[32m●\x1b[0m  enode://a1b2c3...@18.201.1.42:30303    \x1b[32m8ms\x1b[0m",
    "  \x1b[32m●\x1b[0m  enode://d4e5f6...@52.14.211.88:30303   \x1b[32m12ms\x1b[0m",
    "  \x1b[32m●\x1b[0m  enode://g7h8i9...@13.56.192.17:30303   \x1b[33m45ms\x1b[0m",
    "  \x1b[32m●\x1b[0m  enode://j0k1l2...@34.230.50.99:30303   \x1b[32m15ms\x1b[0m",
    "  \x1b[32m●\x1b[0m  enode://m3n4o5...@18.191.144.3:30303   \x1b[32m9ms\x1b[0m",
    "  \x1b[90m  ... and 37 more\x1b[0m",
    "",
  ],

  connect: (args) => {
    if (!args[0]) {
      return ["  \x1b[31mUsage: connect <chain>\x1b[0m", "  Example: connect polygon"];
    }
    const chain = args[0].toLowerCase();
    const chains = ["ethereum", "polygon", "arbitrum", "optimism", "base", "solana"];
    if (!chains.includes(chain)) {
      return [`  \x1b[31mUnknown chain: ${chain}\x1b[0m`, `  Available: ${chains.join(", ")}`];
    }
    return [
      "",
      `  \x1b[33mConnecting to ${chain}...\x1b[0m`,
      `  \x1b[32m✓ Connected to ${chain}\x1b[0m`,
      "",
    ];
  },

  tx: (args) => {
    if (args.length < 2) {
      return ["  \x1b[31mUsage: tx <to_address> <amount>\x1b[0m", "  Example: tx 0x742d...35Cc 1.5"];
    }
    const hash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
    return [
      "",
      "  \x1b[33mBroadcasting transaction...\x1b[0m",
      `  \x1b[32m✓ Transaction submitted\x1b[0m`,
      `  Hash:   \x1b[38;2;125;211;252m${hash.slice(0, 18)}...${hash.slice(-8)}\x1b[0m`,
      `  To:     ${args[0]}`,
      `  Amount: ${args[1]} ETH`,
      `  Status: \x1b[33mpending\x1b[0m`,
      "",
    ];
  },

  clear: () => [],
};

// Rewrite the current input line from scratch (used after edits that move the cursor)
function redrawLine(term: XTerm, lineBuffer: string, cursorPos: number) {
  // Move cursor to start of input (after prompt)
  term.write("\r");
  term.write(`\x1b[${PROMPT_LEN}C`);
  // Clear from cursor to end of line
  term.write("\x1b[K");
  // Write the full buffer
  if (lineBuffer) term.write(lineBuffer);
  // Move cursor back to the correct position
  if (cursorPos < lineBuffer.length) {
    term.write(`\x1b[${lineBuffer.length - cursorPos}D`);
  }
}

export default function Terminal({ onCommand, mode = "local" }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const lineBufferRef = useRef("");
  const cursorPosRef = useRef(0);
  const busyRef = useRef(false); // blocks input during "thinking"
  const composingRef = useRef(false); // tracks IME composition state
  const { consumeCredits, creditBalance, currentTier } = useBilling();
  const { user } = useAuth();
  const [, setConnectionStatus] = useState<ConnectionStatus>("local");

  // Track terminal dimensions for the socket
  const colsRef = useRef(80);
  const rowsRef = useRef(24);

  // Remote container connection
  const { send: sendWs } = useTerminalSocket({
    enabled: mode === "remote",
    cols: colsRef.current,
    rows: rowsRef.current,
    tier: currentTier.id,
    userId: user?.address,
    onOutput: (data) => {
      if (termRef.current) {
        termRef.current.write(data);
      }
    },
    onStatusChange: (status) => {
      setConnectionStatus(status);
      if (status === "connected" && termRef.current) {
        // In remote mode, the container handles its own prompt
        // Don't write our local prompt
      }
    },
    onError: (msg) => {
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[31m  Error: ${msg}\x1b[0m\r\n`);
      }
    },
  });

  const writePrompt = useCallback((term: XTerm) => {
    term.write(PROMPT);
  }, []);

  // Commands that correspond to billable API endpoints
  const API_COMMAND_ENDPOINTS: Record<string, string> = {
    status: "/v1/chains/{chain}/status",
    chains: "/v1/chains/{chain}/status",
    balance: "/v1/wallets/{address}/balance",
    blocks: "/v1/blocks/latest",
    peers: "/v1/blocks/latest",
    tx: "/v1/contracts/{address}/call",
  };

  const processCommand = useCallback(
    (input: string): string[] => {
      const trimmed = input.trim();
      if (!trimmed) return [];

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Billing info — not in BUILTIN_COMMANDS, handle before API billing check
      if (cmd === "billing") {
        return [
          "",
          "  \x1b[1mBilling Status\x1b[0m",
          "  ─────────────────────────────",
          `  Credits:   \x1b[33m${creditBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}\x1b[0m`,
          `  Tier:      \x1b[38;2;125;211;252mDeveloper\x1b[0m`,
          `  Rate:      60 req/min | 10,000 req/day`,
          "",
          `  Visit the \x1b[38;2;125;211;252mBilling\x1b[0m page to purchase more credits.`,
          "",
        ];
      }

      if (BUILTIN_COMMANDS[cmd]) {
        // Bill API commands
        const endpoint = API_COMMAND_ENDPOINTS[cmd];
        if (endpoint) {
          const cost = getCostForEndpoint(endpoint);
          const ok = consumeCredits(endpoint);
          if (!ok) {
            return [
              `\x1b[31m  Insufficient credits or rate limit exceeded.\x1b[0m`,
              `  Cost: ${cost} credits | Balance: ${creditBalance.toFixed(2)}`,
              `  Run \x1b[38;2;125;211;252mbilling\x1b[0m or visit the Billing page to top up.`,
            ];
          }
        }
        return BUILTIN_COMMANDS[cmd](args);
      }

      if (onCommand) {
        return onCommand(cmd, args);
      }

      return [`  \x1b[31mUnknown command: ${cmd}\x1b[0m  Type \x1b[38;2;125;211;252mhelp\x1b[0m for available commands.`];
    },
    [onCommand, consumeCredits, creditBalance],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
      lineHeight: 1.4,
      allowProposedApi: true,
      theme: {
        background: "#0a0a0a",
        foreground: "#fafafa",
        cursor: "#7dd3fc",
        cursorAccent: "#0a0a0a",
        selectionBackground: "rgba(125, 211, 252, 0.2)",
        black: "#1a1a1a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#fafafa",
        brightBlack: "#525252",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;

    const banner = [
      "",
      "  \x1b[1;38;2;125;211;252m  ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗\x1b[0m",
      "  \x1b[1;38;2;125;211;252m ██╔════╝██║  ██║██╔══██╗██║████╗  ██║\x1b[0m",
      "  \x1b[1;38;2;125;211;252m ██║     ███████║███████║██║██╔██╗ ██║\x1b[0m",
      "  \x1b[1;38;2;125;211;252m ██║     ██╔══██║██╔══██║██║██║╚██╗██║\x1b[0m",
      "  \x1b[1;38;2;125;211;252m ╚██████╗██║  ██║██║  ██║██║██║ ╚████║\x1b[0m",
      "  \x1b[1;38;2;125;211;252m  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝\x1b[0m",
      "  \x1b[1m              SHELL\x1b[0m \x1b[90mv0.1.0\x1b[0m",
      "",
      "  Blockchain terminal interface. Type \x1b[38;2;125;211;252mhelp\x1b[0m to get started.",
      "",
    ];

    if (mode === "remote") {
      banner.forEach((line) => term.writeln(line));
      term.writeln("  \x1b[33mConnecting to remote container...\x1b[0m");
      term.writeln("");
    } else {
      banner.forEach((line) => term.writeln(line));
      writePrompt(term);
    }

    // ── Execute a command and reset the prompt (local mode only) ──
    const executeCommand = (raw: string) => {
      const cmd = raw.split(/\s+/)[0]?.toLowerCase() ?? "";

      if (raw === "clear") {
        term.clear();
      } else if (THINKING_COMMANDS.has(cmd)) {
        // Show thinking animation
        term.write("  \x1b[90m");
        const dots = [".", "..", "..."];
        let dotIdx = 0;
        const dotInterval = setInterval(() => {
          term.write("\r\x1b[K");
          term.write(`  \x1b[90mthinking${dots[dotIdx % 3]}\x1b[0m`);
          dotIdx++;
        }, 400);

        busyRef.current = true;
        setTimeout(() => {
          clearInterval(dotInterval);
          term.write("\r\x1b[K");
          const output = processCommand(raw);
          output.forEach((line) => term.writeln(line));
          busyRef.current = false;
          lineBufferRef.current = "";
          cursorPosRef.current = 0;
          writePrompt(term);
        }, 1800);
        return; // don't clear buffer or write prompt yet
      } else {
        const output = processCommand(raw);
        output.forEach((line) => term.writeln(line));
      }

      lineBufferRef.current = "";
      cursorPosRef.current = 0;
      writePrompt(term);
    };

    // ── onData: handles ALL text input (keyboard, paste, IME, mobile) ──
    const handleData = term.onData((data) => {
      // Remote mode: forward all input to the container via WebSocket
      if (mode === "remote") {
        sendWs({ type: "input", data });
        return;
      }

      // Ignore input during IME composition — compositionend will deliver final text
      if (composingRef.current) return;

      // Ignore input while a command is processing
      if (busyRef.current) return;

      const buf = lineBufferRef.current;
      const pos = cursorPosRef.current;

      // ── Enter ──
      if (data === "\r" || data === "\n") {
        term.writeln("");
        const raw = buf.trim();
        if (raw) {
          historyRef.current.push(raw);
          historyIndexRef.current = historyRef.current.length;
        }
        executeCommand(raw);
        return;
      }

      // ── Backspace (DEL 0x7F) or BS (0x08) ──
      if (data === "\x7f" || data === "\x08") {
        if (pos > 0) {
          lineBufferRef.current = buf.slice(0, pos - 1) + buf.slice(pos);
          cursorPosRef.current = pos - 1;
          if (pos < buf.length) {
            // Cursor was in the middle — redraw
            redrawLine(term, lineBufferRef.current, cursorPosRef.current);
          } else {
            // Cursor at end — simple backspace
            term.write("\b \b");
          }
        }
        return;
      }

      // ── Ctrl+C ──
      if (data === "\x03") {
        term.writeln("^C");
        lineBufferRef.current = "";
        cursorPosRef.current = 0;
        writePrompt(term);
        return;
      }

      // ── Ctrl+L (clear) ──
      if (data === "\x0c") {
        term.clear();
        writePrompt(term);
        term.write(lineBufferRef.current);
        return;
      }

      // ── Ctrl+U (clear line before cursor) ──
      if (data === "\x15") {
        lineBufferRef.current = buf.slice(pos);
        cursorPosRef.current = 0;
        redrawLine(term, lineBufferRef.current, 0);
        return;
      }

      // ── Ctrl+K (kill after cursor) ──
      if (data === "\x0b") {
        lineBufferRef.current = buf.slice(0, pos);
        term.write("\x1b[K");
        return;
      }

      // ── Ctrl+W (delete word backward) ──
      if (data === "\x17") {
        if (pos === 0) return;
        const before = buf.slice(0, pos);
        const after = buf.slice(pos);
        // Match: trailing spaces + the word before them
        const stripped = before.replace(/\s+\S*$/, "");
        lineBufferRef.current = stripped + after;
        cursorPosRef.current = stripped.length;
        redrawLine(term, lineBufferRef.current, cursorPosRef.current);
        return;
      }

      // ── Ctrl+A (beginning of line) ──
      if (data === "\x01") {
        if (pos > 0) {
          term.write(`\x1b[${pos}D`);
          cursorPosRef.current = 0;
        }
        return;
      }

      // ── Ctrl+E (end of line) ──
      if (data === "\x05") {
        if (pos < buf.length) {
          term.write(`\x1b[${buf.length - pos}C`);
          cursorPosRef.current = buf.length;
        }
        return;
      }

      // ── Escape sequences (arrow keys, Home, End, etc.) ──
      if (data.startsWith("\x1b")) {
        // Arrow Up
        if (data === "\x1b[A") {
          const history = historyRef.current;
          if (history.length > 0 && historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const cmd = history[historyIndexRef.current];
            lineBufferRef.current = cmd;
            cursorPosRef.current = cmd.length;
            redrawLine(term, cmd, cmd.length);
          }
          return;
        }
        // Arrow Down
        if (data === "\x1b[B") {
          const history = historyRef.current;
          if (historyIndexRef.current < history.length - 1) {
            historyIndexRef.current++;
            const cmd = history[historyIndexRef.current];
            lineBufferRef.current = cmd;
            cursorPosRef.current = cmd.length;
            redrawLine(term, cmd, cmd.length);
          } else if (historyIndexRef.current === history.length - 1) {
            historyIndexRef.current = history.length;
            lineBufferRef.current = "";
            cursorPosRef.current = 0;
            redrawLine(term, "", 0);
          }
          return;
        }
        // Arrow Left
        if (data === "\x1b[D") {
          if (pos > 0) {
            cursorPosRef.current = pos - 1;
            term.write("\x1b[D");
          }
          return;
        }
        // Arrow Right
        if (data === "\x1b[C") {
          if (pos < buf.length) {
            cursorPosRef.current = pos + 1;
            term.write("\x1b[C");
          }
          return;
        }
        // Home (\x1b[H or \x1b[1~)
        if (data === "\x1b[H" || data === "\x1b[1~") {
          if (pos > 0) {
            term.write(`\x1b[${pos}D`);
            cursorPosRef.current = 0;
          }
          return;
        }
        // End (\x1b[F or \x1b[4~)
        if (data === "\x1b[F" || data === "\x1b[4~") {
          if (pos < buf.length) {
            term.write(`\x1b[${buf.length - pos}C`);
            cursorPosRef.current = buf.length;
          }
          return;
        }
        // Delete (\x1b[3~)
        if (data === "\x1b[3~") {
          if (pos < buf.length) {
            lineBufferRef.current = buf.slice(0, pos) + buf.slice(pos + 1);
            redrawLine(term, lineBufferRef.current, pos);
          }
          return;
        }
        // Ignore all other escape sequences (F-keys, PageUp/Down, Insert, etc.)
        return;
      }

      // ── Tab (ignore — no autocomplete yet) ──
      if (data === "\t") return;

      // ── Printable characters + pasted text + IME result ──
      // data can be a single character or a multi-char paste
      // Filter out any remaining control characters
      const cleaned = data.replace(/[\x00-\x08\x0e-\x1f]/g, "");
      if (!cleaned) return;

      if (pos < buf.length) {
        // Inserting in the middle
        lineBufferRef.current = buf.slice(0, pos) + cleaned + buf.slice(pos);
        cursorPosRef.current = pos + cleaned.length;
        redrawLine(term, lineBufferRef.current, cursorPosRef.current);
      } else {
        // Appending at end (common case)
        lineBufferRef.current = buf + cleaned;
        cursorPosRef.current = lineBufferRef.current.length;
        term.write(cleaned);
      }
    });

    // ── Mobile / IME support: hidden textarea + composition events ──
    const container = containerRef.current;

    // Create a hidden textarea that captures mobile keyboard input
    const textarea = document.createElement("textarea");
    textarea.setAttribute("autocomplete", "off");
    textarea.setAttribute("autocorrect", "off");
    textarea.setAttribute("autocapitalize", "off");
    textarea.setAttribute("spellcheck", "false");
    textarea.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    container.appendChild(textarea);
    inputRef.current = textarea;

    // Focus the textarea on terminal click so mobile keyboard opens
    const handleClick = () => {
      textarea.focus({ preventScroll: true });
      term.focus();
    };
    container.addEventListener("click", handleClick);

    // Forward textarea input events to xterm (mobile keyboard support)
    const handleTextareaInput = () => {
      if (composingRef.current || busyRef.current) return;
      const text = textarea.value;
      if (text) {
        // Feed each character through the onData handler logic
        for (const ch of text) {
          if (!busyRef.current && !composingRef.current) {
            // Simulate onData for each character
            const buf = lineBufferRef.current;
            const pos = cursorPosRef.current;
            if (pos < buf.length) {
              lineBufferRef.current = buf.slice(0, pos) + ch + buf.slice(pos);
              cursorPosRef.current = pos + ch.length;
              redrawLine(term, lineBufferRef.current, cursorPosRef.current);
            } else {
              lineBufferRef.current += ch;
              cursorPosRef.current = lineBufferRef.current.length;
              term.write(ch);
            }
          }
        }
        textarea.value = "";
      }
    };
    textarea.addEventListener("input", handleTextareaInput);

    // IME composition events — suppress onData during composition
    const handleCompositionStart = () => {
      composingRef.current = true;
    };
    const handleCompositionEnd = (e: CompositionEvent) => {
      composingRef.current = false;
      const text = e.data;
      if (text && !busyRef.current) {
        const buf = lineBufferRef.current;
        const pos = cursorPosRef.current;
        if (pos < buf.length) {
          lineBufferRef.current = buf.slice(0, pos) + text + buf.slice(pos);
          cursorPosRef.current = pos + text.length;
          redrawLine(term, lineBufferRef.current, cursorPosRef.current);
        } else {
          lineBufferRef.current += text;
          cursorPosRef.current = lineBufferRef.current.length;
          term.write(text);
        }
      }
    };
    textarea.addEventListener("compositionstart", handleCompositionStart);
    textarea.addEventListener("compositionend", handleCompositionEnd);

    // Also attach composition events on the terminal's screen element for desktop IME
    const screenEl = container.querySelector(".xterm-screen");
    if (screenEl) {
      screenEl.addEventListener("compositionstart", handleCompositionStart as EventListener);
      screenEl.addEventListener("compositionend", handleCompositionEnd as EventListener);
    }

    // ── Resize observer ──
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      // Sync dimensions to refs and send resize to remote container
      const newCols = term.cols;
      const newRows = term.rows;
      if (newCols !== colsRef.current || newRows !== rowsRef.current) {
        colsRef.current = newCols;
        rowsRef.current = newRows;
        if (mode === "remote") {
          sendWs({ type: "resize", cols: newCols, rows: newRows });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      handleData.dispose();
      resizeObserver.disconnect();
      container.removeEventListener("click", handleClick);
      textarea.removeEventListener("input", handleTextareaInput);
      textarea.removeEventListener("compositionstart", handleCompositionStart);
      textarea.removeEventListener("compositionend", handleCompositionEnd);
      if (screenEl) {
        screenEl.removeEventListener("compositionstart", handleCompositionStart as EventListener);
        screenEl.removeEventListener("compositionend", handleCompositionEnd as EventListener);
      }
      textarea.remove();
      term.dispose();
    };
  }, [writePrompt, processCommand]);

  return (
    <div className="terminal-container">
      <div className="terminal-chrome">
        <div className="terminal-dots">
          <span className="dot dot--red" />
          <span className="dot dot--yellow" />
          <span className="dot dot--green" />
        </div>
        <span className="terminal-title">ChainShell</span>
      </div>
      <div ref={containerRef} className="terminal-body" />
    </div>
  );
}

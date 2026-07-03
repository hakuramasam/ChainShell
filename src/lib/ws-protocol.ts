// WebSocket protocol between browser terminal and server

export const WS_PATH = "/ws/terminal";

// Client → Server messages
export type ClientMessage =
  | { type: "input"; data: string }       // Terminal keystrokes / paste
  | { type: "resize"; cols: number; rows: number }  // Terminal resize
  | { type: "ping" };                     // Keep-alive

// Server → Client messages
export type ServerMessage =
  | { type: "output"; data: string }      // Terminal output (raw bytes, base64 for binary)
  | { type: "connected"; containerId: string }  // Container ready
  | { type: "error"; message: string }    // Error
  | { type: "pong" }                      // Keep-alive response
  | { type: "closed" };                   // Container exited

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
}

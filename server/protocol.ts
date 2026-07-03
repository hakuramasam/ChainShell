// WebSocket protocol between browser terminal and server
// Shared types — duplicated from src/lib/ws-protocol.ts for server build isolation

// Client → Server messages
export type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "ping" };

// Server → Client messages
export type ServerMessage =
  | { type: "output"; data: string }
  | { type: "connected"; containerId: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "closed" };

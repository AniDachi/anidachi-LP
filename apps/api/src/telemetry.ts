/**
 * Worker room telemetry via Cloudflare Workers Analytics Engine.
 * Block 1.2 of docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
 *
 * Non-blocking, privacy-preserving: room ids are stored only as a short
 * non-reversible hash, and no display names, tokens, or IPs are recorded.
 * Writes are best-effort — telemetry never throws into the request path, and
 * a missing binding (e.g. local `wrangler dev`) silently no-ops.
 */

/** Structural shape of the Analytics Engine binding (avoids a type dependency). */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
}

export type RoomTelemetryEventName =
  | "ws_open"
  | "ws_close"
  | "ws_token_reject"
  | "join"
  | "p2p_signal"
  | "p2p_replay"
  | "room_full";

export interface RoomTelemetryContext {
  /** "staging" | "production" | "local" — from the ANIDACHI_ENV worker var. */
  env: string;
  roomId: string;
}

export interface RoomTelemetryEvent {
  name: RoomTelemetryEventName;
  /** Optional role dimension ("host" | "member"). */
  role?: string;
  /** Numeric value for the event, e.g. participant count. Defaults to 1. */
  value?: number;
}

export interface RoomDataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

/** FNV-1a 32-bit hash as 8-char hex — cheap, deterministic, non-reversible. */
export function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Builds an Analytics Engine data point. Pure and synchronous so it can be
 * unit tested without a worker runtime.
 *
 * Layout:
 *   indexes: [roomIdHash]      — sampling/grouping key
 *   blobs:   [env, name, roomIdHash, role]
 *   doubles: [value]
 */
export function buildRoomDataPoint(
  context: RoomTelemetryContext,
  event: RoomTelemetryEvent,
): RoomDataPoint {
  const roomIdHash = shortHash(context.roomId);
  return {
    indexes: [roomIdHash],
    blobs: [context.env, event.name, roomIdHash, event.role ?? ""],
    doubles: [Number.isFinite(event.value) ? (event.value as number) : 1],
  };
}

export function emitRoomTelemetry(
  dataset: AnalyticsEngineDataset | undefined,
  context: RoomTelemetryContext,
  event: RoomTelemetryEvent,
): void {
  if (!dataset) return;
  try {
    dataset.writeDataPoint(buildRoomDataPoint(context, event));
  } catch {
    // Telemetry is best-effort and must never affect room behavior.
  }
}

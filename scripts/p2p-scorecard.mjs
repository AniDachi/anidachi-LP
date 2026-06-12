#!/usr/bin/env node
/**
 * P2P / room scorecard for Anidachi extension debug exports.
 * Block 1.1 of docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
 *
 * Parses one or more debug exports (full or compact format, produced by the
 * extension debug panel) and prints the metrics the SLOs are judged on:
 * per-peer time-to-connected and time-to-first-video, selected candidate-pair
 * types (direct/srflx/relay share), ICE restarts with reasons, room WebSocket
 * reconnects, and signaling health.
 *
 * Usage:
 *   node scripts/p2p-scorecard.mjs export-host.json [export-guest.json ...]
 *
 * Exit code is 0 even when metrics look bad — this is a reporting tool, not a
 * gate. Gates compare its output against the recorded baseline.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

function fail(message) {
  console.error(`p2p-scorecard: ${message}`);
  process.exit(1);
}

function parseExport(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }

  const entries = Array.isArray(parsed?.entries) ? parsed.entries : null;
  if (!entries) fail(`${path} has no "entries" array — is it a debug export?`);

  return {
    path,
    buildId: parsed.buildId ?? "unknown",
    generatedAt: parsed.generatedAt ?? "unknown",
    entries: entries
      .filter((entry) => entry && typeof entry.scope === "string")
      .map((entry) => ({
        ...entry,
        atMs: Date.parse(entry.at ?? "") || null,
      })),
  };
}

function ms(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}ms`;
}

function pct(part, total) {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function get(data, ...keys) {
  let value = data;
  for (const key of keys) {
    if (value === null || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

function analyzeFile(file) {
  const peers = new Map();

  const peer = (remoteUserId) => {
    if (!peers.has(remoteUserId)) {
      peers.set(remoteUserId, {
        remoteUserId,
        createdAtMs: null,
        connectedAtMs: null,
        firstVideoAtMs: null,
        firstAudioAtMs: null,
        candidatePair: null,
        iceRestarts: [],
        offerCollisions: 0,
        signalFailures: 0,
        connectionStates: [],
      });
    }
    return peers.get(remoteUserId);
  };

  const room = {
    wsOpens: 0,
    wsCloses: 0,
    pongTimeouts: 0,
    reconnectsScheduled: 0,
    signalsSent: new Map(),
    signalsReceived: new Map(),
    autoplayBlocked: 0,
    cameraFailures: 0,
    voiceFailures: 0,
  };

  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const entry of file.entries) {
    const { scope, message, data, atMs } = entry;
    const remoteUserId = get(data, "remoteUserId");

    if (scope === "room.ws") {
      if (message === "open") room.wsOpens += 1;
      if (message === "closed") room.wsCloses += 1;
      if (message.includes("pong timeout")) room.pongTimeouts += 1;
    }
    if (scope === "overlay.room" && message === "auto reconnect scheduled") {
      room.reconnectsScheduled += 1;
    }

    if (scope === "p2p.peer" && message === "created" && remoteUserId) {
      const p = peer(remoteUserId);
      if (p.createdAtMs === null) p.createdAtMs = atMs;
    }

    if (scope === "p2p.state" && message === "connection" && remoteUserId) {
      const p = peer(remoteUserId);
      const state = get(data, "connectionState");
      if (state) p.connectionStates.push(state);
      if (state === "connected" && p.connectedAtMs === null) {
        p.connectedAtMs = atMs;
      }
    }

    if (scope === "p2p.track" && message === "received" && remoteUserId) {
      const p = peer(remoteUserId);
      const kind = get(data, "kind");
      if (kind === "video" && p.firstVideoAtMs === null) p.firstVideoAtMs = atMs;
      if (kind === "audio" && p.firstAudioAtMs === null) p.firstAudioAtMs = atMs;
    }

    if (scope === "p2p.stats" && remoteUserId) {
      const pair = get(data, "summary", "candidatePair");
      if (pair) peer(remoteUserId).candidatePair = pair;
    }

    if (scope === "p2p.ice" && remoteUserId) {
      if (message === "restart" || message === "request remote restart") {
        peer(remoteUserId).iceRestarts.push(get(data, "reason") ?? message);
      }
    }

    if (scope === "p2p.signal") {
      if (message === "send offer") bump(room.signalsSent, "offer");
      if (message === "send answer") bump(room.signalsSent, "answer");
      if (message === "received") bump(room.signalsReceived, get(data, "kind") ?? "unknown");
      if (message === "ignored offer collision" && remoteUserId) {
        peer(remoteUserId).offerCollisions += 1;
      }
      if (message === "failed") {
        if (remoteUserId) peer(remoteUserId).signalFailures += 1;
      }
    }

    if (scope === "p2p.audio" && message === "autoplay blocked") room.autoplayBlocked += 1;
    if (scope === "p2p.camera" && message === "failed") room.cameraFailures += 1;
    if (scope === "p2p.voice" && message === "failed") room.voiceFailures += 1;
  }

  return { file, peers: [...peers.values()], room };
}

function pairKind(candidatePair) {
  if (!candidatePair) return "unknown";
  const local = candidatePair.localCandidateType;
  const remote = candidatePair.remoteCandidateType;
  if (local === "relay" || remote === "relay") return "relay";
  if (candidatePair.direct === true) return "direct";
  if (local || remote) return `${local ?? "?"}/${remote ?? "?"}`;
  return "unknown";
}

function printReport(analyses) {
  const allTimeToConnected = [];
  const allTimeToVideo = [];
  let totalPeers = 0;
  let connectedPeers = 0;
  let relayPeers = 0;
  let pairsWithStats = 0;

  for (const { file, peers, room } of analyses) {
    console.log(`\n=== ${basename(file.path)} (build ${file.buildId}, ${file.generatedAt}) ===`);
    console.log(
      `room: ws opens=${room.wsOpens} closes=${room.wsCloses} pong-timeouts=${room.pongTimeouts} ` +
        `reconnects-scheduled=${room.reconnectsScheduled}`
    );
    const sent = [...room.signalsSent].map(([k, v]) => `${k}:${v}`).join(" ") || "none";
    const received = [...room.signalsReceived].map(([k, v]) => `${k}:${v}`).join(" ") || "none";
    console.log(`signals: sent ${sent} | received ${received}`);
    if (room.autoplayBlocked || room.cameraFailures || room.voiceFailures) {
      console.log(
        `media issues: autoplay-blocked=${room.autoplayBlocked} camera-failures=${room.cameraFailures} ` +
          `voice-failures=${room.voiceFailures}`
      );
    }

    if (!peers.length) {
      console.log("peers: none (no p2p activity in this export)");
      continue;
    }

    for (const p of peers) {
      totalPeers += 1;
      const timeToConnected =
        p.connectedAtMs !== null && p.createdAtMs !== null ? p.connectedAtMs - p.createdAtMs : null;
      const timeToVideo =
        p.firstVideoAtMs !== null && p.createdAtMs !== null ? p.firstVideoAtMs - p.createdAtMs : null;
      if (timeToConnected !== null) {
        allTimeToConnected.push(timeToConnected);
        connectedPeers += 1;
      }
      if (timeToVideo !== null) allTimeToVideo.push(timeToVideo);

      const kind = pairKind(p.candidatePair);
      if (p.candidatePair) {
        pairsWithStats += 1;
        if (kind === "relay") relayPeers += 1;
      }

      console.log(
        `peer ${p.remoteUserId.slice(0, 12)}…: connected=${ms(timeToConnected)} ` +
          `first-video=${ms(timeToVideo)} pair=${kind} ` +
          `ice-restarts=${p.iceRestarts.length}${
            p.iceRestarts.length ? ` (${p.iceRestarts.join(", ")})` : ""
          } collisions=${p.offerCollisions} signal-failures=${p.signalFailures}`
      );
      if (!p.connectionStates.includes("connected")) {
        console.log(
          `  ⚠ never reached connected (states: ${p.connectionStates.join(" → ") || "none"})`
        );
      }
    }
  }

  console.log("\n=== scorecard summary ===");
  console.log(`peers analyzed:        ${totalPeers}`);
  console.log(`connect success:       ${pct(connectedPeers, totalPeers)} (${connectedPeers}/${totalPeers})  [SLO S4 >= 99%]`);
  console.log(`time-to-connected p50: ${ms(median(allTimeToConnected))}`);
  console.log(`time-to-video p50:     ${ms(median(allTimeToVideo))}  [SLO S3 p50 < 2000ms]`);
  console.log(`relay (TURN) share:    ${pct(relayPeers, pairsWithStats)} (${relayPeers}/${pairsWithStats} with stats)  [SLO S10 report]`);
}

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("Usage: node scripts/p2p-scorecard.mjs <debug-export.json> [more.json ...]");
  process.exit(2);
}

printReport(paths.map(parseExport).map(analyzeFile));

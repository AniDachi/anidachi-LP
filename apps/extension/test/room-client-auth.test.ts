import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRoomWebSocketUrl,
  connectWebsiteRoom,
  connectWebsiteRoomFromApi,
  connectRoomHttpMessage,
  createRoomHttpMessage,
  createRoom,
  createWebsiteRoomFromApi,
  createWebsiteRoomHeaders,
  endRoom,
  endRoomHttpMessage,
  endWebsiteRoomFromApi,
  handleRoomHttpMessage,
  isQuotaExhaustedError,
  isTerminalRoomJoinError,
  isRoomHttpMessage,
  RoomApiError,
  RoomClient,
} from "../src/room-client";

describe("authenticated room client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds websocket URLs with room tokens", () => {
    const url = new URL(buildRoomWebSocketUrl("room 1", "token+1"));

    expect(url.href).toBe("ws://127.0.0.1:8787/ws/room%201?roomToken=token%2B1");
  });

  it("creates website room headers with bearer auth", () => {
    expect(createWebsiteRoomHeaders("access-1")).toEqual({
      Authorization: "Bearer access-1",
      "Content-Type": "application/json",
    });
  });

  it("validates room bridge runtime messages", () => {
    expect(isRoomHttpMessage(createRoomHttpMessage("access-1"))).toBe(true);
    expect(
      isRoomHttpMessage(
        createRoomHttpMessage("access-1", {
          sourceUrl: "https://www.youtube.com/watch?v=abc",
          videoFingerprint: "youtube|abc",
          title: "Video title",
        }),
      ),
    ).toBe(true);
    expect(isRoomHttpMessage(connectRoomHttpMessage("room-1", "access-1"))).toBe(true);
    expect(isRoomHttpMessage({ type: "ANIDACHI_ROOM_HTTP", command: "unknown" })).toBe(false);
    expect(isRoomHttpMessage({ type: "ANIDACHI_ROOM_HTTP", command: "create-room" })).toBe(false);
    expect(
      isRoomHttpMessage({
        type: "ANIDACHI_ROOM_HTTP",
        command: "create-room",
        accessToken: "access-1",
        input: "bad",
      }),
    ).toBe(false);
  });

  it("creates authenticated website rooms from the background API helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          roomId: "room-1",
          roomToken: "room-token-1",
          shareableLink: "http://localhost:3003/room/room-1",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      sourceUrl: "https://www.youtube.com/watch?v=abc",
      videoFingerprint: "youtube|abc",
      title: "Video title",
    };

    await expect(createWebsiteRoomFromApi("access-1", input)).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
      reused: false,
      quota: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://localhost:3003/api/rooms"), {
      method: "POST",
      headers: {
        Authorization: "Bearer access-1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  });

  it("gets a room token for existing website rooms from the background API helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ roomToken: "room-token-2" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(connectWebsiteRoomFromApi("room-2", "access-1")).resolves.toEqual({
      roomToken: "room-token-2",
      quota: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://localhost:3003/api/rooms/room-2/connect"), {
      method: "POST",
      headers: {
        Authorization: "Bearer access-1",
        "Content-Type": "application/json",
      },
    });
  });

  it("parses quota, reused, and clientRequestId on create", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          roomId: "room-1",
          roomToken: "room-token-1",
          shareableLink: "http://localhost:3003/room/room-1",
          reused: true,
          quota: { remainingSeconds: 900, resetAt: "2026-06-14T00:00:00.000Z" },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const input = { clientRequestId: "click-1" };
    await expect(createWebsiteRoomFromApi("access-1", input)).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
      reused: true,
      quota: { remainingSeconds: 900, resetAt: "2026-06-14T00:00:00.000Z" },
    });
    expect(isRoomHttpMessage(createRoomHttpMessage("access-1", input))).toBe(true);
  });

  it("surfaces quota exhaustion as a structured room api error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Daily free watch-party time is used up",
          code: "QUOTA_EXHAUSTED",
          resetAt: "2026-06-14T00:00:00.000Z",
          remainingSeconds: 0,
        }),
        { status: 403 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleRoomHttpMessage(createRoomHttpMessage("access-1"));
    expect(response).toEqual({
      ok: false,
      error: "Daily free watch-party time is used up (403)",
      code: "QUOTA_EXHAUSTED",
      resetAt: "2026-06-14T00:00:00.000Z",
      status: 403,
    });
  });

  it("rebuilds quota errors across the runtime bridge", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: "Daily free watch-party time is used up (403)",
      code: "QUOTA_EXHAUSTED",
      resetAt: "2026-06-14T00:00:00.000Z",
      status: 403,
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    const error = await createRoom("access-1").catch((caught) => caught);
    expect(isQuotaExhaustedError(error)).toBe(true);
    expect(error.resetAt).toBe("2026-06-14T00:00:00.000Z");
    expect(error.status).toBe(403);
  });

  it("classifies forbidden or missing room joins as terminal unless they are quota errors", () => {
    expect(isTerminalRoomJoinError(new RoomApiError("Forbidden", undefined, undefined, 403))).toBe(
      true,
    );
    expect(isTerminalRoomJoinError(new RoomApiError("Missing", undefined, undefined, 404))).toBe(
      true,
    );
    expect(
      isTerminalRoomJoinError(
        new RoomApiError(
          "Daily free watch-party time is used up",
          "QUOTA_EXHAUSTED",
          "2026-06-14T00:00:00.000Z",
          403,
        ),
      ),
    ).toBe(false);
    expect(isTerminalRoomJoinError(new RoomApiError("Server error", undefined, undefined, 500))).toBe(
      false,
    );
  });

  it("ends rooms through the api helper and runtime bridge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, endedAt: "2026-06-13T12:00:00.000Z" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(endWebsiteRoomFromApi("room-3", "access-1")).resolves.toEqual({
      endedAt: "2026-06-13T12:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://localhost:3003/api/rooms/room-3/end"), {
      method: "POST",
      headers: {
        Authorization: "Bearer access-1",
        "Content-Type": "application/json",
      },
    });

    expect(isRoomHttpMessage(endRoomHttpMessage("room-3", "access-1"))).toBe(true);
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      ended: { endedAt: "2026-06-13T12:00:00.000Z" },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    await expect(endRoom("room-3", "access-1")).resolves.toEqual({
      endedAt: "2026-06-13T12:00:00.000Z",
    });
    expect(sendMessage).toHaveBeenCalledWith(endRoomHttpMessage("room-3", "access-1"));
  });

  it("creates rooms through the extension runtime bridge", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      room: {
        roomId: "room-1",
        roomToken: "room-token-1",
        shareableLink: "http://localhost:3003/room/room-1",
      },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const input = {
      sourceUrl: "https://www.youtube.com/watch?v=abc",
      videoFingerprint: "youtube|abc",
      title: "Video title",
    };

    await expect(createRoom("access-1", input)).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
    });
    expect(sendMessage).toHaveBeenCalledWith(createRoomHttpMessage("access-1", input));
  });

  it("connects rooms through the extension runtime bridge", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      connection: { roomToken: "room-token-2" },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(connectWebsiteRoom("room-2", "access-1")).resolves.toEqual({
      roomToken: "room-token-2",
    });
    expect(sendMessage).toHaveBeenCalledWith(connectRoomHttpMessage("room-2", "access-1"));
  });

  it("ignores close events from stale websocket connections", () => {
    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly listeners = new Map<string, Array<(event: unknown) => void>>();
      readyState = FakeWebSocket.CONNECTING;
      url: string;

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
      }

      addEventListener(type: string, listener: (event: unknown) => void): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      close(): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.dispatch("close", { code: 1000, reason: "client close", wasClean: true });
      }

      send(): void {
        return undefined;
      }

      open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open", {});
      }

      dispatch(type: string, event: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);
    const statuses: string[] = [];
    const client = new RoomClient();
    const options = (roomToken: string) => ({
      roomId: "room-1",
      roomToken,
      participant: {
        id: "user-1",
        displayName: "User",
        role: "host" as const,
        cameraEnabled: false,
        syncStatus: "unknown" as const,
        lastSeenAt: 0,
      },
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: (status: string) => statuses.push(status),
    });

    client.connect(options("room-token-1"));
    client.connect(options("room-token-2"));
    sockets[0]?.dispatch("close", { code: 1006, reason: "", wasClean: false });
    sockets[1]?.open();

    expect(statuses).toEqual(["connecting", "connecting", "connected"]);
  });

  it("keeps room websocket connections alive with ping and pong", () => {
    vi.useFakeTimers();

    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly listeners = new Map<string, Array<(event: unknown) => void>>();
      readonly sent: string[] = [];
      readyState = FakeWebSocket.CONNECTING;
      url: string;

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
      }

      addEventListener(type: string, listener: (event: unknown) => void): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      close(code = 1000, reason = "client close"): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.dispatch("close", { code, reason, wasClean: code === 1000 });
      }

      send(data: string): void {
        this.sent.push(data);
      }

      open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open", {});
      }

      message(data: unknown): void {
        this.dispatch("message", { data: JSON.stringify(data) });
      }

      dispatch(type: string, event: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);
    const onEvent = vi.fn();
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: {
        id: "user-1",
        displayName: "User",
        role: "host",
        cameraEnabled: false,
        syncStatus: "unknown",
        lastSeenAt: 0,
      },
      videoFingerprint: "video-1",
      onEvent,
      onStatus: vi.fn(),
    });

    sockets[0]?.open();
    const firstPing = JSON.parse(sockets[0]?.sent[1] ?? "{}") as { type?: string; sentAt?: number };

    expect(JSON.parse(sockets[0]?.sent[0] ?? "{}")).toMatchObject({ type: "JOIN" });
    expect(firstPing.type).toBe("PING");

    sockets[0]?.message({
      type: "PONG",
      roomId: "room-1",
      sentAt: firstPing.sentAt,
      serverTime: Number(firstPing.sentAt) + 1,
    });
    vi.advanceTimersByTime(20_000);

    expect(onEvent).not.toHaveBeenCalled();
    expect(JSON.parse(sockets[0]?.sent.at(-1) ?? "{}")).toMatchObject({ type: "PING" });

    client.close();
    vi.useRealTimers();
  });

  it("closes stale room websocket connections when pong is missing", () => {
    vi.useFakeTimers();

    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly listeners = new Map<string, Array<(event: unknown) => void>>();
      readyState = FakeWebSocket.CONNECTING;
      closeCode: number | null = null;
      closeReason: string | null = null;
      url: string;

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
      }

      addEventListener(type: string, listener: (event: unknown) => void): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      close(code = 1000, reason = "client close"): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.closeCode = code;
        this.closeReason = reason;
        this.dispatch("close", { code, reason, wasClean: code === 1000 });
      }

      send(): void {
        return undefined;
      }

      open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open", {});
      }

      dispatch(type: string, event: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);
    const statuses: string[] = [];
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: {
        id: "user-1",
        displayName: "User",
        role: "host",
        cameraEnabled: false,
        syncStatus: "unknown",
        lastSeenAt: 0,
      },
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });

    sockets[0]?.open();
    vi.advanceTimersByTime(45_000);

    expect(sockets[0]?.closeCode).toBe(4001);
    expect(sockets[0]?.closeReason).toBe("Anidachi keepalive timeout");
    expect(statuses).toEqual(["connecting", "connected", "closed"]);

    vi.useRealTimers();
  });
});

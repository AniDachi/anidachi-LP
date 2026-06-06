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
  isRoomHttpMessage,
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
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://localhost:3003/api/rooms/room-2/connect"), {
      method: "POST",
      headers: {
        Authorization: "Bearer access-1",
        "Content-Type": "application/json",
      },
    });
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
});

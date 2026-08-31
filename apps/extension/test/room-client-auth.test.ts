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
  endWebsiteRoomFromApi,
  handleRoomHttpMessage,
  isQuotaExhaustedError,
  isTerminalRoomJoinError,
  isRoomHttpMessage,
  RoomApiError,
  RoomAdmissionFence,
  ROOM_CONNECT_REQUEST_TIMEOUT_MS,
  RoomClient,
} from "../src/room-client";
import type { PreparedRoomSession } from "../src/room-session-storage";

class ControlledWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: ControlledWebSocket[] = [];

  readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  readonly sent: string[] = [];
  readyState = ControlledWebSocket.CONNECTING;

  constructor(readonly url: string) {
    ControlledWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(code = 1000, reason = "client close"): void {
    if (this.readyState === ControlledWebSocket.CLOSED) return;
    this.readyState = ControlledWebSocket.CLOSED;
    this.dispatch("close", { code, reason, wasClean: code === 1000 });
  }

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = ControlledWebSocket.OPEN;
    this.dispatch("open", {});
  }

  message(value: unknown): void {
    this.dispatch("message", {
      data: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const roomParticipant = {
  id: "user-1",
  displayName: "User",
  role: "host" as const,
  cameraEnabled: false,
  mediaSeat: "none" as const,
  syncStatus: "unknown" as const,
  lastSeenAt: 0,
};

const preparedRoomSession: PreparedRoomSession = {
  version: 1 as const,
  preparationId: "preparation-1",
  roomId: null,
  ownerUserId: "user-1",
  participantSessionId: "participant-session-1",
};

function preparedRoomSessionFor(roomId: string): PreparedRoomSession {
  return {
    ...preparedRoomSession,
    preparationId: `preparation-${roomId}`,
    roomId,
  };
}

function confirmedRoomSession(
  roomId: string,
  prepared: PreparedRoomSession = preparedRoomSessionFor(roomId),
) {
  return {
    version: 1 as const,
    revision: 1,
    roomId,
    ownerUserId: prepared.ownerUserId,
    participantSessionId: prepared.participantSessionId,
    cameraEnabled: false,
    voiceMode: "push-to-talk" as const,
  };
}

const confirmRoomSession = vi.fn(async (
  _tabId: number,
  prepared: PreparedRoomSession,
  roomId: string,
) => confirmedRoomSession(roomId, prepared));

function roomSnapshot(roomId = "room-1") {
  return {
    type: "ROOM_SNAPSHOT" as const,
    roomId,
    roomGeneration: 1,
    serverSeq: 1,
    sourceGeneration: 1,
    participants: [roomParticipant],
  };
}

function roomHistoryAuthority(sourceGeneration = 1, attestation = `proof-${sourceGeneration}`) {
  return {
    type: "ROOM_HISTORY_AUTHORITY" as const,
    roomId: "room-1",
    participantSessionId: "participant-session-1",
    roomGeneration: 1,
    sourceGeneration,
    attestation,
  };
}

function roomHistoryAuthorityPayload(
  sourceGeneration = 1,
  attestation = `proof-${sourceGeneration}`,
) {
  const { type: _type, ...authority } = roomHistoryAuthority(sourceGeneration, attestation);
  return authority;
}

function sourceChanged(sourceGeneration: number) {
  const source = {
    provider: "crunchyroll" as const,
    sourceUrl: `https://www.crunchyroll.com/watch/episode-${sourceGeneration}`,
    canonicalUrl: `https://www.crunchyroll.com/watch/episode-${sourceGeneration}`,
    videoFingerprint: `crunchyroll|series-a|s1|e${sourceGeneration}`,
    title: `Episode ${sourceGeneration}`,
  };
  return {
    type: "SOURCE_CHANGED" as const,
    roomId: "room-1",
    roomGeneration: 1,
    sourceGeneration,
    serverSeq: sourceGeneration,
    serverReceivedAt: 1_000,
    source,
    hostState: {
      videoFingerprint: source.videoFingerprint,
      sourceUrl: source.sourceUrl,
      playing: true,
      hostTime: 10,
      updatedAt: 1_000,
      playbackRate: 1,
    },
  };
}

function installControlledWebSocket(): void {
  ControlledWebSocket.instances = [];
  vi.stubGlobal("WebSocket", ControlledWebSocket);
}

describe("authenticated room client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(isRoomHttpMessage(createRoomHttpMessage("access-1", preparedRoomSession))).toBe(true);
    expect(
      isRoomHttpMessage(
        createRoomHttpMessage("access-1", preparedRoomSession, {
          sourceUrl: "https://www.youtube.com/watch?v=abc",
          videoFingerprint: "youtube|abc",
          title: "Video title",
        }),
      ),
    ).toBe(true);
    expect(
      isRoomHttpMessage(
        connectRoomHttpMessage("room-1", "access-1", preparedRoomSessionFor("room-1")),
      ),
    ).toBe(true);
    expect(isRoomHttpMessage({
      type: "ANIDACHI_ROOM_HTTP",
      command: "create-room",
      accessToken: "access-1",
    })).toBe(false);
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
      sourceUrl: "https://www.crunchyroll.com/ru/watch/G8WUNM123/episode-one#ignored=value",
      videoFingerprint: "crunchyroll|watch/G8WUNM123",
      title: "Episode one",
      showId: "show-1",
      episodeId: "episode-1",
      clientRequestId: "click-1",
    };

    await expect(createWebsiteRoomFromApi(
      "access-1",
      "participant-session-1",
      input,
    )).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
      reused: false,
      quota: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:3003/api/rooms"),
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: "https://www.crunchyroll.com/watch/G8WUNM123",
          videoFingerprint: "crunchyroll|watch/G8WUNM123",
          title: "Episode one",
          showId: "show-1",
          episodeId: "episode-1",
          clientRequestId: "click-1",
          participantSessionId: "participant-session-1",
        }),
      },
    );
  });

  it("canonicalizes the exact current youtu.be fingerprint alias before room creation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        roomId: "room-1",
        roomToken: "room-token-1",
        shareableLink: "http://localhost:3003/room/room-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createWebsiteRoomFromApi("access-1", "participant-session-1", {
      sourceUrl: "https://youtu.be/dQw4w9WgXcQ/",
      videoFingerprint: "youtube|/dQw4w9WgXcQ/",
      title: "Video title",
      showId: "show-1",
      episodeId: "episode-1",
      clientRequestId: "click-1",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
      title: "Video title",
      showId: "show-1",
      episodeId: "episode-1",
      clientRequestId: "click-1",
      participantSessionId: "participant-session-1",
    });
  });

  it.each([
    [{ sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
    [{ videoFingerprint: "youtube|dQw4w9WgXcQ" }],
    [{
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|wrong-video",
    }],
    [{
      sourceUrl: "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
    }],
    [{
      sourceUrl: "https://user:secret@www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
    }],
    [{
      sourceUrl: "https://studio.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
    }],
    [{
      sourceUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
    }],
    [{
      sourceUrl: "https://youtu.be/dQw4w9WgXcQ?v=other-video",
      videoFingerprint: "youtube|/dQw4w9WgXcQ",
    }],
  ])("rejects invalid room source input before fetch: %j", async (input) => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        roomId: "room-1",
        roomToken: "room-token-1",
        shareableLink: "http://localhost:3003/room/room-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createWebsiteRoomFromApi("access-1", "participant-session-1", input),
    ).rejects.toMatchObject({
      code: "INVALID_SOURCE",
      message: "Invalid room source",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gets a room token for existing website rooms from the background API helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ roomToken: "room-token-2" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      connectWebsiteRoomFromApi("room-2", "access-1", "participant-session-1"),
    ).resolves.toEqual({
      roomToken: "room-token-2",
      quota: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:3003/api/rooms/room-2/connect"),
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ participantSessionId: "participant-session-1" }),
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("bounds a connect request so an orphaned admission has a finite commit horizon", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      vi.stubGlobal("fetch", vi.fn((_url: URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }));

      const connecting = connectWebsiteRoomFromApi(
        "room-timeout",
        "access-1",
        "participant-session-1",
      );
      const rejected = expect(connecting).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(ROOM_CONNECT_REQUEST_TIMEOUT_MS);

      await rejected;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { label: "success", ok: true, status: 200 },
    { label: "error", ok: false, status: 503 },
  ])("keeps the connect abort active through a stalled $label response body", async ({ ok, status }) => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      let resolveBody!: (value: unknown) => void;
      const body = new Promise<unknown>((resolve, reject) => {
        resolveBody = resolve;
        const attachAbort = () => {
          requestSignal?.addEventListener("abort", () => reject(new Error("body aborted")));
        };
        queueMicrotask(attachAbort);
      });
      vi.stubGlobal("fetch", vi.fn((_url: URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve({
          ok,
          status,
          json: () => body,
        } as Response);
      }));

      const connecting = connectWebsiteRoomFromApi(
        `room-body-${status}`,
        "access-1",
        "participant-session-1",
      );
      const completed = connecting.then(
        () => "resolved" as const,
        () => "rejected" as const,
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(ROOM_CONNECT_REQUEST_TIMEOUT_MS);
      const abortedBeforeManualBodyResolution = requestSignal?.aborted;
      if (!abortedBeforeManualBodyResolution) {
        resolveBody(
          ok
            ? { roomToken: "room-token-after-body" }
            : { code: "ROOM_DEPARTURE_UNAVAILABLE", message: "Unavailable" },
        );
      }

      await completed;
      expect(abortedBeforeManualBodyResolution).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("binds the prepared participant session into create and connect HTTP bodies", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        roomId: "room-1",
        roomToken: "room-token-1",
        shareableLink: "http://localhost:3003/room/room-1",
      }))
      .mockResolvedValueOnce(Response.json({ roomToken: "room-token-2" }));
    vi.stubGlobal("fetch", fetchMock);

    await createWebsiteRoomFromApi(
      "access-1",
      preparedRoomSession.participantSessionId,
      { clientRequestId: "click-1" },
    );
    await connectWebsiteRoomFromApi(
      "room-2",
      "access-1",
      preparedRoomSession.participantSessionId,
    );

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      clientRequestId: "click-1",
      participantSessionId: "participant-session-1",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      participantSessionId: "participant-session-1",
    });
  });

  it("keeps a structured active-room conflict across the background bridge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "ACTIVE_ROOM_CONFLICT",
      message: "You already have an active watch room.",
      activeRoom: {
        roomId: "room-active",
        role: "host",
        provider: "youtube",
        title: "Current video",
      },
    }), { status: 409 })));

    const response = await handleRoomHttpMessage(
      createRoomHttpMessage("access-1", preparedRoomSession),
      { tab: { id: 5 } },
      { issueAuthority: vi.fn().mockResolvedValue(null) },
    );

    expect(response).toEqual({
      ok: false,
      error: "You already have an active watch room. (409)",
      code: "ACTIVE_ROOM_CONFLICT",
      status: 409,
      activeRoom: {
        roomId: "room-active",
        role: "host",
        provider: "youtube",
        title: "Current video",
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
    await expect(
      createWebsiteRoomFromApi("access-1", "participant-session-1", input),
    ).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
      reused: true,
      quota: { remainingSeconds: 900, resetAt: "2026-06-14T00:00:00.000Z" },
    });
    expect(
      isRoomHttpMessage(createRoomHttpMessage("access-1", preparedRoomSession, input)),
    ).toBe(true);
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

    const response = await handleRoomHttpMessage(
      createRoomHttpMessage("access-1", preparedRoomSession),
    );
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

    const error = await createRoom("access-1", preparedRoomSession).catch((caught) => caught);
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

  });

  it("creates rooms through the extension runtime bridge", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      room: {
        roomId: "room-1",
        roomToken: "room-token-1",
        shareableLink: "http://localhost:3003/room/room-1",
        roomSession: confirmedRoomSession("room-1", preparedRoomSession),
      },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const input = {
      sourceUrl: "https://www.youtube.com/watch?v=abc",
      videoFingerprint: "youtube|abc",
      title: "Video title",
    };

    await expect(createRoom("access-1", preparedRoomSession, input)).resolves.toEqual({
      roomId: "room-1",
      roomToken: "room-token-1",
      shareableLink: "http://localhost:3003/room/room-1",
      roomSession: confirmedRoomSession("room-1", preparedRoomSession),
    });
    expect(sendMessage).toHaveBeenCalledWith(
      createRoomHttpMessage("access-1", preparedRoomSession, input),
    );
  });

  it("returns background-issued host authority only from a successful room response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          roomId: "room-privileged",
          roomToken: trustedRoomToken({
            sub: "user-a",
            roomId: "room-privileged",
            role: "host",
          }),
          shareableLink: "http://localhost:3003/room/room-privileged",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const issueAuthority = vi.fn().mockResolvedValue({
      accountUserId: "user-a",
      roomId: "room-privileged",
      role: "host",
      authorityGeneration: 7,
    });

    const response = await (
      handleRoomHttpMessage as unknown as (
        message: ReturnType<typeof createRoomHttpMessage>,
        sender: { tab: { id: number } },
        dependencies: {
          confirmRoomSession: typeof confirmRoomSession;
          issueAuthority: typeof issueAuthority;
        },
      ) => Promise<unknown>
    )(
      createRoomHttpMessage("access-1", preparedRoomSession),
      { tab: { id: 41 } },
      { confirmRoomSession, issueAuthority },
    );

    expect(response).toMatchObject({
      ok: true,
      room: {
        roomId: "room-privileged",
        privilegedRoomAuthority: {
          accountUserId: "user-a",
          roomId: "room-privileged",
          role: "host",
          authorityGeneration: 7,
        },
      },
    });
  });

  it("does not let a late room bridge response issue authority over a newer join", async () => {
    const firstResponse = deferred<Response>();
    const secondResponse = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(firstResponse.promise).mockReturnValueOnce(secondResponse.promise));
    const issueAuthority = vi.fn(async ({ roomId }: { roomId: string }) => ({
      accountUserId: "user-a",
      roomId,
      role: "host" as const,
      authorityGeneration: roomId === "room-new" ? 2 : 1,
    }));
    const sender = { tab: { id: 42 } };
    const firstPrepared = preparedRoomSessionFor("room-old");
    const secondPrepared = preparedRoomSessionFor("room-new");
    let admissionGeneration = 0;
    const dependencies = {
      admissionFence: new RoomAdmissionFence(),
      confirmRoomSession,
      issueAuthority,
      renewCancelledAdmissionDepartureIntent: async (identity: {
        roomId: string;
        ownerUserId: string;
        participantSessionId: string;
      }) => ({ ...identity, generation: ++admissionGeneration }),
      requestCancelledAdmissionCleanup: async () => true,
      retireCancelledAdmissionIntent: async () => true,
      settleCancelledAdmissionDeparture: async () => "departed" as const,
    };
    const first = handleRoomHttpMessage(
      connectRoomHttpMessage("room-old", "access-1", firstPrepared),
      sender,
      dependencies,
    );
    const second = handleRoomHttpMessage(
      connectRoomHttpMessage("room-new", "access-1", secondPrepared),
      sender,
      dependencies,
    );

    secondResponse.resolve(roomConnectionResponse("room-new"));
    await expect(second).resolves.toMatchObject({
      ok: true,
      connection: { privilegedRoomAuthority: { roomId: "room-new", authorityGeneration: 2 } },
    });
    firstResponse.resolve(roomConnectionResponse("room-old"));
    await expect(first).resolves.toMatchObject({
      ok: false,
      code: "STALE_ROOM_SESSION",
      status: 409,
    });
    expect(issueAuthority).toHaveBeenCalledTimes(1);
  });

  it("connects rooms through the extension runtime bridge", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      connection: {
        roomToken: "room-token-2",
        roomSession: confirmedRoomSession("room-2", preparedRoomSessionFor("room-2")),
      },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    const prepared = preparedRoomSessionFor("room-2");
    await expect(connectWebsiteRoom("room-2", "access-1", prepared)).resolves.toEqual({
      roomToken: "room-token-2",
      roomSession: confirmedRoomSession("room-2", prepared),
    });
    expect(sendMessage).toHaveBeenCalledWith(
      connectRoomHttpMessage("room-2", "access-1", prepared),
    );
  });

  it("returns whether each valid room event was sent, queued, or dropped", () => {
    installControlledWebSocket();
    const client = new RoomClient();
    const event = (sentAt: number) => ({
      type: "PING" as const,
      roomId: "room-1",
      sentAt,
    });

    expect(client.send(event(1))).toBe("dropped");

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: vi.fn(),
    });
    expect(client.send(event(2))).toBe("queued");

    const socket = ControlledWebSocket.instances[0];
    socket?.open();
    expect(
      socket?.sent.slice(0, 2).map((entry) => JSON.parse(entry).type),
    ).toEqual(["JOIN", "PING"]);
    expect(client.send(event(3))).toBe("sent");
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toMatchObject({
      type: "PING",
      sentAt: 3,
    });

    client.close();
    expect(client.send(event(4))).toBe("dropped");
  });

  it("publishes transport readiness once, after delivering the first room snapshot", () => {
    installControlledWebSocket();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const timeline: string[] = [];
    const onTransportReady = vi.fn(
      (ready: { senderConnectionId: string; reconnect: boolean }) => {
        timeline.push(`ready:${ready.senderConnectionId}`);
      },
    );
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      reconnect: true,
      onEvent: (event) => timeline.push(`event:${event.type}`),
      onStatus: vi.fn(),
      onTransportReady,
    });
    const senderConnectionId = client.senderConnectionId;
    const socket = ControlledWebSocket.instances[0];
    socket?.open();
    socket?.message("pong");
    socket?.message({
      type: "PONG",
      roomId: "room-1",
      sentAt: 1,
      serverTime: 2,
    });
    socket?.message("not-json");

    expect(onTransportReady).not.toHaveBeenCalled();
    expect(timeline).toEqual([]);

    socket?.message({ ...roomSnapshot(), p2pResyncRequired: true });

    expect(timeline).toEqual([
      "event:ROOM_SNAPSHOT",
      `ready:${senderConnectionId}`,
    ]);
    expect(onTransportReady).toHaveBeenCalledWith({
      forceMediaResync: true,
      senderConnectionId,
      reconnect: true,
    });

    socket?.message({ ...roomSnapshot(), serverSeq: 2 });
    expect(onTransportReady).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    client.close();
  });

  it("retains only private history authority matching the current room session and generations", () => {
    installControlledWebSocket();
    const authorities: Array<ReturnType<typeof roomHistoryAuthorityPayload> | null> = [];
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      onHistoryAuthority: (authority) => authorities.push(authority),
    });
    const socket = ControlledWebSocket.instances[0];
    socket?.open();

    socket?.message(roomHistoryAuthority());
    expect(authorities).toEqual([]);

    socket?.message(roomSnapshot());
    expect(authorities).toEqual([null]);

    socket?.message({
      ...roomHistoryAuthority(),
      participantSessionId: "other-session",
      attestation: "wrong-session-proof",
    });
    socket?.message({
      ...roomHistoryAuthority(),
      sourceGeneration: 2,
      attestation: "future-proof",
    });
    expect(authorities).toEqual([null]);

    socket?.message(roomHistoryAuthority());
    expect(authorities).toEqual([null, roomHistoryAuthorityPayload()]);

    socket?.message(sourceChanged(2));
    expect(authorities).toEqual([null, roomHistoryAuthorityPayload(), null]);

    socket?.message(roomHistoryAuthority(1, "stale-proof"));
    expect(authorities).toEqual([null, roomHistoryAuthorityPayload(), null]);

    socket?.message(roomHistoryAuthority(2));
    expect(authorities).toEqual([
      null,
      roomHistoryAuthorityPayload(),
      null,
      roomHistoryAuthorityPayload(2),
    ]);
    expect(client.historyAuthority).toEqual(roomHistoryAuthorityPayload(2));
  });

  it("keeps same-tuple authority through reconnect until the replacement proof arrives", () => {
    installControlledWebSocket();
    const authorities: Array<ReturnType<typeof roomHistoryAuthorityPayload> | null> = [];
    const client = new RoomClient();
    const options = (roomToken: string) => ({
      roomId: "room-1",
      roomToken,
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      onHistoryAuthority: (authority: ReturnType<typeof roomHistoryAuthorityPayload> | null) =>
        authorities.push(authority),
    });

    client.connect(options("room-token-1"));
    ControlledWebSocket.instances[0]?.open();
    ControlledWebSocket.instances[0]?.message(roomSnapshot());
    ControlledWebSocket.instances[0]?.message(roomHistoryAuthority());
    expect(client.historyAuthority).toEqual(roomHistoryAuthorityPayload());

    client.connect(options("room-token-2"));
    ControlledWebSocket.instances[1]?.open();
    ControlledWebSocket.instances[1]?.message(roomSnapshot());

    expect(client.historyAuthority).toEqual(roomHistoryAuthorityPayload());
    expect(authorities).toEqual([null, roomHistoryAuthorityPayload()]);

    ControlledWebSocket.instances[1]?.message(roomHistoryAuthority(1, "replacement-proof"));
    expect(client.historyAuthority).toEqual(roomHistoryAuthorityPayload(1, "replacement-proof"));
    expect(authorities.at(-1)).toEqual(roomHistoryAuthorityPayload(1, "replacement-proof"));
  });

  it("does not publish transport readiness for stale or already-closed sockets", () => {
    installControlledWebSocket();
    const firstReady = vi.fn();
    const secondReady = vi.fn();
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      reconnect: false,
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      onTransportReady: firstReady,
    });
    const firstSenderConnectionId = client.senderConnectionId;
    const firstSocket = ControlledWebSocket.instances[0];
    firstSocket?.open();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-2",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      reconnect: true,
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      onTransportReady: secondReady,
    });
    const secondSenderConnectionId = client.senderConnectionId;
    const secondSocket = ControlledWebSocket.instances[1];
    secondSocket?.open();

    expect(secondSenderConnectionId).not.toBe(firstSenderConnectionId);
    firstSocket?.message(roomSnapshot());
    expect(firstReady).not.toHaveBeenCalled();
    expect(secondReady).not.toHaveBeenCalled();

    secondSocket?.close();
    secondSocket?.message(roomSnapshot());
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("does not publish transport readiness when snapshot delivery closes the socket", () => {
    installControlledWebSocket();
    const onTransportReady = vi.fn();
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent: (event) => {
        if (event.type === "ROOM_SNAPSHOT") client.close();
      },
      onStatus: vi.fn(),
      onTransportReady,
    });
    const socket = ControlledWebSocket.instances[0];
    socket?.open();
    socket?.message(roomSnapshot());

    expect(onTransportReady).not.toHaveBeenCalled();
  });

  it("publishes one closed status for explicit close without a replacement transition", () => {
    installControlledWebSocket();
    const statuses: string[] = [];
    const client = new RoomClient();

    client.connect({
      roomId: "room-1",
      roomToken: "room-token-1",
      participant: roomParticipant,
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });
    ControlledWebSocket.instances[0]?.open();

    client.close();
    client.close();

    expect(statuses).toEqual(["connecting", "connected", "closed"]);
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

      send(): void {}

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
        mediaSeat: "none" as const,
        syncStatus: "unknown" as const,
        lastSeenAt: 0,
      },
      participantSessionId: "participant-session-1",
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
        mediaSeat: "none",
        syncStatus: "unknown",
        lastSeenAt: 0,
      },
      participantSessionId: "participant-session-1",
      videoFingerprint: "video-1",
      onEvent,
      onStatus: vi.fn(),
    });

    sockets[0]?.open();
    const firstPing = sockets[0]?.sent[1];

    expect(JSON.parse(sockets[0]?.sent[0] ?? "{}")).toMatchObject({ type: "JOIN" });
    expect(firstPing).toBe("ping");

    sockets[0]?.dispatch("message", { data: "pong" });
    vi.advanceTimersByTime(20_000);

    expect(onEvent).not.toHaveBeenCalled();
    expect(sockets[0]?.sent.at(-1)).toBe("ping");

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

      send(): void {}

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
        mediaSeat: "none",
        syncStatus: "unknown",
        lastSeenAt: 0,
      },
      participantSessionId: "participant-session-1",
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

  it.each([4002, 4003, 4004])(
    "reports terminal close code %s when its ERROR frame is lost",
    (closeCode) => {
      const sockets: FakeWebSocket[] = [];
      class FakeWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readonly listeners = new Map<string, Array<(event: unknown) => void>>();
        readyState = FakeWebSocket.CONNECTING;
        constructor(readonly url: string) { sockets.push(this); }
        addEventListener(type: string, listener: (event: unknown) => void): void {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
        }
        close(): void { this.readyState = FakeWebSocket.CLOSED; }
        send(): void {}
        dispatch(type: string, event: unknown): void {
          for (const listener of this.listeners.get(type) ?? []) listener(event);
        }
      }
      vi.stubGlobal("WebSocket", FakeWebSocket);
      const onTerminalClose = vi.fn();
      const client = new RoomClient();
      client.connect({
        roomId: "room-1",
        roomToken: "token",
        participant: {
          id: "user-1", displayName: "User", role: "viewer", cameraEnabled: false,
          mediaSeat: "none", syncStatus: "unknown", lastSeenAt: 0,
        },
        participantSessionId: "participant-session-1",
        videoFingerprint: "video-1",
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onTerminalClose,
      });

      sockets[0]?.dispatch("close", {
        code: closeCode,
        reason: "Terminal room close",
        wasClean: true,
      });
      expect(onTerminalClose).toHaveBeenCalledWith(closeCode);
    },
  );
});

function trustedRoomToken(payload: Record<string, unknown>): string {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ typ: "room", ...payload }))}.signature`;
}

function roomConnectionResponse(roomId: string): Response {
  return new Response(JSON.stringify({ roomToken: trustedRoomToken({ sub: "user-a", roomId, role: "host" }) }), {
    status: 200,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

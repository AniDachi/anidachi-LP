import type { AccountInboxResponse, MarkAccountInboxSeenRequest } from "@anidachi/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleAccountInboxHttpMessage,
  isAccountInboxHttpMessage,
  listAccountInbox,
  listAccountInboxFromApi,
  listAccountInboxHttpMessage,
  markAccountInboxItemsSeen,
  markAccountInboxItemsSeenFromApi,
  markAccountInboxSeenHttpMessage,
} from "../src/account-inbox-client";

const NOW = "2026-08-09T12:00:00.000Z";
const VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const INVITE_ID = "00000000-0000-4000-8000-000000000002";

afterEach(() => vi.unstubAllGlobals());

describe("account inbox HTTP bridge", () => {
  it("loads and validates the canonical account-owned inbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(inbox()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAccountInboxFromApi("access-1")).resolves.toEqual(inbox());
    const requestUrl = fetchMock.mock.calls.at(0)?.at(0);
    expect(requestUrl).toBeDefined();
    const url = new URL(requestUrl);
    expect(url.pathname).toBe("/api/account/inbox");
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("posts the exact seen item identities and validates the returned inbox", async () => {
    const items: MarkAccountInboxSeenRequest["items"] = [{ kind: "room-invite", id: INVITE_ID }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(inbox()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(markAccountInboxItemsSeenFromApi("access-1", items)).resolves.toEqual(inbox());
    const requestUrl = fetchMock.mock.calls.at(0)?.at(0);
    expect(requestUrl).toBeDefined();
    const url = new URL(requestUrl);
    expect(url.pathname).toBe("/api/account/inbox/seen");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    );
  });

  it("rejects malformed account responses with a safe error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    await expect(listAccountInboxFromApi("access-1")).rejects.toMatchObject({
      code: "INVALID_ACCOUNT_RESPONSE",
      message: "Account data is temporarily unavailable. Try again.",
    });
  });

  it("accepts only complete list and seen runtime messages", () => {
    expect(isAccountInboxHttpMessage(listAccountInboxHttpMessage("access-1"))).toBe(true);
    expect(
      isAccountInboxHttpMessage(
        markAccountInboxSeenHttpMessage("access-1", [{ kind: "room-invite", id: INVITE_ID }]),
      ),
    ).toBe(true);
    expect(
      isAccountInboxHttpMessage({
        type: "ANIDACHI_ACCOUNT_INBOX_HTTP",
        command: "mark-seen",
        accessToken: "access-1",
        items: [],
      }),
    ).toBe(false);
  });

  it("routes list and seen requests through the background handler", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(inbox())));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      handleAccountInboxHttpMessage(listAccountInboxHttpMessage("access-1")),
    ).resolves.toEqual({
      ok: true,
      inbox: inbox(),
    });
    await expect(
      handleAccountInboxHttpMessage(
        markAccountInboxSeenHttpMessage("access-1", [{ kind: "room-invite", id: INVITE_ID }]),
      ),
    ).resolves.toEqual({ ok: true, inbox: inbox() });
  });

  it("exposes typed popup wrappers through chrome.runtime", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, inbox: inbox() })
      .mockResolvedValueOnce({ ok: true, inbox: inbox() });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const items: MarkAccountInboxSeenRequest["items"] = [{ kind: "room-invite", id: INVITE_ID }];

    await expect(listAccountInbox("access-1")).resolves.toEqual(inbox());
    await expect(markAccountInboxItemsSeen("access-1", items)).resolves.toEqual(inbox());
    expect(sendMessage).toHaveBeenNthCalledWith(1, listAccountInboxHttpMessage("access-1"));
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      markAccountInboxSeenHttpMessage("access-1", items),
    );
  });
});

function inbox(): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId: VIEWER_ID },
    items: [],
    counts: {
      unseen: 0,
      actionable: 0,
      activeRoomInvites: 0,
      pendingFriendRequests: 0,
    },
    nextCursor: null,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

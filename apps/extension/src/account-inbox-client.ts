import {
  type AccountInboxResponse,
  AccountInboxResponseSchema,
  type MarkAccountInboxSeenRequest,
  MarkAccountInboxSeenRequestSchema,
} from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { createWebsiteRoomHeaders, RoomApiError } from "./room-client";

const ACCOUNT_INBOX_HTTP_MESSAGE_TYPE = "ANIDACHI_ACCOUNT_INBOX_HTTP";
const INVALID_ACCOUNT_RESPONSE_MESSAGE = "Account data is temporarily unavailable. Try again.";

export type AccountInboxHttpMessage =
  | {
      type: typeof ACCOUNT_INBOX_HTTP_MESSAGE_TYPE;
      command: "list";
      accessToken: string;
    }
  | {
      type: typeof ACCOUNT_INBOX_HTTP_MESSAGE_TYPE;
      command: "mark-seen";
      accessToken: string;
      items: MarkAccountInboxSeenRequest["items"];
    };

export type AccountInboxHttpMessageResponse =
  | { ok: true; inbox: AccountInboxResponse }
  | { ok: false; error: string; code?: string };

export function listAccountInboxHttpMessage(accessToken: string): AccountInboxHttpMessage {
  return {
    type: ACCOUNT_INBOX_HTTP_MESSAGE_TYPE,
    command: "list",
    accessToken,
  };
}

export function markAccountInboxSeenHttpMessage(
  accessToken: string,
  items: MarkAccountInboxSeenRequest["items"],
): AccountInboxHttpMessage {
  return {
    type: ACCOUNT_INBOX_HTTP_MESSAGE_TYPE,
    command: "mark-seen",
    accessToken,
    items,
  };
}

export function isAccountInboxHttpMessage(value: unknown): value is AccountInboxHttpMessage {
  if (!isRecord(value)) return false;
  if (
    value.type !== ACCOUNT_INBOX_HTTP_MESSAGE_TYPE ||
    typeof value.accessToken !== "string" ||
    !value.accessToken.trim()
  ) {
    return false;
  }
  if (value.command === "list") return true;
  if (value.command !== "mark-seen") return false;
  return MarkAccountInboxSeenRequestSchema.safeParse({ items: value.items }).success;
}

export async function listAccountInboxFromApi(accessToken: string): Promise<AccountInboxResponse> {
  const url = new URL("/api/account/inbox", WEB_HTTP_BASE);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: createWebsiteRoomHeaders(accessToken),
  });
  if (!response.ok) throw await accountInboxHttpError(response, "Failed to load inbox");
  return parseAccountInboxResponse(await decodeAccountInboxResponse(response));
}

export async function markAccountInboxItemsSeenFromApi(
  accessToken: string,
  items: MarkAccountInboxSeenRequest["items"],
): Promise<AccountInboxResponse> {
  const payload = MarkAccountInboxSeenRequestSchema.parse({ items });
  const url = new URL("/api/account/inbox/seen", WEB_HTTP_BASE);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await accountInboxHttpError(response, "Failed to update inbox");
  return parseAccountInboxResponse(await decodeAccountInboxResponse(response));
}

export async function handleAccountInboxHttpMessage(
  message: AccountInboxHttpMessage,
): Promise<AccountInboxHttpMessageResponse> {
  try {
    const inbox =
      message.command === "list"
        ? await listAccountInboxFromApi(message.accessToken)
        : await markAccountInboxItemsSeenFromApi(message.accessToken, message.items);
    return { ok: true, inbox };
  } catch (error) {
    if (error instanceof RoomApiError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Inbox request failed",
    };
  }
}

export async function listAccountInbox(accessToken: string): Promise<AccountInboxResponse> {
  return accountInboxFromBridge(
    await chrome.runtime.sendMessage(listAccountInboxHttpMessage(accessToken)),
  );
}

export async function markAccountInboxItemsSeen(
  accessToken: string,
  items: MarkAccountInboxSeenRequest["items"],
): Promise<AccountInboxResponse> {
  return accountInboxFromBridge(
    await chrome.runtime.sendMessage(markAccountInboxSeenHttpMessage(accessToken, items)),
  );
}

function accountInboxFromBridge(value: unknown): AccountInboxResponse {
  if (!isRecord(value)) throw new Error("Inbox bridge did not return a response");
  if (value.ok !== true) {
    throw new RoomApiError(
      typeof value.error === "string" ? value.error : "Inbox request failed",
      typeof value.code === "string" ? value.code : undefined,
    );
  }
  return parseAccountInboxResponse(value.inbox);
}

function parseAccountInboxResponse(value: unknown): AccountInboxResponse {
  const result = AccountInboxResponseSchema.safeParse(value);
  if (result.success) return result.data;

  logDebug("account.inbox", "invalid account response", {
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
    })),
  });
  throw new RoomApiError(INVALID_ACCOUNT_RESPONSE_MESSAGE, "INVALID_ACCOUNT_RESPONSE");
}

async function decodeAccountInboxResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RoomApiError(INVALID_ACCOUNT_RESPONSE_MESSAGE, "INVALID_ACCOUNT_RESPONSE");
  }
}

async function accountInboxHttpError(response: Response, fallback: string): Promise<RoomApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    message?: unknown;
  } | null;
  const detail =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.code === "string" && body.code) ||
    fallback;
  return new RoomApiError(
    `${detail} (${response.status})`,
    typeof body?.code === "string" ? body.code : undefined,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

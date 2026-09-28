import { HOST_SUBSCRIPTION_REQUIRED, ROOM_QUOTA_OWNER_HEADER, RoomQuotaStatusSchema, type RoomQuotaStatus } from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import { getStoredAuthTokens, isSameExtensionAuthSession } from "./auth-tokens";
import { refreshExtensionSession } from "./auth-client";

const TYPE = "ANIDACHI_ROOM_QUOTA_STATUS";
type Message = { type: typeof TYPE; ownerUserId: string; accessToken: string };
export class HostingQuotaRetiredError extends Error {
  readonly code = HOST_SUBSCRIPTION_REQUIRED;
  constructor() { super("Free hosting quota is no longer available"); }
}

export function isRoomQuotaStatusMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return m.type === TYPE && typeof m.ownerUserId === "string" && m.ownerUserId.length > 0 &&
    typeof m.accessToken === "string" && m.accessToken.length > 0;
}

export async function handleRoomQuotaStatusMessage(message: Message, deps = {
  getSession: getStoredAuthTokens,
  refresh: refreshExtensionSession,
}) {
  const controller = new AbortController();
  const failure = { ok: false as const };
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<typeof failure>(resolve => {
    timeout = setTimeout(() => { controller.abort(); resolve(failure); }, 10_000);
  });
  const load = async () => {
    try {
      let session = await deps.getSession();
      if (session?.user.id !== message.ownerUserId || controller.signal.aborted) return failure;
      const get = (token: string) => fetch(new URL("/api/me/room-quota", WEB_HTTP_BASE), {
        headers: { Authorization: `Bearer ${token}`, [ROOM_QUOTA_OWNER_HEADER]: message.ownerUserId },
        credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      let response = await get(session.accessToken);
      if (response.status === 401) {
        if (!isSameExtensionAuthSession(session, await deps.getSession()) || controller.signal.aborted) return failure;
        session = await deps.refresh();
        if (session?.user.id !== message.ownerUserId || controller.signal.aborted) return failure;
        response = await get(session.accessToken);
      }
      if (controller.signal.aborted) return failure;
      if (response.status === 403) {
        const body = await response.json();
        if (body?.code !== HOST_SUBSCRIPTION_REQUIRED || !isSameExtensionAuthSession(session, await deps.getSession()) || controller.signal.aborted) return failure;
        return { ok: false as const, code: HOST_SUBSCRIPTION_REQUIRED, ownerUserId: message.ownerUserId };
      }
      if (response.status !== 200) return failure;
      const status = RoomQuotaStatusSchema.parse(await response.json());
      if (status.ownerUserId !== message.ownerUserId || !isSameExtensionAuthSession(session, await deps.getSession()) || controller.signal.aborted) return failure;
      return { ok: true as const, status };
    } catch {
      return failure;
    }
  };
  return Promise.race([load(), deadline]).finally(() => clearTimeout(timeout));
}

export async function requestRoomQuotaStatus(ownerUserId: string, accessToken: string): Promise<RoomQuotaStatus> {
  const response = await chrome.runtime.sendMessage({ type: TYPE, ownerUserId, accessToken });
  if (response?.ok === false && response.code === HOST_SUBSCRIPTION_REQUIRED && response.ownerUserId === ownerUserId) {
    throw new HostingQuotaRetiredError();
  }
  if (!response?.ok) throw new Error("Quota status unavailable");
  const status = RoomQuotaStatusSchema.parse(response.status);
  if (status.ownerUserId !== ownerUserId) throw new Error("Quota owner changed");
  return status;
}

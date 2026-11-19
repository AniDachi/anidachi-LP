import {
  mediaAccessChannel, mediaOwnerChannel, permissionPage, tilePage,
  type OwnerAccess, type PrimeMediaScope,
} from "./prime-media-access";
import {getStoredAuthTokens} from "./auth-tokens";
import { loadRoomSessionForTab } from "./room-session-storage";
import {isAttachedPrimePlayerDocument} from "./prime-room-background";
import { isPrimeBrowsingSender, isPrimePlayerPageSender, isPrimeRoomBrowsingPage, parsePrimePageUrl } from "./source-adapters/primevideo/url";

export function installPrimeMediaBackground() {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.channel !== mediaAccessChannel || sender.id !== chrome.runtime.id ||
        (sender.documentLifecycle && sender.documentLifecycle !== "active")) return;
    void handle(message, sender).then(reply, () => reply(null));
    return true;
  });
}

function owner(scope: PrimeMediaScope, request: OwnerAccess) {
  return chrome.runtime.sendMessage({ channel: mediaOwnerChannel, scope, request });
}

async function confirmed(tabId: number, documentId?: string): Promise<PrimeMediaScope | null> {
  const [room, tab, auth] = await Promise.all([loadRoomSessionForTab(tabId), chrome.tabs.get(tabId), getStoredAuthTokens()]);
  if (!room || room.ownerUserId !== auth?.user.id || !tab.url) return null;
  if (!isPrimeRoomBrowsingPage(tab.url) &&
      (!parsePrimePageUrl(tab.url) || !await isAttachedPrimePlayerDocument(tab, room, documentId))) return null;
  return {tabId, roomId: room.roomId, participantSessionId: room.participantSessionId};
}

interface AccessRequest {
  action: "ticket" | "redeem" | "open" | "close" | "permission" | "settle";
  participantId?: string;
  ticket?: string;
  roomTabId?: number;
  allowed?: boolean;
  permissionTabId?: number;
}

async function handle(request: AccessRequest, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  const senderPage = sender.url?.split(/[?#]/)[0];
  if (request.action === "ticket") {
    if (tabId === undefined || !sender.documentId || (!isPrimeBrowsingSender(sender) && !isPrimePlayerPageSender(sender)) ||
        typeof request.participantId !== "string") return null;
    const scope = await confirmed(tabId, sender.documentId);
    return scope && owner(scope, {action: "ticket", participantId: request.participantId});
  }
  const ticket = request.ticket;
  if (typeof ticket !== "string" || !/^[a-f\d-]{36}$/i.test(ticket)) return null;
  if (request.action === "redeem") {
    if (tabId === undefined || !sender.frameId || senderPage !== chrome.runtime.getURL(tilePage)) return null;
    const scope = await confirmed(tabId);
    return scope && owner(scope, {action: "redeem", ticket});
  }
  const roomTabId = request.roomTabId;
  if (typeof roomTabId !== "number" || !Number.isInteger(roomTabId)) return null;
  const hash = new URLSearchParams({ roomTabId: String(roomTabId), ticket });
  const url = chrome.runtime.getURL(permissionPage) + "#" + hash;
  if (request.action === "close") {
    if (sender.tab || senderPage !== chrome.runtime.getURL("prime-room.html") || typeof request.permissionTabId !== "number") return null;
    const tab = await chrome.tabs.get(request.permissionTabId);
    if (tab.url === url || tab.pendingUrl === url) await chrome.tabs.remove(request.permissionTabId);
    return null;
  }
  const scope = await confirmed(roomTabId);
  if (!scope) return null;
  if (request.action === "open") {
    if (sender.tab || senderPage !== chrome.runtime.getURL("prime-room.html")) return null;
    if (!await owner(scope, {action: "permission", ticket})) return null;
    const tab = await chrome.tabs.create({ url, openerTabId: roomTabId, active: true });
    return tab.id;
  }
  if (tabId === undefined || sender.frameId !== 0 || sender.tab?.openerTabId !== roomTabId || sender.url !== url || sender.tab.url !== url) return null;
  if (request.action === "permission") return owner(scope, {action: "permission", ticket});
  if (request.action === "settle") return owner(scope, {action: "settle", ticket, allowed: request.allowed === true});
  return null;
}

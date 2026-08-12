import {
  type AccountInboxResponse,
  AccountInboxResponseSchema,
  type MarkAccountInboxSeenRequest,
} from "@anidachi/protocol";

export function parseOwnedAccountInboxResponse(
  value: unknown,
  ownerUserId: string,
): AccountInboxResponse {
  const inbox = AccountInboxResponseSchema.parse(value);
  if (inbox.meta.ownerUserId !== ownerUserId) {
    throw new Error("Account inbox response belongs to another account");
  }
  return inbox;
}

export function accountInboxSeenItems(
  inbox: AccountInboxResponse,
): MarkAccountInboxSeenRequest["items"] {
  return inbox.items
    .filter((item) => item.seenAt === null)
    .map((item) => ({
      kind: item.kind,
      id: item.kind === "room-invite" ? item.inviteId : item.friendshipId,
    }));
}

export function applyAccountInboxSeenAcknowledgement(
  page: AccountInboxResponse,
  acknowledgement: AccountInboxResponse,
): AccountInboxResponse {
  if (page.meta.ownerUserId !== acknowledgement.meta.ownerUserId) {
    throw new Error("Account inbox response belongs to another account");
  }
  const acknowledgedKeys = new Set(
    accountInboxSeenItems(page).map((item) => `${item.kind}:${item.id}`),
  );
  return {
    ...page,
    meta: acknowledgement.meta,
    counts: acknowledgement.counts,
    items: page.items.map((item) => {
      const id = item.kind === "room-invite" ? item.inviteId : item.friendshipId;
      return acknowledgedKeys.has(`${item.kind}:${id}`)
        ? { ...item, seenAt: acknowledgement.meta.serverTime }
        : item;
    }),
  };
}

export function appendAccountInboxPage(
  current: AccountInboxResponse,
  page: AccountInboxResponse,
): AccountInboxResponse {
  if (current.meta.ownerUserId !== page.meta.ownerUserId) {
    throw new Error("Account inbox response belongs to another account");
  }
  const seenKeys = new Set(current.items.map(accountInboxItemKey));
  return {
    meta: page.meta,
    items: [
      ...current.items,
      ...page.items.filter((item) => !seenKeys.has(accountInboxItemKey(item))),
    ],
    counts: page.counts,
    nextCursor: page.nextCursor,
  };
}

function accountInboxItemKey(item: AccountInboxResponse["items"][number]): string {
  return item.kind === "room-invite"
    ? `room-invite:${item.inviteId}`
    : `friend-request:${item.friendshipId}`;
}

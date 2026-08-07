import type { FriendGroup, FriendListItem, RecentPerson, SocialDirectory } from "@anidachi/protocol";

export type PopupPeopleModel = Readonly<{
  friends: readonly FriendListItem[];
  incomingRequestUserIds: ReadonlySet<string>;
  outgoingRequestUserIds: ReadonlySet<string>;
  groups: readonly FriendGroup[];
  recentPeople: readonly RecentPerson[];
}>;

/**
 * Keeps canonical server order while preventing stale or duplicate rows from
 * creating contradictory Popup actions.
 */
export function buildPopupPeopleModel(directory: SocialDirectory): PopupPeopleModel {
  const friends = uniqueById(
    directory.friends.filter((friend) => friend.status === "accepted"),
    (friend) => friend.user.userId,
  );
  const incomingRequestUserIds = uniqueIdSet(directory.incomingRequests.map((request) => request.user.userId));
  const outgoingRequestUserIds = uniqueIdSet(directory.outgoingRequests.map((request) => request.user.userId));
  const groups = uniqueById(
    directory.groups.filter((group) => group.archivedAt === null),
    (group) => group.id,
  );
  const knownRelationshipUserIds = new Set<string>([
    ...friends.map((friend) => friend.user.userId),
    ...incomingRequestUserIds,
    ...outgoingRequestUserIds,
  ]);
  const recentPeople = uniqueById(
    directory.recentPeople.filter((person) => !knownRelationshipUserIds.has(person.user.userId)),
    (person) => person.user.userId,
  );

  return Object.freeze({
    friends,
    incomingRequestUserIds,
    outgoingRequestUserIds,
    groups,
    recentPeople,
  });
}

function uniqueById<T>(items: readonly T[], getId: (item: T) => string): readonly T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const id = getId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
  }
  return Object.freeze(unique);
}

function uniqueIdSet(ids: readonly string[]): ReadonlySet<string> {
  return Object.freeze(new Set(ids));
}

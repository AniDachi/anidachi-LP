import type {
  FriendGroup,
  FriendListItem,
  PublicProfile,
  RecentPerson,
  SocialDirectory,
} from "@anidachi/protocol";

export type PopupPeopleProfile = Readonly<PublicProfile>;

export type PopupPeopleFriend = Readonly<
  Omit<FriendListItem, "user"> & {
    user: PopupPeopleProfile;
  }
>;

export type PopupPeopleGroupMember = Readonly<{
  user: PopupPeopleProfile;
  addedAt: string;
}>;

export type PopupPeopleGroup = Readonly<
  Omit<FriendGroup, "members"> & {
    members: readonly PopupPeopleGroupMember[];
  }
>;

export type PopupPeopleRecentPerson = Readonly<
  Omit<RecentPerson, "user"> & {
    user: PopupPeopleProfile;
  }
>;

export type PopupPeopleIdSet = Readonly<{
  size: number;
  has(value: string): boolean;
  entries(): SetIterator<[string, string]>;
  keys(): SetIterator<string>;
  values(): SetIterator<string>;
  forEach(
    callback: (value: string, value2: string, set: PopupPeopleIdSet) => void,
    thisArg?: unknown,
  ): void;
  [Symbol.iterator](): SetIterator<string>;
}>;

export type PopupPeopleModel = Readonly<{
  friends: readonly PopupPeopleFriend[];
  incomingRequestUserIds: PopupPeopleIdSet;
  outgoingRequestUserIds: PopupPeopleIdSet;
  groups: readonly PopupPeopleGroup[];
  recentPeople: readonly PopupPeopleRecentPerson[];
}>;

/**
 * Keeps canonical server order while preventing stale or duplicate rows from
 * creating contradictory Popup actions.
 */
export function buildPopupPeopleModel(directory: SocialDirectory): PopupPeopleModel {
  const friendRows = uniqueById(
    directory.friends.filter((friend) => friend.status === "accepted"),
    (friend) => friend.user.userId,
  );
  const incomingRequestIds = uniqueIds(directory.incomingRequests.map((request) => request.user.userId));
  const outgoingRequestIds = uniqueIds(directory.outgoingRequests.map((request) => request.user.userId));
  const groupRows = uniqueById(
    directory.groups.filter((group) => group.archivedAt === null),
    (group) => group.id,
  );
  const knownRelationshipUserIds = new Set<string>([
    ...directory.friends.map((friend) => friend.user.userId),
    ...incomingRequestIds,
    ...outgoingRequestIds,
  ]);
  const recentRows = uniqueById(
    directory.recentPeople.filter((person) => !knownRelationshipUserIds.has(person.user.userId)),
    (person) => person.user.userId,
  );

  return Object.freeze({
    friends: frozenArray(friendRows.map(cloneFriend)),
    incomingRequestUserIds: new ImmutableIdSet(incomingRequestIds),
    outgoingRequestUserIds: new ImmutableIdSet(outgoingRequestIds),
    groups: frozenArray(groupRows.map(cloneGroup)),
    recentPeople: frozenArray(recentRows.map(cloneRecentPerson)),
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
  return unique;
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}

function cloneProfile(profile: PublicProfile): PopupPeopleProfile {
  return Object.freeze({ ...profile });
}

function cloneFriend(friend: FriendListItem): PopupPeopleFriend {
  return Object.freeze({ ...friend, user: cloneProfile(friend.user) });
}

function cloneGroup(group: FriendGroup): PopupPeopleGroup {
  return Object.freeze({
    ...group,
    members: frozenArray(
      group.members.map((member) =>
        Object.freeze({
          ...member,
          user: cloneProfile(member.user),
        }),
      ),
    ),
  });
}

function cloneRecentPerson(person: RecentPerson): PopupPeopleRecentPerson {
  return Object.freeze({ ...person, user: cloneProfile(person.user) });
}

function frozenArray<T>(items: T[]): readonly T[] {
  return Object.freeze(items);
}

class ImmutableIdSet implements PopupPeopleIdSet {
  readonly #values: Set<string>;
  readonly [Symbol.toStringTag] = "Set";

  constructor(values: readonly string[]) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: string): boolean {
    return this.#values.has(value);
  }

  entries(): SetIterator<[string, string]> {
    return this.#values.entries();
  }

  keys(): SetIterator<string> {
    return this.#values.keys();
  }

  values(): SetIterator<string> {
    return this.#values.values();
  }

  forEach(
    callback: (value: string, value2: string, set: PopupPeopleIdSet) => void,
    thisArg?: unknown,
  ): void {
    this.#values.forEach((value) => callback.call(thisArg, value, value, this));
  }

  [Symbol.iterator](): SetIterator<string> {
    return this.#values[Symbol.iterator]();
  }
}

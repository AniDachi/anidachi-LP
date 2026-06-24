"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Copy,
  EyeOff,
  Link2,
  Pencil,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "@/lib/client-api";

type CurrentUser = {
  userId: string;
  displayName: string;
  email: string;
  plan: string;
};

type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type FriendListItem = {
  friendshipId: string;
  user: PublicProfile;
  status: string;
  direction: string;
  requestedAt: string;
  respondedAt: string | null;
  updatedAt: string;
};

type FriendGroup = {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    user: PublicProfile;
    addedAt: string;
  }>;
};

type RecentPerson = {
  user: PublicProfile;
  lastWatchedAt: string;
  sharedRoomCount: number;
  relationshipStatus: string;
};

type FriendsResponse = {
  friends: FriendListItem[];
  incomingRequests: FriendListItem[];
  outgoingRequests: FriendListItem[];
  blocked: FriendListItem[];
};

type GroupsResponse = {
  groups: FriendGroup[];
};

type RecentPeopleResponse = {
  people: RecentPerson[];
};

type FriendInviteLinkResponse = {
  inviteLink: {
    token: string;
    url: string;
    expiresAt: string;
  };
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

type RefreshOptions = {
  showLoading?: boolean;
};

const EMPTY_FRIENDS: FriendsResponse = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blocked: [],
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function Avatar({ user }: { user: PublicProfile }) {
  if (user.avatarUrl) {
    return (
      <img
        alt=""
        className="h-10 w-10 rounded-full object-cover"
        src={user.avatarUrl}
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-foreground">
      {initials(user.displayName)}
    </span>
  );
}

function formatRecentMeta(person: RecentPerson) {
  const roomLabel =
    person.sharedRoomCount === 1 ? "1 shared room" : `${person.sharedRoomCount} shared rooms`;
  const date = new Date(person.lastWatchedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? "recently"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${roomLabel} · ${dateLabel}`;
}

function sortGroupMembers(members: FriendGroup["members"]): FriendGroup["members"] {
  return [...members].sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
}

function addOptimisticMember(
  group: FriendGroup,
  friend: FriendListItem,
  addedAt: string,
): FriendGroup {
  if (group.members.some((member) => member.user.userId === friend.user.userId)) {
    return group;
  }

  return {
    ...group,
    updatedAt: addedAt,
    members: sortGroupMembers([
      ...group.members,
      {
        user: friend.user,
        addedAt,
      },
    ]),
  };
}

function removeOptimisticMember(group: FriendGroup, userId: string, updatedAt: string): FriendGroup {
  return {
    ...group,
    updatedAt,
    members: group.members.filter((member) => member.user.userId !== userId),
  };
}

function canRequestFromRecent(status: string) {
  return status === "none" || status === "declined" || status === "removed";
}

function recentStatusLabel(status: string) {
  if (status === "accepted") return "Friends";
  if (status === "pending") return "Pending";
  if (status === "blocked") return "Blocked";
  return "";
}

function PersonRow({
  action,
  meta,
  user,
}: {
  action?: ReactNode;
  meta?: string;
  user: PublicProfile;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-brand-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
          <p className="truncate text-xs text-foreground/50">
            {user.handle ? `@${user.handle}` : meta ?? "AniDachi user"}
          </p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

function IconButton({
  children,
  disabled,
  icon,
  onClick,
  title,
  tone = "default",
  type = "button",
}: {
  children?: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onClick?: () => void;
  title: string;
  tone?: "default" | "danger" | "primary";
  type?: "button" | "submit";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-brand-orange text-foreground hover:bg-brand-orange-deep"
      : tone === "danger"
        ? "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-brand-border bg-brand-surface text-foreground/90 hover:bg-brand-orange";

  return (
    <button
      aria-label={title}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type={type}
    >
      {icon}
      {children ? <span className="hidden sm:inline">{children}</span> : null}
    </button>
  );
}

export function FriendsClient({ currentUser }: { currentUser: CurrentUser }) {
  const [friendsData, setFriendsData] = useState<FriendsResponse>(EMPTY_FRIENDS);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [recentPeople, setRecentPeople] = useState<RecentPerson[]>([]);
  const [groupName, setGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const activeGroups = useMemo(
    () => groups.filter((group) => !group.archivedAt),
    [groups],
  );

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    const showLoading = options.showLoading ?? true;
    if (showLoading) setLoading(true);
    try {
      const [friends, groupPayload, recentPayload] = await Promise.all([
        api<FriendsResponse>("/api/friends"),
        api<GroupsResponse>("/api/groups"),
        api<RecentPeopleResponse>("/api/recent-people"),
      ]);
      setFriendsData(friends);
      setGroups(groupPayload.groups);
      setRecentPeople(recentPayload.people);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load friends",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>, success: string) => {
      setBusyKey(key);
      setNotice(null);
      try {
        await action();
        setNotice({ tone: "success", text: success });
        await refresh({ showLoading: false });
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Action failed",
        });
      } finally {
        setBusyKey(null);
      }
    },
    [refresh],
  );

  const runLocalAction = useCallback(
    async (key: string, action: () => Promise<void>, success: string) => {
      setBusyKey(key);
      setNotice(null);
      try {
        await action();
        setNotice({ tone: "success", text: success });
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Action failed",
        });
      } finally {
        setBusyKey(null);
      }
    },
    [],
  );

  const upsertGroup = useCallback((group: FriendGroup) => {
    setGroups((current) => {
      const exists = current.some((item) => item.id === group.id);
      if (!exists) return [group, ...current];
      return current.map((item) => (item.id === group.id ? group : item));
    });
  }, []);

  const patchGroup = useCallback((groupId: string, updater: (group: FriendGroup) => FriendGroup) => {
    let previous: FriendGroup | null = null;
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;
        previous = group;
        return updater(group);
      }),
    );
    return previous;
  }, []);

  const createGroup = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = groupName.trim();
      if (!name) return;
      await runLocalAction(
        "create-group",
        async () => {
          const payload = await api<{ group: FriendGroup }>("/api/groups", {
            body: JSON.stringify({ name }),
            method: "POST",
          });
          upsertGroup(payload.group);
          setGroupName("");
        },
        "Group created.",
      );
    },
    [groupName, runLocalAction, upsertGroup],
  );

  const copyFriendInviteLink = useCallback(async () => {
    await runAction(
      "copy-invite-link",
      async () => {
        const payload = await api<FriendInviteLinkResponse>("/api/friends/invite-links", {
          method: "POST",
        });
        await navigator.clipboard.writeText(payload.inviteLink.url);
      },
      "Friend invite link copied.",
    );
  }, [runAction]);

  const sendFriendRequest = useCallback(
    async (userId: string) => {
      await runAction(
        `send-request:${userId}`,
        () =>
          api("/api/friends/requests", {
            body: JSON.stringify({ userId }),
            method: "POST",
          }),
        "Friend request sent.",
      );
    },
    [runAction],
  );

  const hideRecent = useCallback(
    async (userId: string) => {
      await runAction(
        `hide-recent:${userId}`,
        () =>
          api(`/api/recent-people/${userId}/hide`, {
            method: "POST",
          }),
        "Person hidden.",
      );
    },
    [runAction],
  );

  const friendOptionsForGroup = useCallback(
    (group: FriendGroup) => {
      const memberIds = new Set(group.members.map((member) => member.user.userId));
      return friendsData.friends.filter((friend) => !memberIds.has(friend.user.userId));
    },
    [friendsData.friends],
  );

  const startRenameGroup = useCallback((group: FriendGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }, []);

  const renameGroup = useCallback(
    async (event: FormEvent<HTMLFormElement>, groupId: string) => {
      event.preventDefault();
      const name = editingGroupName.trim();
      if (!name) return;
      await runLocalAction(
        `rename-group:${groupId}`,
        async () => {
          const updatedAt = new Date().toISOString();
          const previous = patchGroup(groupId, (group) => ({
            ...group,
            name,
            updatedAt,
          }));
          try {
            const payload = await api<{ group: FriendGroup }>(`/api/groups/${groupId}`, {
              body: JSON.stringify({ name }),
              method: "PATCH",
            });
            upsertGroup(payload.group);
            setEditingGroupId(null);
            setEditingGroupName("");
          } catch (error) {
            if (previous) upsertGroup(previous);
            throw error;
          }
        },
        "Group renamed.",
      );
    },
    [editingGroupName, patchGroup, runLocalAction, upsertGroup],
  );

  return (
    <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 border-b border-brand-border pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-orange">
              AniDachi
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Friends
            </h1>
            <p className="mt-2 text-sm text-foreground/50">
              {currentUser.displayName} · {currentUser.email}
            </p>
          </div>
          <IconButton
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            onClick={() => void refresh()}
            title="Refresh"
          >
            Refresh
          </IconButton>
        </header>

        {notice ? (
          <div
            className={`fixed right-4 top-4 z-50 max-w-[min(24rem,calc(100vw-2rem))] rounded-lg border px-4 py-3 text-sm shadow-2xl ${
              notice.tone === "success"
                ? "border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
            role="status"
          >
            {notice.text}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
                  <Link2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">Friend invite link</h2>
                  <p className="text-sm text-foreground/50">
                    Copy a private one-time link to add someone after sign-in.
                  </p>
                </div>
              </div>
              <IconButton
                disabled={busyKey !== null}
                icon={<Copy className="h-4 w-4" aria-hidden />}
                onClick={() => void copyFriendInviteLink()}
                title="Copy friend invite link"
                tone="primary"
              >
                Copy link
              </IconButton>
            </div>
          </div>

          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Watched together</h2>
                <p className="mt-1 text-sm text-foreground/50">
                  Add people from recent shared rooms.
                </p>
              </div>
              <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs text-foreground/70">
                {recentPeople.length}
              </span>
            </div>
            <div className="mt-3">
              {loading ? (
                <p className="py-4 text-sm text-foreground/50">Loading...</p>
              ) : recentPeople.length ? (
                recentPeople.slice(0, 5).map((person) => {
                  const statusLabel = recentStatusLabel(person.relationshipStatus);
                  return (
                    <PersonRow
                      action={
                        <>
                          {canRequestFromRecent(person.relationshipStatus) ? (
                            <IconButton
                              disabled={busyKey !== null}
                              icon={<UserPlus className="h-4 w-4" aria-hidden />}
                              onClick={() => void sendFriendRequest(person.user.userId)}
                              title="Add friend"
                              tone="primary"
                            />
                          ) : statusLabel ? (
                            <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-foreground/70">
                              {statusLabel}
                            </span>
                          ) : null}
                          <IconButton
                            disabled={busyKey !== null}
                            icon={<EyeOff className="h-4 w-4" aria-hidden />}
                            onClick={() => void hideRecent(person.user.userId)}
                            title="Hide from recent"
                          />
                        </>
                      }
                      key={person.user.userId}
                      meta={formatRecentMeta(person)}
                      user={person.user}
                    />
                  );
                })
              ) : (
                <p className="py-4 text-sm text-foreground/50">No shared watch history yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Incoming</h2>
              <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs text-foreground/70">
                {friendsData.incomingRequests.length}
              </span>
            </div>
            <div className="mt-3">
              {loading ? (
                <p className="py-4 text-sm text-foreground/50">Loading...</p>
              ) : friendsData.incomingRequests.length ? (
                friendsData.incomingRequests.map((request) => (
                  <PersonRow
                    action={
                      <>
                        <IconButton
                          disabled={busyKey !== null}
                          icon={<Check className="h-4 w-4" aria-hidden />}
                          onClick={() =>
                            void runAction(
                              `accept:${request.friendshipId}`,
                              () =>
                                api(`/api/friends/requests/${request.friendshipId}/accept`, {
                                  method: "POST",
                                }),
                              "Friend request accepted.",
                            )
                          }
                          title="Accept request"
                          tone="primary"
                        />
                        <IconButton
                          disabled={busyKey !== null}
                          icon={<X className="h-4 w-4" aria-hidden />}
                          onClick={() =>
                            void runAction(
                              `decline:${request.friendshipId}`,
                              () =>
                                api(`/api/friends/requests/${request.friendshipId}/decline`, {
                                  method: "POST",
                                }),
                              "Friend request declined.",
                            )
                          }
                          title="Decline request"
                        />
                      </>
                    }
                    key={request.friendshipId}
                    user={request.user}
                  />
                ))
              ) : (
                <p className="py-4 text-sm text-foreground/50">No incoming requests.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Friends</h2>
              <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs text-foreground/70">
                {friendsData.friends.length}
              </span>
            </div>
            <div className="mt-3">
              {loading ? (
                <p className="py-4 text-sm text-foreground/50">Loading...</p>
              ) : friendsData.friends.length ? (
                friendsData.friends.map((friend) => (
                  <PersonRow
                    action={
                      <IconButton
                        disabled={busyKey !== null}
                        icon={<UserMinus className="h-4 w-4" aria-hidden />}
                        onClick={() =>
                          void runAction(
                            `remove:${friend.user.userId}`,
                            () =>
                              api(`/api/friends/${friend.user.userId}`, {
                                method: "DELETE",
                              }),
                            "Friend removed.",
                          )
                        }
                        title="Remove friend"
                        tone="danger"
                      />
                    }
                    key={friend.friendshipId}
                    user={friend.user}
                  />
                ))
              ) : (
                <p className="py-4 text-sm text-foreground/50">No friends yet.</p>
              )}
            </div>
          </div>
        </section>

        <section id="groups" className="rounded-lg border border-brand-border bg-brand-surface p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Groups</h2>
              <p className="mt-1 text-sm text-foreground/50">
                {activeGroups.length} active · {friendsData.friends.length} friends available
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createGroup}>
              <input
                className="min-h-11 min-w-0 rounded-lg border border-brand-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-foreground/30 focus:border-brand-orange sm:w-64"
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                value={groupName}
              />
              <IconButton
                disabled={!groupName.trim() || busyKey === "create-group"}
                icon={<UserPlus className="h-4 w-4" aria-hidden />}
                title="Create group"
                tone="primary"
                type="submit"
              >
                Create
              </IconButton>
            </form>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {loading ? (
              <p className="text-sm text-foreground/50">Loading...</p>
            ) : activeGroups.length ? (
              activeGroups.map((group) => {
                const addableFriends = friendOptionsForGroup(group);
                return (
                  <div
                    className="rounded-lg border border-brand-border bg-brand-surface/60 p-4"
                    key={group.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {editingGroupId === group.id ? (
                        <form
                          className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
                          onSubmit={(event) => void renameGroup(event, group.id)}
                        >
                          <input
                            className="min-h-10 min-w-0 flex-1 rounded-lg border border-brand-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-foreground/30 focus:border-brand-orange"
                            maxLength={80}
                            onChange={(event) => setEditingGroupName(event.target.value)}
                            value={editingGroupName}
                          />
                          <IconButton
                            disabled={!editingGroupName.trim() || busyKey !== null}
                            icon={<Check className="h-4 w-4" aria-hidden />}
                            title="Save group name"
                            tone="primary"
                            type="submit"
                          />
                          <IconButton
                            disabled={busyKey !== null}
                            icon={<X className="h-4 w-4" aria-hidden />}
                            onClick={() => {
                              setEditingGroupId(null);
                              setEditingGroupName("");
                            }}
                            title="Cancel rename"
                          />
                        </form>
                      ) : (
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-foreground">
                            {group.name}
                          </h3>
                          <p className="text-xs text-foreground/50">
                            {group.members.length} members
                          </p>
                        </div>
                      )}
                      {editingGroupId !== group.id ? (
                        <IconButton
                          disabled={busyKey !== null}
                          icon={<Pencil className="h-4 w-4" aria-hidden />}
                          onClick={() => startRenameGroup(group)}
                          title="Rename group"
                        />
                      ) : null}
                      <IconButton
                        disabled={busyKey !== null}
                        icon={<Trash2 className="h-4 w-4" aria-hidden />}
                        onClick={() =>
                          void runLocalAction(
                            `archive-group:${group.id}`,
                            async () => {
                              let previousGroups: FriendGroup[] = [];
                              setGroups((current) => {
                                previousGroups = current;
                                return current.filter((item) => item.id !== group.id);
                              });
                              try {
                                await api(`/api/groups/${group.id}`, {
                                  method: "DELETE",
                                });
                              } catch (error) {
                                setGroups(previousGroups);
                                throw error;
                              }
                            },
                            "Group archived.",
                          )
                        }
                        title="Archive group"
                        tone="danger"
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      {group.members.length ? (
                        group.members.map((member) => (
                          <PersonRow
                            action={
                              <IconButton
                                disabled={busyKey !== null}
                                icon={<X className="h-4 w-4" aria-hidden />}
                                onClick={() =>
                                  void runLocalAction(
                                    `remove-member:${group.id}:${member.user.userId}`,
                                    async () => {
                                      const previous = patchGroup(group.id, (currentGroup) =>
                                        removeOptimisticMember(
                                          currentGroup,
                                          member.user.userId,
                                          new Date().toISOString(),
                                        ),
                                      );
                                      try {
                                        const payload = await api<{ group: FriendGroup }>(
                                          `/api/groups/${group.id}/members/${member.user.userId}`,
                                          { method: "DELETE" },
                                        );
                                        upsertGroup(payload.group);
                                      } catch (error) {
                                        if (previous) upsertGroup(previous);
                                        throw error;
                                      }
                                    },
                                    "Group member removed.",
                                  )
                                }
                                title="Remove from group"
                              />
                            }
                            key={member.user.userId}
                            user={member.user}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-foreground/50">No members.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <select
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-brand-orange"
                        disabled={!addableFriends.length || busyKey !== null}
                        onChange={(event) => {
                          const userId = event.target.value;
                          if (!userId) return;
                          event.target.value = "";
                          const friend = addableFriends.find((item) => item.user.userId === userId);
                          if (!friend) return;
                          void runLocalAction(
                            `add-member:${group.id}:${userId}`,
                            async () => {
                              const previous = patchGroup(group.id, (currentGroup) =>
                                addOptimisticMember(currentGroup, friend, new Date().toISOString()),
                              );
                              try {
                                const payload = await api<{ group: FriendGroup }>(
                                  `/api/groups/${group.id}/members`,
                                  {
                                    body: JSON.stringify({ userId }),
                                    method: "POST",
                                  },
                                );
                                upsertGroup(payload.group);
                              } catch (error) {
                                if (previous) upsertGroup(previous);
                                throw error;
                              }
                            },
                            "Friend added to group.",
                          );
                        }}
                      >
                        <option value="">
                          {addableFriends.length ? "Add friend" : "No friends to add"}
                        </option>
                        {addableFriends.map((friend) => (
                          <option key={friend.user.userId} value={friend.user.userId}>
                            {friend.user.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-foreground/50">No groups yet.</p>
            )}
          </div>
        </section>

        {friendsData.outgoingRequests.length ? (
          <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <h2 className="text-lg font-semibold text-foreground">Outgoing</h2>
            <div className="mt-3">
              {friendsData.outgoingRequests.map((request) => (
                <PersonRow
                  key={request.friendshipId}
                  meta="Pending"
                  user={request.user}
                />
              ))}
            </div>
          </section>
        ) : null}
    </div>
  );
}

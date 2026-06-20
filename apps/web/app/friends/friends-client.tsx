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
  RefreshCw,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

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

type FriendsResponse = {
  friends: FriendListItem[];
  incomingRequests: FriendListItem[];
  outgoingRequests: FriendListItem[];
  blocked: FriendListItem[];
};

type GroupsResponse = {
  groups: FriendGroup[];
};

type Notice = {
  tone: "success" | "error";
  text: string;
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

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown; message?: unknown }
    | T
    | null;
  if (!response.ok) {
    const errorPayload =
      body && typeof body === "object" && ("message" in body || "error" in body)
        ? (body as { message?: unknown; error?: unknown })
        : null;
    const message =
      errorPayload
        ? String(errorPayload.message ?? errorPayload.error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });
  return readJson<T>(response);
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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">
      {initials(user.displayName)}
    </span>
  );
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
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
          <p className="truncate text-xs text-slate-400">
            {user.handle ? `@${user.handle}` : meta ?? user.userId}
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
      ? "bg-violet-500 text-white hover:bg-violet-400"
      : tone === "danger"
        ? "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15";

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
  const [friendCode, setFriendCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const activeGroups = useMemo(
    () => groups.filter((group) => !group.archivedAt),
    [groups],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [friends, groupPayload] = await Promise.all([
        api<FriendsResponse>("/api/friends"),
        api<GroupsResponse>("/api/groups"),
      ]);
      setFriendsData(friends);
      setGroups(groupPayload.groups);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load friends",
      });
    } finally {
      setLoading(false);
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
        await refresh();
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

  const sendRequest = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const userId = friendCode.trim();
      if (!userId) return;
      await runAction(
        "send-request",
        async () => {
          await api("/api/friends/requests", {
            body: JSON.stringify({ userId }),
            method: "POST",
          });
          setFriendCode("");
        },
        "Friend request sent.",
      );
    },
    [friendCode, runAction],
  );

  const createGroup = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = groupName.trim();
      if (!name) return;
      await runAction(
        "create-group",
        async () => {
          await api("/api/groups", {
            body: JSON.stringify({ name }),
            method: "POST",
          });
          setGroupName("");
        },
        "Group created.",
      );
    },
    [groupName, runAction],
  );

  const copyOwnCode = useCallback(async () => {
    await navigator.clipboard.writeText(currentUser.userId);
    setNotice({ tone: "success", text: "Friend code copied." });
  }, [currentUser.userId]);

  const friendOptionsForGroup = useCallback(
    (group: FriendGroup) => {
      const memberIds = new Set(group.members.map((member) => member.user.userId));
      return friendsData.friends.filter((friend) => !memberIds.has(friend.user.userId));
    },
    [friendsData.friends],
  );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
              AniDachi
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Friends
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {currentUser.displayName} · {currentUser.email}
            </p>
          </div>
          <IconButton
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            onClick={refresh}
            title="Refresh"
          >
            Refresh
          </IconButton>
        </header>

        {notice ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              notice.tone === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
            role="status"
          >
            {notice.text}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">Your friend code</h2>
                <p className="truncate font-mono text-xs text-slate-400">{currentUser.userId}</p>
              </div>
            </div>
            <IconButton
              icon={<Copy className="h-4 w-4" aria-hidden />}
              onClick={copyOwnCode}
              title="Copy friend code"
            >
              Copy code
            </IconButton>
          </div>

          <form
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
            onSubmit={sendRequest}
          >
            <label className="block text-sm font-semibold text-white" htmlFor="friend-code">
              Add friend
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400"
                id="friend-code"
                onChange={(event) => setFriendCode(event.target.value)}
                placeholder="Paste friend code"
                value={friendCode}
              />
              <IconButton
                disabled={!friendCode.trim() || busyKey === "send-request"}
                icon={<Send className="h-4 w-4" aria-hidden />}
                title="Send friend request"
                tone="primary"
                type="submit"
              >
                Send
              </IconButton>
            </div>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Incoming</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                {friendsData.incomingRequests.length}
              </span>
            </div>
            <div className="mt-3">
              {loading ? (
                <p className="py-4 text-sm text-slate-400">Loading...</p>
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
                <p className="py-4 text-sm text-slate-400">No incoming requests.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Friends</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                {friendsData.friends.length}
              </span>
            </div>
            <div className="mt-3">
              {loading ? (
                <p className="py-4 text-sm text-slate-400">Loading...</p>
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
                <p className="py-4 text-sm text-slate-400">No friends yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-semibold text-white">Groups</h2>
              <p className="mt-1 text-sm text-slate-400">
                {activeGroups.length} active · {friendsData.friends.length} friends available
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createGroup}>
              <input
                className="min-h-11 min-w-0 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 sm:w-64"
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
              <p className="text-sm text-slate-400">Loading...</p>
            ) : activeGroups.length ? (
              activeGroups.map((group) => {
                const addableFriends = friendOptionsForGroup(group);
                return (
                  <div
                    className="rounded-lg border border-white/10 bg-slate-950/60 p-4"
                    key={group.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {group.members.length} members
                        </p>
                      </div>
                      <IconButton
                        disabled={busyKey !== null}
                        icon={<Trash2 className="h-4 w-4" aria-hidden />}
                        onClick={() =>
                          void runAction(
                            `archive-group:${group.id}`,
                            () =>
                              api(`/api/groups/${group.id}`, {
                                method: "DELETE",
                              }),
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
                                  void runAction(
                                    `remove-member:${group.id}:${member.user.userId}`,
                                    () =>
                                      api(
                                        `/api/groups/${group.id}/members/${member.user.userId}`,
                                        { method: "DELETE" },
                                      ),
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
                        <p className="text-sm text-slate-400">No members.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <select
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-violet-400"
                        disabled={!addableFriends.length || busyKey !== null}
                        onChange={(event) => {
                          const userId = event.target.value;
                          if (!userId) return;
                          event.target.value = "";
                          void runAction(
                            `add-member:${group.id}:${userId}`,
                            () =>
                              api(`/api/groups/${group.id}/members`, {
                                body: JSON.stringify({ userId }),
                                method: "POST",
                              }),
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
              <p className="text-sm text-slate-400">No groups yet.</p>
            )}
          </div>
        </section>

        {friendsData.outgoingRequests.length ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Outgoing</h2>
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
    </main>
  );
}

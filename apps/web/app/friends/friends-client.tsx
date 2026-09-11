"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import type {
  FriendGroup,
  FriendListItem,
  PublicProfile,
} from "@anidachi/protocol";
import {
  AccountEmptyState,
  AccountPageHeader,
  AccountSectionSwitch,
} from "@/components/account/account-ui";
import { useAccountViewState } from "@/components/account/account-workspace-state";
import { api } from "@/lib/client-api";
import {
  parseFriendDirectory,
  parseGroupDirectory,
  parseSavedGroup,
  SOCIAL_OWNER_HEADER,
} from "@/lib/social-editor-contracts";

type CurrentUser = {
  userId: string;
  displayName: string;
  email: string;
  plan: string;
};
type Directory = Pick<
  ReturnType<typeof parseFriendDirectory>,
  "friends" | "incomingRequests" | "outgoingRequests" | "blocked"
>;
type Notice = { text: string; error?: boolean };
type InviteLink = { url: string; expiresAt: string };
type Editor = {
  groupId: string;
  original: FriendGroup | null;
  name: string;
  memberIds: string[];
};
type Modal =
  | { type: "invite" }
  | { type: "editor" }
  | { type: "remove"; friend: FriendListItem }
  | { type: "delete"; group: FriendGroup };
const EMPTY: Directory = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blocked: [],
};
const SOCIAL_CHANGED = "anidachi:account-social-changed";

function Avatar({ user }: { user: PublicProfile }) {
  return user.avatarUrl ? (
    <img className="people-avatar" src={user.avatarUrl} alt="" />
  ) : (
    <span className="people-avatar">
      {user.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "A"}
    </span>
  );
}
function Person({
  user,
  children,
  meta,
}: {
  user: PublicProfile;
  children?: ReactNode;
  meta?: string;
}) {
  return (
    <div className="people-person">
      <Avatar user={user} />
      <div className="people-identity">
        <strong>{user.displayName}</strong>
        <span>
          {meta ?? (user.handle ? `@${user.handle}` : "AniDachi friend")}
        </span>
      </div>
      {children}
    </div>
  );
}
function Button({
  children,
  icon,
  label,
  primary,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  label?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`people-button ${primary ? "people-primary" : ""} ${!children ? "people-icon-button" : ""}`}
      aria-label={label}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
function Options({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        ref.current
      )
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      className="people-options"
      ref={ref}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button") &&
          ref.current
        )
          ref.current.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={label}>
        <MoreHorizontal size={20} />
      </summary>
      <div>{children}</div>
    </details>
  );
}

// Remount account-bound data and drafts on identity change. View state alone is
// retained by the surrounding account workspace; late operations cannot cross it.
export function FriendsClient({ currentUser }: { currentUser: CurrentUser }) {
  return (
    <FriendsWorkspace key={currentUser.userId} currentUser={currentUser} />
  );
}
function FriendsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const [view, setView] = useAccountViewState<"friends" | "groups">(
    `${currentUser.userId}:social-view`,
    "friends",
  );
  const [search, setSearch] = useAccountViewState(
    `${currentUser.userId}:social-search`,
    "",
  );
  const [directory, setDirectory] = useState<Directory>(EMPTY);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [modalNotice, setModalNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const reads = useRef(0);
  const working = useRef(false);
  const reconcilePending = useRef(false);
  const activeGroups = useMemo(
    () => groups.filter((group) => !group.archivedAt),
    [groups],
  );
  const dirty =
    !!editor &&
    (editor.name !== (editor.original?.name ?? "") ||
      [...editor.memberIds].sort().join() !==
        (editor.original?.members
          .map((m) => m.user.userId)
          .sort()
          .join() ?? ""));
  const request = useCallback(
    <T,>(path: string, init?: RequestInit) =>
      api<T>(path, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          [SOCIAL_OWNER_HEADER]: currentUser.userId,
        },
      }),
    [currentUser.userId],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current++;
    };
  }, []);
  const refresh = useCallback(
    async (showLoading = true) => {
      if (working.current) {
        reconcilePending.current = true;
        return;
      }
      const ticket = ++sequence.current;
      reads.current++;
      if (showLoading) setLoading(true);
      try {
        const [friends, groupList] = await Promise.all([
          request<unknown>("/api/friends").then(parseFriendDirectory),
          request<unknown>("/api/groups").then(parseGroupDirectory),
        ]);
        if (!mounted.current || ticket !== sequence.current) return;
        setDirectory(friends);
        setGroups(groupList.groups);
        setLoaded(true);
      } catch (error) {
        if (mounted.current && ticket === sequence.current)
          setNotice({
            error: true,
            text:
              error instanceof Error
                ? error.message
                : "Could not load friends.",
          });
      } finally {
        reads.current--;
        if (mounted.current && ticket === sequence.current) setLoading(false);
      }
    },
    [request],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const hash = () => {
      if (window.location.hash === "#groups") setView("groups");
    };
    hash();
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, [setView]);
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (
        detail?.ownerUserId === currentUser.userId &&
        detail?.source !== "friends"
      )
        void refresh(false);
    };
    const focus = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    window.addEventListener(SOCIAL_CHANGED, sync);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener(SOCIAL_CHANGED, sync);
      window.removeEventListener("focus", focus);
    };
  }, [currentUser.userId, refresh]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const leave = () =>
      !working.current && window.confirm("Discard your unsaved group changes?");
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const intent = (event: Event) => {
      if (!leave()) event.preventDefault();
    };
    const link = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a[href]") &&
        !leave()
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("anidachi:before-account-navigation", intent);
    window.addEventListener("anidachi:before-sign-out", intent);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("anidachi:before-account-navigation", intent);
      window.removeEventListener("anidachi:before-sign-out", intent);
      document.removeEventListener("click", link, true);
    };
  }, [dirty, busy]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (modal && dialog && !dialog.open) dialog.showModal();
  }, [modal]);
  function dismissModal() {
    // Native close restores the opener's focus before React removes the dialog.
    dialogRef.current?.close();
    const opener = returnFocusRef.current;
    if (opener?.isConnected) opener.focus();
    setModal(null);
    window.requestAnimationFrame(() => {
      if (!mounted.current) return;
      if (!opener?.isConnected && document.activeElement === document.body)
        document
          .querySelector<HTMLButtonElement>(
            ".people-workspace .ac-header-actions button:last-child",
          )
          ?.focus();
    });
  }
  function closeModal() {
    if (
      working.current ||
      (dirty && !window.confirm("Discard your unsaved group changes?"))
    )
      return;
    dismissModal();
    setEditor(null);
    setModalNotice(null);
  }
  function openModal(next: Modal) {
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement
        ? (active.closest("details")?.querySelector<HTMLElement>("summary") ??
          active)
        : null;
    setModalNotice(null);
    setModal(next);
  }
  function editGroup(group: FriendGroup | null) {
    setEditor({
      groupId: group?.id ?? crypto.randomUUID(),
      original: group,
      name: group?.name ?? "",
      memberIds: group?.members.map((m) => m.user.userId) ?? [],
    });
    setMemberSearch("");
    openModal({ type: "editor" });
  }
  async function action(
    task: () => Promise<void>,
    message: string,
    options: {
      modal?: boolean;
      reload?: boolean;
      broadcast?: boolean;
      dismiss?: boolean;
    } = {},
  ) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setNotice(null);
    setModalNotice(null);
    if (reads.current) reconcilePending.current = true;
    sequence.current++;
    try {
      await task();
      if (!mounted.current) return;
      (options.modal && !options.dismiss ? setModalNotice : setNotice)({
        text: message,
      });
      if (options.broadcast !== false)
        window.dispatchEvent(
          new CustomEvent(SOCIAL_CHANGED, {
            detail: { ownerUserId: currentUser.userId, source: "friends" },
          }),
        );
      if (options.reload) reconcilePending.current = true;
    } catch (error) {
      if (mounted.current)
        (options.modal ? setModalNotice : setNotice)({
          error: true,
          text:
            error instanceof Error
              ? error.message
              : "Could not complete the action. Try again.",
        });
    } finally {
      working.current = false;
      if (mounted.current) {
        setBusy(false);
        setLoading(false);
        if (reconcilePending.current) {
          reconcilePending.current = false;
          void refresh(false);
        }
      }
    }
  }
  async function saveGroup() {
    if (!editor?.name.trim()) return;
    const draft = editor;
    await action(
      async () => {
        const group = parseSavedGroup(
          await request("/api/groups/editor", {
            method: "POST",
            body: JSON.stringify({
              groupId: draft.groupId,
              name: draft.name.trim(),
              memberIds: draft.memberIds,
              create: !draft.original,
              expectedUpdatedAt: draft.original?.updatedAt ?? null,
            }),
          }),
        );
        if (!mounted.current) return;
        setGroups((items) => [
          group,
          ...items.filter((item) => item.id !== group.id),
        ]);
        setEditor(null);
        dismissModal();
      },
      draft.original ? "Group saved." : "Group created.",
      { modal: true, dismiss: true },
    );
  }
  async function generateLink() {
    await action(
      async () => {
        const result = await request<{ inviteLink: InviteLink }>(
          "/api/friends/invite-links",
          { method: "POST" },
        );
        const link = result?.inviteLink;
        if (
          !link ||
          typeof link.url !== "string" ||
          !Number.isFinite(Date.parse(link.expiresAt))
        )
          throw new Error("Could not create an invite link.");
        const url = new URL(link.url);
        if (
          url.origin !== window.location.origin ||
          !url.pathname.startsWith("/friend/invite/")
        )
          throw new Error("Could not create an invite link.");
        if (mounted.current) setInviteLink(link);
      },
      "Your link is ready to share.",
      { modal: true, broadcast: false },
    );
  }
  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      if (mounted.current) setModalNotice({ text: "Link copied." });
    } catch {
      if (mounted.current)
        setModalNotice({
          error: true,
          text: "Select and copy the link below.",
        });
    }
  }
  async function shareLink() {
    if (!inviteLink) return;
    try {
      await navigator.share({
        title: "AniDachi friend invite",
        url: inviteLink.url,
      });
    } catch (error) {
      if (
        mounted.current &&
        !(error instanceof Error && error.name === "AbortError")
      )
        setModalNotice({
          error: true,
          text: "Could not share. Copy the link instead.",
        });
    }
  }
  const query = search.trim().toLowerCase();
  const visibleFriends = directory.friends.filter((f) =>
    `${f.user.displayName} ${f.user.handle ?? ""}`
      .toLowerCase()
      .includes(query),
  );
  const friendIds = new Set(directory.friends.map((f) => f.user.userId));
  const missingMembers =
    editor?.memberIds.filter((id) => !friendIds.has(id)) ?? [];
  const memberQuery = memberSearch.trim().toLowerCase();
  const choices = directory.friends.filter((f) =>
    `${f.user.displayName} ${f.user.handle ?? ""}`
      .toLowerCase()
      .includes(memberQuery),
  );
  function toggleMember(id: string) {
    setEditor((draft) =>
      draft
        ? {
            ...draft,
            memberIds: draft.memberIds.includes(id)
              ? draft.memberIds.filter((value) => value !== id)
              : [...draft.memberIds, id],
          }
        : null,
    );
  }
  const dismissButton = (
    <Button
      label="Close dialog"
      icon={<X size={20} />}
      disabled={busy}
      onClick={closeModal}
    />
  );
  return (
    <div className="people-workspace">
      <AccountPageHeader
        title="Friends & Groups"
        description="Your people, ready for the next watch."
        action={
          <>
            <Button
              label="Refresh"
              icon={
                <RefreshCw size={18} className={loading ? "ac-spinning" : ""} />
              }
              disabled={busy || loading}
              onClick={() => {
                setNotice(null);
                void refresh();
              }}
            />
            <Button
              primary
              icon={
                view === "groups" ? <Plus size={18} /> : <Link2 size={18} />
              }
              disabled={busy || !loaded}
              onClick={() =>
                view === "groups"
                  ? editGroup(null)
                  : openModal({ type: "invite" })
              }
            >
              {view === "groups" ? "Create group" : "Invite a friend"}
            </Button>
          </>
        }
      />
      {notice && (
        <p
          className={`people-notice ${notice.error ? "people-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
      <AccountSectionSwitch
        label="People view"
        value={view}
        onChange={setView}
        options={[
          {
            value: "friends",
            label: "Friends",
            count: loaded ? directory.friends.length : undefined,
          },
          {
            value: "groups",
            label: "Groups",
            count: loaded ? activeGroups.length : undefined,
          },
        ]}
      />
      <div aria-busy={loading}>
        {!loaded ? (
          <AccountEmptyState
            title={
              loading
                ? "Loading your people…"
                : "Your people could not be loaded"
            }
          >
            <span>{loading ? "" : "Use Refresh to try again."}</span>
          </AccountEmptyState>
        ) : view === "friends" ? (
          <>
            {!!directory.incomingRequests.length && (
              <section className="people-requests">
                <h2>
                  Friend requests{" "}
                  <span>{directory.incomingRequests.length}</span>
                </h2>
                {directory.incomingRequests.map((friend) => (
                  <Person
                    key={friend.friendshipId}
                    user={friend.user}
                    meta="Wants to be your friend"
                  >
                    <Button
                      label="Accept request"
                      primary
                      icon={<Check size={18} />}
                      disabled={busy}
                      onClick={() =>
                        void action(
                          () =>
                            request(
                              `/api/friends/requests/${friend.friendshipId}/accept`,
                              { method: "POST" },
                            ),
                          "Friend added.",
                          { reload: true },
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      label="Decline request"
                      icon={<X size={18} />}
                      disabled={busy}
                      onClick={() =>
                        void action(
                          () =>
                            request(
                              `/api/friends/requests/${friend.friendshipId}/decline`,
                              { method: "POST" },
                            ),
                          "Request declined.",
                          { reload: true },
                        )
                      }
                    />
                  </Person>
                ))}
              </section>
            )}
            <div className="people-list-heading">
              <h2>
                Friends <span>{directory.friends.length}</span>
              </h2>
              <label className="people-search">
                <Search size={17} />
                <input
                  aria-label="Search friends"
                  placeholder="Search friends"
                  value={search}
                  onInput={(event) => setSearch(event.currentTarget.value)}
                />
              </label>
            </div>
            {visibleFriends.map((friend) => (
              <Person key={friend.user.userId} user={friend.user}>
                <Options label={`Options for ${friend.user.displayName}`}>
                  <button
                    disabled={busy}
                    onClick={() => openModal({ type: "remove", friend })}
                  >
                    <UserMinus size={16} />
                    Remove friend
                  </button>
                </Options>
              </Person>
            ))}
            {!visibleFriends.length && (
              <AccountEmptyState
                icon={<Users size={24} />}
                title={
                  query ? "No matching friends" : "Bring your people along"
                }
              >
                {query
                  ? "Try another name or handle."
                  : "Share a private invite link. Once accepted, you can invite your friend from the player."}
              </AccountEmptyState>
            )}
            {!!directory.outgoingRequests.length && (
              <details className="people-legacy social-outgoing">
                <summary>
                  Sent requests <span>{directory.outgoingRequests.length}</span>
                </summary>
                {directory.outgoingRequests.map((friend) => (
                  <Person
                    key={friend.friendshipId}
                    user={friend.user}
                    meta="Pending"
                  >
                    <Button
                      disabled={busy}
                      onClick={() => openModal({ type: "remove", friend })}
                    >
                      Cancel request
                    </Button>
                  </Person>
                ))}
              </details>
            )}
          </>
        ) : (
          <>
            <p className="people-hint">
              Private lists, visible only to you. Choose a group in your player
              to invite everyone at once.
            </p>
            <div className="people-groups">
              {activeGroups.map((group) => (
                <div key={group.id} className="people-group-row">
                  <button
                    className="people-group-open"
                    onClick={() => editGroup(group)}
                    aria-label={`Edit ${group.name}`}
                  >
                    <span className="people-group-symbol">
                      <Users size={23} />
                    </span>
                    <span className="people-identity">
                      <strong>{group.name}</strong>
                      <span>
                        {group.members.length}{" "}
                        {group.members.length === 1 ? "friend" : "friends"}
                      </span>
                    </span>
                    <span className="people-avatar-stack" aria-hidden>
                      {group.members.slice(0, 3).map((member) => (
                        <Avatar key={member.user.userId} user={member.user} />
                      ))}
                      {group.members.length > 3 && (
                        <span>+{group.members.length - 3}</span>
                      )}
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  <Options label={`Options for ${group.name}`}>
                    <button onClick={() => editGroup(group)}>Edit group</button>
                    <button
                      disabled={busy}
                      onClick={() => openModal({ type: "delete", group })}
                    >
                      <Trash2 size={16} />
                      Delete group
                    </button>
                  </Options>
                </div>
              ))}
            </div>
            {!activeGroups.length && (
              <AccountEmptyState
                icon={<Users size={24} />}
                title="Keep your watch circle together"
              >
                Create a group from your friends, then invite it from the
                player. Adding people here does not send invitations.
              </AccountEmptyState>
            )}
          </>
        )}
      </div>
      {modal && (
        <dialog
          className="people-dialog"
          ref={dialogRef}
          aria-labelledby="people-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            closeModal();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
              )
                closeModal();
            }
          }}
        >
          <header>
            <div>
              <h2 id="people-dialog-title">
                {modal.type === "invite"
                  ? "Invite a friend"
                  : modal.type === "editor"
                    ? editor?.original
                      ? "Edit group"
                      : "Create group"
                    : modal.type === "delete"
                      ? "Delete this group?"
                      : modal.friend.status === "pending"
                        ? "Cancel this request?"
                        : "Remove this friend?"}
              </h2>
              <p>
                {modal.type === "invite"
                  ? "One link. One friend. Ready to watch together."
                  : modal.type === "editor"
                    ? "Choose who you want to invite together."
                    : ""}
              </p>
            </div>
            {dismissButton}
          </header>
          {modalNotice && (
            <p
              className={`people-notice ${modalNotice.error ? "people-error" : ""}`}
              role={modalNotice.error ? "alert" : "status"}
            >
              {modalNotice.text}
            </p>
          )}
          {modal.type === "invite" ? (
            <div className="people-invite">
              <span className="people-invite-symbol">
                <Link2 size={30} />
              </span>
              <p>
                Send this link to one person. After signing in and accepting,
                you will appear in each other&apos;s friends list.
              </p>
              {inviteLink ? (
                <>
                  <label className="people-link-label">
                    Your private invite link
                    <input
                      aria-label="Friend invite link"
                      readOnly
                      value={inviteLink.url}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <p className="people-hint">
                    One use · Expires{" "}
                    {new Date(inviteLink.expiresAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </p>
                  <div className="people-invite-actions">
                    <Button
                      primary
                      icon={<Copy size={17} />}
                      disabled={busy}
                      onClick={() => void copyLink()}
                    >
                      Copy link
                    </Button>
                    {typeof navigator !== "undefined" &&
                      typeof navigator.share === "function" && (
                        <Button
                          icon={<Share2 size={17} />}
                          onClick={() => void shareLink()}
                        >
                          Share
                        </Button>
                      )}
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() => void generateLink()}
                    icon={
                      busy ? (
                        <Loader2 className="ac-spinning" size={16} />
                      ) : (
                        <Plus size={16} />
                      )
                    }
                  >
                    Create another link
                  </Button>
                  <small>
                    Inviting someone else? Create a separate link for them.
                  </small>
                </>
              ) : (
                <Button
                  primary
                  disabled={busy}
                  icon={
                    busy ? (
                      <Loader2 size={17} className="ac-spinning" />
                    ) : (
                      <Link2 size={17} />
                    )
                  }
                  onClick={() => void generateLink()}
                >
                  Create invite link
                </Button>
              )}
            </div>
          ) : modal.type === "editor" && editor ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveGroup();
              }}
            >
              <div className="people-editor-name">
                <label htmlFor="people-group-name">Group name</label>
                <input
                  autoFocus
                  id="people-group-name"
                  aria-label="Group name"
                  placeholder="e.g. Friday anime"
                  maxLength={80}
                  value={editor.name}
                  disabled={busy}
                  onInput={(event) =>
                    setEditor({ ...editor, name: event.currentTarget.value })
                  }
                />
              </div>
              <div className="people-member-heading">
                <span>Friends</span>
                <span aria-live="polite">
                  {editor.memberIds.length} selected
                </span>
              </div>
              <label className="people-search">
                <Search size={17} />
                <input
                  aria-label="Find friends for group"
                  placeholder="Find a friend"
                  value={memberSearch}
                  onInput={(event) =>
                    setMemberSearch(event.currentTarget.value)
                  }
                />
              </label>
              <div className="people-member-list">
                {missingMembers.map((id) => (
                  <label className="people-member" key={id}>
                    <input
                      type="checkbox"
                      checked
                      disabled={busy}
                      onChange={() => toggleMember(id)}
                    />
                    <span className="people-identity">
                      <strong>
                        {editor.original?.members.find(
                          (m) => m.user.userId === id,
                        )?.user.displayName ?? "Unavailable friend"}
                      </strong>
                      <span>
                        No longer in your friends list. Unselect to save.
                      </span>
                    </span>
                  </label>
                ))}
                {choices.map((friend) => (
                  <label className="people-member" key={friend.user.userId}>
                    <input
                      type="checkbox"
                      disabled={
                        busy ||
                        (!editor.memberIds.includes(friend.user.userId) &&
                          editor.memberIds.length >= 100)
                      }
                      checked={editor.memberIds.includes(friend.user.userId)}
                      onChange={() => toggleMember(friend.user.userId)}
                    />
                    <Avatar user={friend.user} />
                    <span className="people-identity">
                      <strong>{friend.user.displayName}</strong>
                      <span>
                        {friend.user.handle
                          ? `@${friend.user.handle}`
                          : "AniDachi friend"}
                      </span>
                    </span>
                  </label>
                ))}
                {!choices.length && !missingMembers.length && (
                  <p className="people-member-empty">
                    {memberQuery
                      ? "No matching friends."
                      : "No friends yet. You can save an empty group and add friends later."}
                  </p>
                )}
              </div>
              <footer>
                <span>Only you can see this group.</span>
                <Button disabled={busy} onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  primary
                  type="submit"
                  disabled={
                    busy ||
                    !editor.name.trim() ||
                    !!missingMembers.length ||
                    (!dirty && !!editor.original)
                  }
                  icon={
                    busy ? (
                      <Loader2 size={16} className="ac-spinning" />
                    ) : undefined
                  }
                >
                  {busy
                    ? "Saving…"
                    : editor.original
                      ? "Save changes"
                      : "Create group"}
                </Button>
              </footer>
            </form>
          ) : modal.type === "delete" || modal.type === "remove" ? (
            <div className="people-confirm">
              <p>
                {modal.type === "delete"
                  ? `“${modal.group.name}” will no longer be available for invitations. Your friends will stay in your list.`
                  : modal.friend.status === "pending"
                    ? `Your request to ${modal.friend.user.displayName} will be canceled.`
                    : `${modal.friend.user.displayName} will be removed from your friends and your group lists. You can add each other again with a new link.`}
              </p>
              <footer>
                <Button disabled={busy} onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  disabled={busy}
                  primary
                  onClick={() =>
                    void action(
                      async () => {
                        await request(
                          modal.type === "delete"
                            ? `/api/groups/${modal.group.id}`
                            : `/api/friends/${modal.friend.user.userId}`,
                          { method: "DELETE" },
                        );
                        if (mounted.current) dismissModal();
                      },
                      modal.type === "delete"
                        ? "Group deleted."
                        : "Friend list updated.",
                      { modal: true, reload: true, dismiss: true },
                    )
                  }
                >
                  {busy
                    ? "Saving…"
                    : modal.type === "delete"
                      ? "Delete group"
                      : modal.friend.status === "pending"
                        ? "Cancel request"
                        : "Remove friend"}
                </Button>
              </footer>
            </div>
          ) : null}
        </dialog>
      )}
    </div>
  );
}

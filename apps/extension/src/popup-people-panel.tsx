import type { SocialDirectory } from "@anidachi/protocol";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  buildPopupPeopleModel,
  type PopupPeopleGroup,
  type PopupPeopleProfile,
} from "./popup-people-model";
import type { FriendInviteLink, SaveFriendGroupInput } from "./social-client";

export type PopupPeoplePresentationState =
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; errorMessage: string }>
  | Readonly<{ status: "ready"; directory: SocialDirectory }>
  | Readonly<{ status: "stale"; directory: SocialDirectory }>
  | Readonly<{
      status: "stale-error";
      directory: SocialDirectory;
      errorMessage: string;
    }>;

export type PopupPeopleActionKey =
  | "create-friend-link"
  | `save-group:${string}`
  | `delete-group:${string}`
  | `remove-friend:${string}`;
export type PopupPeopleActionNotice = Readonly<{
  actionKey: PopupPeopleActionKey;
  tone: "success" | "warning" | "error";
  text: string;
}>;
export type PopupPeoplePanelProps = {
  actionNotice: PopupPeopleActionNotice | null;
  pendingActionKey: PopupPeopleActionKey | null;
  onSaveGroup: (input: SaveFriendGroupInput) => Promise<boolean>;
  onCreateInviteLink: () => Promise<FriendInviteLink | null>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
  onRemoveFriend: (userId: string) => Promise<boolean>;
  onDismissNotice: () => void;
  onOpenDashboard: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  state: PopupPeoplePresentationState;
};
type Mode = "friends" | "groups";
type Editor = { initial: SaveFriendGroupInput; group: PopupPeopleGroup | null };
type Removal = { kind: "friend" | "group"; id: string; name: string };

export function PopupPeoplePanel(props: PopupPeoplePanelProps) {
  const { state, pendingActionKey, actionNotice } = props;
  const [mode, setMode] = useState<Mode>("friends");
  const [queries, setQueries] = useState({ friends: "", groups: "" });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState<FriendInviteLink | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const model =
    "directory" in state ? buildPopupPeopleModel(state.directory) : null;
  const id = useId();
  const query = queries[mode].trim().toLocaleLowerCase();
  const friends =
    model?.friends.filter(
      ({ user }) =>
        matches(user.displayName, query) || matches(user.handle ?? "", query),
    ) ?? [];
  const groups =
    model?.groups.filter((group) => matches(group.name, query)) ?? [];
  const beginEditor = (group: PopupPeopleGroup | null) => {
    props.onDismissNotice();
    setEditor({
      group,
      initial: {
        groupId: group?.id ?? crypto.randomUUID(),
        name: group?.name ?? "",
        memberIds: group?.members.map(({ user }) => user.userId) ?? [],
        create: !group,
        expectedUpdatedAt: group?.updatedAt ?? null,
      },
    });
  };
  const beginRemoval = (value: Removal) => {
    props.onDismissNotice();
    setRemoval(value);
  };
  const hasItems = !!model && (mode === "friends" ? model.friends.length > 0 : model.groups.length > 0);
  const beginAdd = () => {
    if (mode === "groups") beginEditor(null);
    else {
      props.onDismissNotice();
      setLinkOpen(true);
    }
  };
  const addButton = (
    <button className="people-primary people-add" disabled={!!pendingActionKey} onClick={beginAdd}>
      {mode === "friends" ? <UserPlus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      {mode === "friends" ? "Add friend" : "Create group"}
    </button>
  );
  const showNotice = actionNotice && !editor && !linkOpen && !removal;

  return (
    <section className="popup-section popup-people-panel" aria-label="People">
      <div className="people-toolbar">
        <div
          aria-label="People mode"
          className="people-modes"
          data-mode={mode}
          role="tablist"
        >
          {(["friends", "groups"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${id}-${value}`}
              aria-controls={`${id}-list`}
              aria-selected={mode === value}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "friends"
                    : event.key === "End"
                      ? "groups"
                      : mode === "friends"
                        ? "groups"
                        : "friends";
                setMode(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
            >
              {value === "friends" ? "Friends" : "Groups"}
            </button>
          ))}
        </div>
        <button
          className="people-icon-button"
          aria-label="Refresh people"
          title="Refresh people"
          type="button"
          disabled={state.status === "loading" || !!pendingActionKey}
          onClick={props.onRefresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div
        className="popup-people-content"
        data-presentation-state={state.status}
      >
        {state.status === "signed-out" && (
          <div className="popup-people-state" data-state="signed-out">
            <Users size={22} />
            <span>Sign in to see your people.</span>
            <button className="people-primary" onClick={props.onSignIn}>
              Sign in
            </button>
          </div>
        )}
        {state.status === "loading" && (
          <div
            className="popup-people-state"
            data-state="loading"
            role="status"
          >
            Loading people...
          </div>
        )}
        {state.status === "error" && (
          <div className="popup-people-state" data-state="error">
            <span>{state.errorMessage}</span>
            <button className="people-secondary" onClick={props.onRefresh}>
              Retry
            </button>
          </div>
        )}
        {(state.status === "stale" || state.status === "stale-error") && (
          <div
            className="popup-people-status"
            role="status"
            data-state={state.status === "stale-error" ? "error" : "stale"}
          >
            {state.status === "stale-error"
              ? state.errorMessage
              : "Showing saved people while we reconnect."}
            {state.status === "stale-error" && (
              <button
                className="people-secondary"
                disabled={!!pendingActionKey}
                onClick={props.onRefresh}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {model && (
          <>
            {hasItems && <div className="people-list-tools">
              <label className="people-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label={`Search ${mode}`}
                  placeholder={`Search ${mode}`}
                  value={queries[mode]}
                  onChange={(event) =>
                    setQueries({ ...queries, [mode]: event.target.value })
                  }
                />
              </label>
              {addButton}
            </div>}
            <div
              role="tabpanel"
              id={`${id}-list`}
              aria-labelledby={`${id}-${mode}`}
            >
              {hasItems && <div className="people-list-caption">
                <span>
                  {mode === "friends" ? "Your friends" : "Your groups"}
                </span>
                <span>
                  {mode === "friends"
                    ? model.friends.length
                    : model.groups.length}
                </span>
              </div>}
              {mode === "friends" ? (
                <div className="people-rows">
                  {friends.map(({ user }) => (
                    <div className="people-row" key={user.userId}>
                      <ProfileAvatar profile={user} />
                      <span className="people-row-copy">
                        <strong>{user.displayName}</strong>
                        {user.handle && <small>@{user.handle}</small>}
                      </span>
                      <FriendMenu
                        name={user.displayName}
                        disabled={!!pendingActionKey}
                        onRemove={() =>
                          beginRemoval({
                            kind: "friend",
                            id: user.userId,
                            name: user.displayName,
                          })
                        }
                      />
                    </div>
                  ))}
                  {!friends.length && (
                    <EmptyState>
                      {hasItems ? "No friends found." : <>
                        <span className="people-empty-icon"><UserPlus size={24} aria-hidden="true" /></span>
                        <strong>No friends yet</strong>
                        <p>Add a friend to start watching together.</p>
                        {addButton}
                      </>}
                    </EmptyState>
                  )}
                </div>
              ) : (
                <div className="people-rows">
                  {groups.map((group) => (
                    <button
                      className="people-row people-group-row"
                      key={group.id}
                      disabled={!!pendingActionKey}
                      onClick={() => beginEditor(group)}
                      aria-label={`Edit ${group.name}`}
                    >
                      <span className="people-group-avatar">
                        <Users size={20} />
                      </span>
                      <span className="people-row-copy">
                        <strong>{group.name}</strong>
                        <small>
                          {group.members.length}{" "}
                          {group.members.length === 1 ? "friend" : "friends"}
                        </small>
                      </span>
                      <span className="people-avatar-stack" aria-hidden="true">
                        {group.members.slice(0, 3).map(({ user }) => (
                          <ProfileAvatar profile={user} key={user.userId} />
                        ))}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!groups.length && (
                    <EmptyState>
                      {hasItems ? "No groups found." : <>
                        <span className="people-empty-icon"><Users size={24} aria-hidden="true" /></span>
                        <strong>Watch with your group</strong>
                        <p>Keep friends together for easy room invites.</p>
                        {addButton}
                      </>}
                    </EmptyState>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {showNotice && <Notice notice={actionNotice} />}
      </div>
      <button
        className="people-website"
        type="button"
        onClick={props.onOpenDashboard}
      >
        Manage on website <ArrowUpRight size={14} />
      </button>
      {editor && model && (
        <GroupEditor
          key={editor.initial.groupId}
          editor={editor}
          friends={model.friends.map(({ user }) => user)}
          notice={actionNotice}
          onSave={props.onSaveGroup}
          onClose={() => setEditor(null)}
          onDelete={() =>
            beginRemoval({
              kind: "group",
              id: editor.initial.groupId,
              name: editor.initial.name,
            })
          }
        />
      )}
      {linkOpen && (
        <LinkDialog
          link={link}
          onLink={setLink}
          onCreate={props.onCreateInviteLink}
          notice={actionNotice}
          onClose={() => setLinkOpen(false)}
        />
      )}
      {removal && (
        <RemovalDialog
          removal={removal}
          notice={actionNotice}
          onClose={() => setRemoval(null)}
          onConfirm={async () => {
            const saved = await (removal.kind === "friend"
              ? props.onRemoveFriend(removal.id)
              : props.onDeleteGroup(removal.id));
            if (saved) {
              setRemoval(null);
              if (removal.kind === "group") setEditor(null);
            }
            return saved;
          }}
        />
      )}
    </section>
  );
}

function GroupEditor({
  editor,
  friends,
  notice,
  onSave,
  onClose,
  onDelete,
}: {
  editor: Editor;
  friends: PopupPeopleProfile[];
  notice: PopupPeopleActionNotice | null;
  onSave: PopupPeoplePanelProps["onSaveGroup"];
  onClose: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(editor.initial.name);
  const [selected, setSelected] = useState(
    () => new Set(editor.initial.memberIds),
  );
  const [query, setQuery] = useState("");
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useMounted();
  const nameId = useId();
  const dirty =
    name.trim() !== editor.initial.name ||
    [...selected].sort().join() !== [...editor.initial.memberIds].sort().join();
  const friendIds = new Set(friends.map((friend) => friend.userId));
  const candidates = [
    ...friends,
    ...(editor.group?.members
      .map(({ user }) => user)
      .filter((user) => !friendIds.has(user.userId)) ?? []),
  ];
  const visible = candidates.filter((user) =>
    matches(
      `${user.displayName} ${user.handle ?? ""}`,
      query.trim().toLocaleLowerCase(),
    ),
  );
  const requestClose = () => {
    if (!lock.current) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  };
  const save = async () => {
    if (lock.current || !name.trim() || selected.size > 100) return;
    lock.current = true;
    setBusy(true);
    setLocalError(null);
    try {
      const saved = await onSave({
        ...editor.initial,
        name: name.trim(),
        memberIds: [...selected],
      });
      if (mounted.current && saved) onClose();
    } catch {
      if (mounted.current)
        setLocalError("Could not save group. Your changes are still here.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <PeopleDialog
      title={editor.initial.create ? "Create group" : "Edit group"}
      onClose={requestClose}
      busy={busy}
    >
      <form
        className="people-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="people-dialog-body">
          <label className="people-field" htmlFor={nameId}>
            Group name
            <input
              id={nameId}
              name="group-name"
              autoFocus
              data-people-initial-focus
              value={name}
              maxLength={80}
              required
              disabled={busy}
              placeholder="e.g. Anime night"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="people-list-caption">
            <span>Choose friends</span>
            <span>{selected.size} selected</span>
          </div>
          {candidates.length > 0 && <label className="people-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search group friends"
              placeholder="Search friends"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>}
          <div className="people-member-list">
            {visible.map((user) => (
              <label className="people-row people-member" key={user.userId}>
                <ProfileAvatar profile={user} />
                <span className="people-row-copy">
                  <strong>{user.displayName}</strong>
                  <small>
                    {!friendIds.has(user.userId)
                      ? "No longer a friend"
                      : user.handle
                        ? `@${user.handle}`
                        : "Friend"}
                  </small>
                </span>
                <input
                  type="checkbox"
                  aria-label={user.displayName}
                  checked={selected.has(user.userId)}
                  disabled={
                    busy ||
                    (!selected.has(user.userId) &&
                      (selected.size >= 100 || !friendIds.has(user.userId)))
                  }
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(user.userId)) next.delete(user.userId);
                      else next.add(user.userId);
                      return next;
                    })
                  }
                />
              </label>
            ))}
            {!visible.length && (
              <EmptyState>
                {query ? "No friends found." : "You can add friends later."}
              </EmptyState>
            )}
          </div>
          <p className="people-hint">
            {selected.size >= 100 ? "100-friend limit reached." : "Only you can see this group."}
          </p>
          {notice?.actionKey === `save-group:${editor.initial.groupId}` &&
            notice.tone === "error" && <Notice notice={notice} />}
          {localError && (
            <p className="people-error" role="alert">
              {localError}
            </p>
          )}
        </div>
        {discard ? (
          <div className="people-discard" role="alert">
            <span>Discard unsaved changes?</span>
            <div>
              <button
                className="people-secondary"
                type="button"
                onClick={() => setDiscard(false)}
              >
                Keep editing
              </button>
              <button className="people-danger" type="button" onClick={onClose}>
                Discard
              </button>
            </div>
          </div>
        ) : (
          <div className="people-dialog-footer">
            {!editor.initial.create && (
              <button
                className="people-icon-button people-delete"
                type="button"
                aria-label="Delete group"
                title="Delete group"
                disabled={busy}
                onClick={onDelete}
              >
                <Trash2 size={17} />
              </button>
            )}
            <span className="people-footer-spacer" />
            <button
              className="people-secondary"
              type="button"
              disabled={busy}
              onClick={requestClose}
            >
              Cancel
            </button>
            <button
              className="people-primary"
              type="submit"
              disabled={
                busy ||
                !name.trim() ||
                (!dirty && !editor.initial.create) ||
                selected.size > 100
              }
            >
              {busy ? "Saving..." : editor.initial.create ? "Create group" : "Save changes"}
            </button>
          </div>
        )}
      </form>
    </PeopleDialog>
  );
}

function LinkDialog({
  link,
  onLink,
  onCreate,
  notice,
  onClose,
}: {
  link: FriendInviteLink | null;
  onLink: (link: FriendInviteLink) => void;
  onCreate: PopupPeoplePanelProps["onCreateInviteLink"];
  notice: PopupPeopleActionNotice | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const mounted = useMounted();
  const activeLink = link && Date.parse(link.expiresAt) > Date.now() ? link : null;

  const prepareLink = async (replace: boolean, copy: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFeedback("");
    setCopied(false);
    try {
      // Recheck expiry at the click, not only at the last render.
      let next = !replace && link && Date.parse(link.expiresAt) > Date.now() ? link : null;
      if (!next) {
        next = await onCreate();
        if (!mounted.current || !next) return;
        onLink(next);
      }
      if (!mounted.current) return;
      if (copy) {
        try {
          await navigator.clipboard.writeText(next.url);
          if (mounted.current) {
            setCopied(true);
          }
        } catch {
          if (mounted.current) setFeedback("Select the link and copy it manually.");
        }
      }
    } catch {
      if (mounted.current) setFeedback("Could not create a link. Try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <PeopleDialog title="Add friend" busy={busy} onClose={() => { if (!lock.current) onClose(); }}>
      <div className="people-dialog-body people-link-body">
        <p className="people-link-intro">Only one person can use this link.</p>
        {activeLink && (
          <label className="people-link-url">
            <input aria-label="Invitation link" readOnly value={activeLink.url}
              onFocus={(event) => event.currentTarget.select()} />
          </label>
        )}
        <button className="people-primary people-copy-link" disabled={busy} data-people-initial-focus
          aria-label="Copy invite link" onClick={() => void prepareLink(false, true)}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          <span role="status" aria-live="polite">{busy ? "Preparing link..." : copied ? "Copied" : "Copy link"}</span>
        </button>
        {activeLink && (
          <div className="people-link-more">
            <button className="people-text-button" disabled={busy} title="Create a link for another friend" onClick={() => void prepareLink(true, false)}>
              New link
            </button>
          </div>
        )}
        {notice?.actionKey === "create-friend-link" && notice.tone === "error" && <Notice notice={notice} />}
        {feedback && <p className="people-link-feedback" role="alert">{feedback}</p>}
      </div>
    </PeopleDialog>
  );
}

function RemovalDialog({
  removal,
  notice,
  onClose,
  onConfirm,
}: {
  removal: Removal;
  notice: PopupPeopleActionNotice | null;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const mounted = useMounted();
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      if (mounted.current)
        setError("Could not complete this action. Try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const actionKey = `${removal.kind === "friend" ? "remove-friend" : "delete-group"}:${removal.id}`;
  return (
    <PeopleDialog
      title={removal.kind === "friend" ? "Remove friend?" : "Delete group?"}
      busy={busy}
      onClose={() => {
        if (!lock.current) onClose();
      }}
    >
      <div className="people-dialog-body">
        <p className="people-removal-name">{removal.name}</p>
        <p className="people-hint">
          {removal.kind === "friend"
            ? "They will leave your friends list. You can reconnect with a new invitation link."
            : "This removes your private group. Everyone stays in your friends list."}
        </p>
        {notice?.actionKey === actionKey && notice.tone === "error" && (
          <Notice notice={notice} />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="people-dialog-footer">
        <button className="people-secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <span className="people-footer-spacer" />
        <button
          className="people-danger"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy
            ? "Removing..."
            : removal.kind === "friend"
              ? "Remove friend"
              : "Delete group"}
        </button>
      </div>
    </PeopleDialog>
  );
}

function PeopleDialog({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-people-initial-focus]")?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
      else
        document
          .querySelector<HTMLElement>('.people-modes [aria-selected="true"]')
          ?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="people-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="people-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="people-icon-button"
          type="button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function FriendMenu({
  name,
  disabled,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      className="people-row-menu"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={`Actions for ${name}`}
        className="people-icon-button"
      >
        <MoreHorizontal size={18} />
      </summary>
      <div>
        <button
          disabled={disabled}
          onClick={() => {
            if (ref.current) {
              ref.current.open = false;
              ref.current.querySelector("summary")?.focus();
            }
            onRemove();
          }}
        >
          <Trash2 size={14} />
          Remove friend
        </button>
      </div>
    </details>
  );
}
function Notice({ notice }: { notice: PopupPeopleActionNotice }) {
  return (
    <div
      className="popup-people-action-notice"
      data-action-key={notice.actionKey}
      data-tone={notice.tone}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      {notice.text}
    </div>
  );
}
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="people-empty" data-state="empty">
      {children}
    </div>
  );
}
function ProfileAvatar({ profile }: { profile: PopupPeopleProfile }) {
  return profile.avatarUrl ? (
    <img
      className="people-avatar"
      src={profile.avatarUrl}
      alt=""
      loading="lazy"
    />
  ) : (
    <span className="people-avatar">
      {profile.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "A"}
    </span>
  );
}
function matches(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query);
}
function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

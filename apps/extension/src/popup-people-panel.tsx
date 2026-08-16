import type { SocialDirectory } from "@anidachi/protocol";
import { FolderPlus, RefreshCw, UserPlus, Users } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  buildPopupPeopleModel,
  type PopupPeopleFriend,
  type PopupPeopleGroup,
  type PopupPeopleProfile,
  type PopupPeopleRecentPerson,
} from "./popup-people-model";

export type PopupPeoplePresentationState =
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; errorMessage: string }>
  | Readonly<{ status: "ready"; directory: SocialDirectory }>
  | Readonly<{ status: "stale"; directory: SocialDirectory }>
  | Readonly<{ status: "stale-error"; directory: SocialDirectory; errorMessage: string }>;

export type PopupPeopleActionKey = "create-group" | `add-friend:${string}`;

export type PopupPeopleActionNotice = Readonly<{
  actionKey: PopupPeopleActionKey;
  tone: "success" | "warning" | "error";
  text: string;
}>;

export type PopupPeoplePanelProps = {
  actionNotice: PopupPeopleActionNotice | null;
  pendingActionKey: PopupPeopleActionKey | null;
  onAddFriend: (userId: string) => Promise<boolean>;
  onCreateGroup: (name: string, clientRequestId: string) => Promise<boolean>;
  onOpenDashboard: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  state: PopupPeoplePresentationState;
};

type PopupPeopleMode = "friends" | "groups";

export function PopupPeoplePanel({
  actionNotice,
  pendingActionKey,
  onAddFriend,
  onCreateGroup,
  onOpenDashboard,
  onRefresh,
  onSignIn,
  state,
}: PopupPeoplePanelProps) {
  const [mode, setMode] = useState<PopupPeopleMode>("friends");
  const model = stateHasDirectory(state) ? buildPopupPeopleModel(state.directory) : null;
  const showsStaleData = state.status === "stale" || state.status === "stale-error";

  return (
    <section className="popup-section popup-people-panel" aria-label="People">
      <div className="popup-section-header">
        <div className="popup-section-title">People</div>
        <button
          aria-label="Refresh people"
          className="popup-mini-button"
          disabled={state.status === "loading"}
          title="Refresh people"
          type="button"
          onClick={onRefresh}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div aria-label="People mode" className="popup-people-mode-tabs" role="tablist">
        <PeopleModeButton active={mode === "friends"} label="Friends" onClick={() => setMode("friends")} />
        <PeopleModeButton active={mode === "groups"} label="Groups" onClick={() => setMode("groups")} />
      </div>

      <div className="popup-people-content" data-presentation-state={state.status}>
        {state.status === "signed-out" ? (
          <div className="popup-people-state" data-state="signed-out">
            <Users size={17} />
            <span>Sign in to see your people.</span>
            <button className="popup-primary-button" type="button" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : null}

        {state.status === "loading" ? (
          <div className="popup-people-state" data-state="loading">
            Loading people...
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="popup-people-state" data-state="error">
            <span>{state.errorMessage}</span>
            <button className="popup-primary-button" type="button" onClick={onRefresh}>
              Retry
            </button>
          </div>
        ) : null}

        {showsStaleData ? (
          <div
            className="popup-people-status"
            data-state={state.status === "stale-error" ? "error" : "stale"}
            role="status"
          >
            <span>
              {state.status === "stale-error"
                ? state.errorMessage
                : "Showing saved people while we reconnect."}
            </span>
            {state.status === "stale-error" ? (
              <button className="popup-secondary-button" type="button" onClick={onRefresh}>
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {model ? (
          mode === "friends" ? (
            <FriendsMode
              friends={model.friends}
              pendingActionKey={pendingActionKey}
              recentPeople={model.recentPeople}
              onAddFriend={onAddFriend}
            />
          ) : (
            <GroupsMode
              groups={model.groups}
              pendingActionKey={pendingActionKey}
              onCreateGroup={onCreateGroup}
            />
          )
        ) : null}
      </div>

      <div aria-atomic="true" aria-live="polite" className="popup-people-action-notice-slot">
        {actionNotice ? (
          <div
            className="popup-people-action-notice"
            data-action-key={actionNotice.actionKey}
            data-tone={actionNotice.tone}
            role="status"
          >
            {actionNotice.text}
          </div>
        ) : null}
      </div>

      <button className="popup-dashboard-button" type="button" onClick={onOpenDashboard}>
        Open dashboard
      </button>
    </section>
  );
}

function stateHasDirectory(
  state: PopupPeoplePresentationState,
): state is Extract<PopupPeoplePresentationState, { directory: SocialDirectory }> {
  return state.status === "ready" || state.status === "stale" || state.status === "stale-error";
}

function PeopleModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button aria-selected={active} className="popup-people-mode-button" role="tab" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function FriendsMode({
  friends,
  pendingActionKey,
  recentPeople,
  onAddFriend,
}: {
  friends: readonly PopupPeopleFriend[];
  pendingActionKey: PopupPeopleActionKey | null;
  recentPeople: readonly PopupPeopleRecentPerson[];
  onAddFriend: (userId: string) => Promise<boolean>;
}) {
  return (
    <div className="popup-people-list">
      <PeopleHeading count={friends.length} label="Friends" />
      {friends.length ? (
        friends.map((friend) => <PersonRow key={friend.user.userId} profile={friend.user} />)
      ) : (
        <div className="popup-people-empty" data-state="empty">No friends yet.</div>
      )}

      {recentPeople.length ? (
        <div className="popup-people-recent">
          <PeopleHeading count={recentPeople.length} label="Watched with recently" />
          {recentPeople.map((person) => {
            const actionKey = addFriendActionKey(person.user.userId);
            const pending = pendingActionKey === actionKey;
            return (
              <PersonRow
                action={
                  <button
                    className="popup-people-add-button"
                    disabled={pending}
                    type="button"
                    onClick={async () => {
                      if (pending) return;
                      try {
                        await onAddFriend(person.user.userId);
                      } catch {
                        // The parent owns the visible action error state.
                      }
                    }}
                  >
                    {pending ? <RefreshCw size={13} /> : <UserPlus size={13} />}
                    {pending ? "Adding..." : "Add friend"}
                  </button>
                }
                key={person.user.userId}
                profile={person.user}
                subtitle={formatRecentSubtitle(person.lastWatchedAt)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatRecentSubtitle(lastWatchedAt: string): string {
  const date = new Date(lastWatchedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? "recently"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Watched ${dateLabel}`;
}

function GroupsMode({
  groups,
  pendingActionKey,
  onCreateGroup,
}: {
  groups: readonly PopupPeopleGroup[];
  pendingActionKey: PopupPeopleActionKey | null;
  onCreateGroup: (name: string, clientRequestId: string) => Promise<boolean>;
}) {
  const createPending = pendingActionKey === "create-group";
  const requestRef = useRef<{ name: string; clientRequestId: string } | null>(null);

  const submitCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("group-name");
    if (createPending || typeof name !== "string" || !name.trim()) return;
    const normalizedName = name.trim();
    const pendingRequest = requestRef.current?.name === normalizedName
      ? requestRef.current
      : { name: normalizedName, clientRequestId: crypto.randomUUID() };
    requestRef.current = pendingRequest;
    try {
      if (await onCreateGroup(normalizedName, pendingRequest.clientRequestId)) {
        requestRef.current = null;
        form.reset();
      }
    } catch {
      // The parent owns the visible action error state.
    }
  };

  return (
    <div className="popup-people-list">
      <form className="popup-people-create-form" onSubmit={submitCreateGroup}>
        <label className="popup-sr-only" htmlFor="popup-people-group-name">Group name</label>
        <input
          disabled={createPending}
          id="popup-people-group-name"
          maxLength={80}
          name="group-name"
          placeholder="New group"
          required
        />
        <button
          aria-label="Create group"
          className="popup-people-create-button"
          disabled={createPending}
          type="submit"
        >
          {createPending ? <RefreshCw size={13} /> : <FolderPlus size={13} />}
          {createPending ? "Creating..." : "Create"}
        </button>
      </form>

      <PeopleHeading count={groups.length} label="Groups" />
      {groups.length ? (
        groups.map((group) => <GroupSummary group={group} key={group.id} />)
      ) : (
        <div className="popup-people-empty" data-state="empty">No groups yet.</div>
      )}
    </div>
  );
}

function PeopleHeading({ count, label }: { count: number; label: string }) {
  return (
    <div className="popup-people-heading">
      <span>{label}</span>
      <span>{count}</span>
    </div>
  );
}

function PersonRow({
  action,
  profile,
  subtitle,
}: {
  action?: React.ReactNode;
  profile: PopupPeopleProfile;
  subtitle?: string;
}) {
  return (
    <div className="popup-people-row">
      <ProfileAvatar profile={profile} />
      <span className="popup-people-row-main">
        <span>{profile.displayName}</span>
        <span>{subtitle ?? (profile.handle ? `@${profile.handle}` : "AniDachi user")}</span>
      </span>
      {action}
    </div>
  );
}

function GroupSummary({ group }: { group: PopupPeopleGroup }) {
  const memberCount = group.members.length;
  return (
    <div className="popup-people-row popup-people-group-row">
      <span className="popup-people-group-icon"><Users size={15} /></span>
      <span className="popup-people-row-main">
        <span>{group.name}</span>
        <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
      </span>
    </div>
  );
}

function ProfileAvatar({ profile }: { profile: PopupPeopleProfile }) {
  if (profile.avatarUrl) return <img alt="" className="popup-people-avatar" loading="lazy" src={profile.avatarUrl} />;
  return <span className="popup-people-avatar">{initials(profile.displayName)}</span>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function addFriendActionKey(userId: string): PopupPeopleActionKey {
  return `add-friend:${userId}`;
}

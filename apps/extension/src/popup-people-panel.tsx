import type { FriendGroup, FriendListItem, PublicProfile, RecentPerson, SocialDirectory } from "@anidachi/protocol";
import { FolderPlus, RefreshCw, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { buildPopupPeopleModel } from "./popup-people-model";

export type PopupPeoplePanelStatus = "signed-out" | "loading" | "ready" | "error";

export type PopupPeoplePanelProps = {
  directory: SocialDirectory | null;
  errorMessage?: string;
  isStale?: boolean;
  onAddFriend: (userId: string) => void;
  onCreateGroup: (name: string) => void;
  onOpenDashboard: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  status: PopupPeoplePanelStatus;
};

type PopupPeopleMode = "friends" | "groups";

export function PopupPeoplePanel({
  directory,
  errorMessage = "Unable to load people.",
  isStale = false,
  onAddFriend,
  onCreateGroup,
  onOpenDashboard,
  onRefresh,
  onSignIn,
  status,
}: PopupPeoplePanelProps) {
  const [mode, setMode] = useState<PopupPeopleMode>("friends");
  const model = directory ? buildPopupPeopleModel(directory) : null;
  const hasUsableDirectory = status !== "signed-out" && model !== null;
  const showsStaleData = hasUsableDirectory && (isStale || status === "error" || status === "loading");

  return (
    <section className="popup-section popup-people-panel" aria-label="People">
      <div className="popup-section-header">
        <div className="popup-section-title">People</div>
        <button
          aria-label="Refresh people"
          className="popup-mini-button"
          disabled={status === "loading"}
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

      {status === "signed-out" ? (
        <div className="popup-people-state" data-state="signed-out">
          <Users size={17} />
          <span>Sign in to see your people.</span>
          <button className="popup-primary-button" type="button" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      ) : null}

      {status === "loading" && !model ? (
        <div className="popup-people-state" data-state="loading">
          Loading people...
        </div>
      ) : null}

      {status === "error" && !model ? (
        <div className="popup-people-state" data-state="error">
          <span>{errorMessage}</span>
          <button className="popup-primary-button" type="button" onClick={onRefresh}>
            Retry
          </button>
        </div>
      ) : null}

      {showsStaleData ? (
        <div className="popup-people-status" data-state={status === "error" ? "error" : "stale"} role="status">
          <span>{status === "error" ? errorMessage : "Showing saved people while we reconnect."}</span>
          {status === "error" ? (
            <button className="popup-secondary-button" type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {hasUsableDirectory && model ? (
        mode === "friends" ? (
          <FriendsMode friends={model.friends} recentPeople={model.recentPeople} onAddFriend={onAddFriend} />
        ) : (
          <GroupsMode groups={model.groups} onCreateGroup={onCreateGroup} />
        )
      ) : null}

      <button className="popup-dashboard-button" type="button" onClick={onOpenDashboard}>
        Open dashboard
      </button>
    </section>
  );
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
  recentPeople,
  onAddFriend,
}: {
  friends: readonly FriendListItem[];
  recentPeople: readonly RecentPerson[];
  onAddFriend: (userId: string) => void;
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
          {recentPeople.map((person) => (
            <PersonRow
              action={
                <button className="popup-people-add-button" type="button" onClick={() => onAddFriend(person.user.userId)}>
                  <UserPlus size={13} />
                  Add friend
                </button>
              }
              key={person.user.userId}
              profile={person.user}
              subtitle={`${person.sharedRoomCount} shared ${person.sharedRoomCount === 1 ? "room" : "rooms"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GroupsMode({ groups, onCreateGroup }: { groups: readonly FriendGroup[]; onCreateGroup: (name: string) => void }) {
  const submitCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("group-name");
    if (typeof name !== "string" || !name.trim()) return;
    onCreateGroup(name.trim());
    form.reset();
  };

  return (
    <div className="popup-people-list">
      <form className="popup-people-create-form" onSubmit={submitCreateGroup}>
        <label className="popup-sr-only" htmlFor="popup-people-group-name">Group name</label>
        <input id="popup-people-group-name" maxLength={80} name="group-name" placeholder="New group" required />
        <button aria-label="Create group" className="popup-people-create-button" type="submit">
          <FolderPlus size={13} />
          Create
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

function PersonRow({ action, profile, subtitle }: { action?: React.ReactNode; profile: PublicProfile; subtitle?: string }) {
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

function GroupSummary({ group }: { group: FriendGroup }) {
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

function ProfileAvatar({ profile }: { profile: PublicProfile }) {
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

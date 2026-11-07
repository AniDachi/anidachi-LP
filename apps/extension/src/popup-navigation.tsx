export type PopupTab = "resources" | "friends" | "inbox";

export function PopupNavigation({
  activeTab,
  inboxUnseenCount = 0,
  onSelect,
}: {
  activeTab: PopupTab;
  inboxUnseenCount?: number;
  onSelect: (tab: PopupTab) => void;
}) {
  return (
    <div className="popup-tabs" role="tablist" aria-label="Popup sections">
      <PopupNavigationButton
        active={activeTab === "resources"}
        label="Watch"
        onClick={() => onSelect("resources")}
      />
      <PopupNavigationButton
        active={activeTab === "friends"}
        label="People"
        onClick={() => onSelect("friends")}
      />
      <PopupNavigationButton
        active={activeTab === "inbox"}
        label="Inbox"
        unseenCount={inboxUnseenCount}
        onClick={() => onSelect("inbox")}
      />
    </div>
  );
}

function PopupNavigationButton({
  active,
  label,
  unseenCount = 0,
  onClick,
}: {
  active: boolean;
  label: string;
  unseenCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      aria-label={unseenCount > 0 ? `${label}, ${unseenCount} unread ${unseenCount === 1 ? "invitation" : "invitations"}` : undefined}
      className="popup-tab"
      data-active={active}
      role="tab"
      type="button"
      onClick={onClick}
    >
      <span className="popup-tab-copy">
        <span className="popup-tab-label">{label}</span>
        {unseenCount > 0 && (
          <span className="popup-tab-count" aria-hidden="true">{Math.min(unseenCount, 99)}</span>
        )}
      </span>
    </button>
  );
}

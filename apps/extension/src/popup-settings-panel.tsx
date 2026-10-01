import { Bell, History, X } from "lucide-react";
import { PopupHistoryRecordingChoice } from "./popup-history-recording-choice";
import { PopupHistorySettings } from "./popup-history-settings";
import { PopupSettingRow } from "./popup-setting-row";
import type { RoomInviteNotificationStatus } from "./room-invite-notifications";

export function PopupSettingsPanel({ ownerUserId, notifications, notificationsBusy, notificationsError, onToggleNotifications, onClose }: {
  ownerUserId: string | null;
  notifications: RoomInviteNotificationStatus | null;
  notificationsBusy: boolean;
  notificationsError: string | null;
  onToggleNotifications: () => void;
  onClose: () => void;
}) {
  const notificationDescription = !notifications
    ? notificationsError ? "Reopen Settings to try again." : "Loading notification settings…"
    : !notifications.supported ? "Not available in this browser."
    : !notifications.configured ? "Not available in this build."
    : "Room invites and friend requests in Chrome.";
  return (
    <section className="popup-local-settings" aria-label="Extension settings">
      <header className="popup-local-settings-heading">
        <h2>Settings</h2>
        <button type="button" aria-label="Close settings" className="popup-local-settings-close" onClick={onClose}>
          <X size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>
      <section className="popup-settings-group" aria-label="Watch history">
        <h3><History size={18} strokeWidth={1.7} aria-hidden="true" />Watch history</h3>
        {ownerUserId ? <>
          <PopupHistoryRecordingChoice ownerUserId={ownerUserId} />
          <PopupHistorySettings ownerUserId={ownerUserId} />
          <p className="popup-settings-note">Turning history off keeps your saved progress.</p>
        </> : <p className="popup-settings-note">Sign in to manage your watch history.</p>}
      </section>
      <section className="popup-settings-group" aria-label="Notifications">
        <h3><Bell size={18} strokeWidth={1.7} aria-hidden="true" />Notifications</h3>
        <PopupSettingRow label="Invitation notifications" description={notificationDescription}
          checked={notifications?.enabled ?? false} busy={notificationsBusy}
          disabled={!notifications?.supported || !notifications.configured} onChange={onToggleNotifications} />
        {notificationsError && <p className="popup-local-settings-error" role="alert">{notificationsError}</p>}
      </section>
    </section>
  );
}

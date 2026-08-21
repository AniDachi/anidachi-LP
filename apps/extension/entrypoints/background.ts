import { defineBackground } from "wxt/utils/define-background";
import {
  handleAccountInboxHttpMessage,
  isAccountInboxHttpMessage,
} from "../src/account-inbox-client";
import {
  handleAuthMessage,
  handleWebsiteAuthCookieChange,
  isAuthMessage,
  reconcileExtensionSessionAgainstWebsite,
} from "../src/auth-client";
import {
  AUTH_TOKENS_STORAGE_KEY,
  normalizeExtensionAuthTokens,
} from "../src/auth-tokens";
import { handleDiagnosticMessage, isDiagnosticMessage } from "../src/diagnostic-log";
import {
  clearPrivilegedOverlayContextForTab,
  handlePrivilegedOverlayIntentMessage,
  isPrivilegedOverlayIntentMessage,
} from "../src/privileged-overlay-intent";
import { handleRoomHttpMessage, isRoomHttpMessage } from "../src/room-client";
import {
  createRoomInviteNotificationMaintenanceAlarm,
  handleAuthSessionChanged,
  handleRoomInviteNotificationPermissionRemoved,
  handleRoomInviteNotificationClick,
  handleRoomInviteNotificationMessage,
  handleRoomInvitePush,
  isRoomInviteNotificationMaintenanceAlarm,
  isRoomInviteNotificationMessage,
  reconcileRoomInviteNotifications,
} from "../src/room-invite-notifications";
import {
  handleRoomSessionStorageRuntimeMessage,
  removeRoomSessionForTab,
} from "../src/room-session-storage";
import { handleSocialHttpMessage, isSocialHttpMessage } from "../src/social-client";
import {
  flushWatchHistoryInBackground,
  handleWatchHistoryAuthSessionChange,
  handleWatchHistoryHttpMessage,
  isWatchHistoryMessage,
  reconcileWatchHistoryThenDrain,
} from "../src/watch-history-client";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (handleRoomSessionStorageRuntimeMessage(message, sender, sendResponse)) {
      return true;
    }

    if (isPrivilegedOverlayIntentMessage(message)) {
      void handlePrivilegedOverlayIntentMessage(message, sender).then(
        sendResponse,
        (error) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Privileged overlay action failed",
          }),
      );
      return true;
    }

    if (isAuthMessage(message)) {
      void handleAuthMessage(message).then(sendResponse);
      return true;
    }

    if (isRoomInviteNotificationMessage(message)) {
      void handleRoomInviteNotificationMessage(message).then(sendResponse);
      return true;
    }

    if (isRoomHttpMessage(message)) {
      void handleRoomHttpMessage(message).then(sendResponse);
      return true;
    }

    if (isSocialHttpMessage(message)) {
      void handleSocialHttpMessage(message).then(sendResponse);
      return true;
    }

    if (isAccountInboxHttpMessage(message)) {
      void handleAccountInboxHttpMessage(message).then(sendResponse);
      return true;
    }

    if (isWatchHistoryMessage(message)) {
      void handleWatchHistoryHttpMessage(message).then(sendResponse);
      return true;
    }

    if (isDiagnosticMessage(message)) {
      void handleDiagnosticMessage(message).then(sendResponse);
      return true;
    }

    return false;
  });

  chrome.cookies?.onChanged?.addListener((changeInfo) => {
    void handleWebsiteAuthCookieChange(changeInfo);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[AUTH_TOKENS_STORAGE_KEY]) return;
    const change = changes[AUTH_TOKENS_STORAGE_KEY];
    const previous = normalizeExtensionAuthTokens(change.oldValue);
    const next = normalizeExtensionAuthTokens(change.newValue);
    void handleWatchHistoryAuthSessionChange(previous, next).catch(() => undefined);
    void handleAuthSessionChanged(
      previous,
      next,
    ).catch(() => undefined);
  });

  workerScope().addEventListener("push", (event) => {
    event.waitUntil(handleRoomInvitePush(event).catch(() => undefined));
  });
  workerScope().addEventListener("online", () => {
    void flushWatchHistoryInBackground().catch(() => undefined);
  });

  chrome.notifications?.onClicked?.addListener((notificationId) => {
    void handleRoomInviteNotificationClick(notificationId).catch(() => undefined);
  });

  chrome.permissions.onRemoved.addListener((permissions) => {
    void handleRoomInviteNotificationPermissionRemoved(permissions).catch(() => undefined);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!isRoomInviteNotificationMaintenanceAlarm(alarm.name)) return;
    void reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
  });

  const reconcileStoredWebsiteSession = (notify: boolean) => {
    void reconcileWatchHistoryThenDrain(
      async () => {
        await reconcileExtensionSessionAgainstWebsite({ adoptIfMissing: false });
        await reconcileRoomInviteNotifications({ notify });
      },
      flushWatchHistoryInBackground,
    )
      .catch(() => undefined);
  };
  chrome.runtime.onStartup?.addListener(() => reconcileStoredWebsiteSession(true));
  chrome.runtime.onInstalled?.addListener(() => reconcileStoredWebsiteSession(false));

  void createRoomInviteNotificationMaintenanceAlarm().catch(() => undefined);

  chrome.tabs.onRemoved.addListener((tabId) => {
    clearPrivilegedOverlayContextForTab(tabId);
    void removeRoomSessionForTab(tabId).catch(() => undefined);
  });
});

type BackgroundPushEvent = {
  data?: { text: () => string } | null;
  waitUntil: (promise: Promise<unknown>) => void;
};

function workerScope(): {
  addEventListener: {
    (type: "push", listener: (event: BackgroundPushEvent) => void): void;
    (type: "online", listener: () => void): void;
  };
} {
  return self as unknown as {
    addEventListener: {
      (type: "push", listener: (event: BackgroundPushEvent) => void): void;
      (type: "online", listener: () => void): void;
    };
  };
}

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
  handlePrivilegedOverlayIntentMessage,
  isPrivilegedOverlayIntentMessage,
  removePrivilegedRoomAuthorityStateForTab,
  type PrivilegedOverlayIntentDependencies,
} from "../src/privileged-overlay-intent";
import {
  cancelRoomAdmissionForDeparture,
  cancelRoomAdmissionForTab,
  clearRoomAuthorityRequestForTab,
  endWebsiteRoomFromApi,
  handleRoomHttpMessage,
  isRoomHttpMessage,
  type RoomAdmissionCompletion,
  type RoomHttpBackgroundDependencies,
} from "../src/room-client";
import {
  handleExactRoomSessionDepartureRuntime,
  handleRoomDepartureRuntimeMessage,
  handleRoomTabDeparture,
  isRoomDepartureRuntimeMessage,
  roomDepartureRuntimeResponse,
  type RoomTabDepartureDependencies,
  type RoomTabDepartureOutcome,
} from "../src/room-departure";
import {
  drainRoomDepartureRetries,
  handleRoomDepartureRetryAlarm,
  isRoomDepartureRetryAlarm,
} from "../src/room-departure-retry";
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
  clearRoomSessionForDepartureIfMatch,
  handleRoomSessionStorageRuntimeMessage,
} from "../src/room-session-storage";
import { handleSocialHttpMessage, isSocialHttpMessage } from "../src/social-client";
import {
  flushWatchHistoryInBackground,
  handleWatchHistoryAuthSessionChange,
  handleWatchHistoryHttpMessage,
  isWatchHistoryMessage,
  reconcileWatchHistoryThenDrain,
} from "../src/watch-history-client";

export interface PrivilegedRoomRuntimeDependencies {
  admissionDepartureTimeoutMs?: number;
  endRoom?: PrivilegedOverlayIntentDependencies["endRoom"];
  intentDependencies?: Omit<PrivilegedOverlayIntentDependencies, "endRoom">;
  roomDependencies?: RoomHttpBackgroundDependencies;
  departureDependencies?: RoomTabDepartureDependencies;
}

/** Keeps explicit leave responsive while a canceled Web admission settles. */
export const ROOM_ADMISSION_DEPARTURE_SETTLE_TIMEOUT_MS = 2_000;

export interface RemovedRoomTabDependencies {
  cancelRoomAdmission?: (tabId: number) => Promise<void> | null | void;
  clearRoomAuthorityRequest?: (tabId: number) => void;
  departRoom?: (tabId: number) => Promise<RoomTabDepartureOutcome>;
  removePrivilegedAuthority?: (tabId: number) => Promise<void>;
}

export async function handleRemovedRoomTab(
  tabId: number,
  dependencies: RemovedRoomTabDependencies = {},
): Promise<void> {
  const persistedAdmissionIntent = (
    dependencies.cancelRoomAdmission ?? cancelRoomAdmissionForTab
  )(tabId);
  (dependencies.clearRoomAuthorityRequest ?? clearRoomAuthorityRequestForTab)(tabId);
  try {
    await persistedAdmissionIntent;
    await (dependencies.departRoom ?? handleRoomTabDeparture)(tabId);
  } finally {
    await (
      dependencies.removePrivilegedAuthority ?? removePrivilegedRoomAuthorityStateForTab
    )(tabId);
  }
}

/** Narrow runtime route for room authority issuance and privileged room actions. */
export function dispatchPrivilegedRoomRuntimeMessage(
  message: unknown,
  sender: { tab?: { id?: number } },
  dependencies: PrivilegedRoomRuntimeDependencies = {},
): Promise<unknown> | null {
  if (isRoomDepartureRuntimeMessage(message)) {
    return dispatchRoomDepartureRuntimeMessage(message, sender, dependencies);
  }
  if (isPrivilegedOverlayIntentMessage(message)) {
    return handlePrivilegedOverlayIntentMessage(message, sender, {
      ...dependencies.intentDependencies,
      endRoom: dependencies.endRoom ?? endWebsiteRoomFromApi,
    });
  }
  if (isRoomHttpMessage(message)) {
    return handleRoomHttpMessage(message, sender, {
      ...dependencies.roomDependencies,
      cancelledAdmissionDepartureDependencies:
        dependencies.departureDependencies,
    });
  }
  return null;
}

async function dispatchRoomDepartureRuntimeMessage(
  message: Parameters<typeof handleRoomDepartureRuntimeMessage>[0],
  sender: { tab?: { id?: number } },
  dependencies: PrivilegedRoomRuntimeDependencies,
): Promise<unknown> {
  const tabId = sender.tab?.id;
  if (
    message.command !== "depart" ||
    !Number.isInteger(tabId) ||
    (tabId ?? -1) < 0
  ) {
    return handleRoomDepartureRuntimeMessage(
      message,
      sender,
      dependencies.departureDependencies,
    );
  }

  const cancelledAdmission = cancelRoomAdmissionForDeparture(
    tabId as number,
    message.participantSessionId,
    dependencies.roomDependencies?.admissionFence,
  );
  if (!cancelledAdmission) {
    return handleRoomDepartureRuntimeMessage(
      message,
      sender,
      dependencies.departureDependencies,
    );
  }

  try {
    await cancelledAdmission.intentPersisted;
  } catch {
    return roomDepartureRuntimeResponse("retryable");
  }

  clearRoomAuthorityRequestForTab(
    tabId as number,
    dependencies.roomDependencies?.authorityRequestSequences,
  );
  const record = {
    version: 1 as const,
    revision: 1,
    roomId: message.roomId,
    ownerUserId: message.expectedUserId,
    participantSessionId: message.participantSessionId,
    cameraEnabled: false,
    voiceMode: "push-to-talk" as const,
  };
  const departure = await handleExactRoomSessionDepartureRuntime(
    record,
    dependencies.departureDependencies,
  );
  if (!departure.ok) return departure;

  const completion = await waitForAdmissionCompletion(
    cancelledAdmission.completion,
    dependencies.admissionDepartureTimeoutMs,
  );
  if (completion?.kind !== "cleanup-confirmed") {
    return roomDepartureRuntimeResponse("retryable");
  }
  try {
    await clearRoomSessionForDepartureIfMatch(
      tabId as number,
      record,
      dependencies.roomDependencies?.roomSessionDependencies,
    );
  } catch {
    return roomDepartureRuntimeResponse("retryable");
  }
  return departure;
}

async function waitForAdmissionCompletion(
  completion: Promise<RoomAdmissionCompletion>,
  timeoutMs: number | undefined,
): Promise<RoomAdmissionCompletion | null> {
  const boundedTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(0, Math.floor(timeoutMs as number))
    : ROOM_ADMISSION_DEPARTURE_SETTLE_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), boundedTimeoutMs);
  });
  try {
    return await Promise.race([completion, timedOut]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (handleRoomSessionStorageRuntimeMessage(message, sender, sendResponse)) {
      return true;
    }

    const privilegedRoomResponse = dispatchPrivilegedRoomRuntimeMessage(message, sender);
    if (privilegedRoomResponse) {
      void privilegedRoomResponse.then(
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
    void drainRoomDepartureRetries({ force: true }).catch(() => undefined);
  });

  workerScope().addEventListener("push", (event) => {
    event.waitUntil(handleRoomInvitePush(event).catch(() => undefined));
  });
  workerScope().addEventListener("online", () => {
    void flushWatchHistoryInBackground().catch(() => undefined);
    void drainRoomDepartureRetries({ force: true }).catch(() => undefined);
  });

  chrome.notifications?.onClicked?.addListener((notificationId) => {
    void handleRoomInviteNotificationClick(notificationId).catch(() => undefined);
  });

  chrome.permissions.onRemoved.addListener((permissions) => {
    void handleRoomInviteNotificationPermissionRemoved(permissions).catch(() => undefined);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (isRoomDepartureRetryAlarm(alarm.name)) {
      void handleRoomDepartureRetryAlarm(alarm.name).catch(() => undefined);
      return;
    }
    if (!isRoomInviteNotificationMaintenanceAlarm(alarm.name)) return;
    void reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
  });

  const reconcileStoredWebsiteSession = (notify: boolean) => {
    void reconcileWatchHistoryThenDrain(
      async () => {
        await reconcileExtensionSessionAgainstWebsite({ adoptIfMissing: false });
        await reconcileRoomInviteNotifications({ notify });
        await drainRoomDepartureRetries({ force: true });
      },
      flushWatchHistoryInBackground,
    )
      .catch(() => undefined);
  };
  chrome.runtime.onStartup?.addListener(() => reconcileStoredWebsiteSession(true));
  chrome.runtime.onInstalled?.addListener(() => reconcileStoredWebsiteSession(false));

  void createRoomInviteNotificationMaintenanceAlarm().catch(() => undefined);
  void drainRoomDepartureRetries().catch(() => undefined);

  chrome.tabs.onRemoved.addListener((tabId) => {
    void handleRemovedRoomTab(tabId).catch(() => undefined);
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

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
import { handleDiagnosticMessage, isDiagnosticMessage } from "../src/diagnostic-log";
import { handleRoomHttpMessage, isRoomHttpMessage } from "../src/room-client";
import {
  handleRoomSessionStorageRuntimeMessage,
  removeRoomSessionForTab,
} from "../src/room-session-storage";
import { handleSocialHttpMessage, isSocialHttpMessage } from "../src/social-client";
import {
  handleWatchLibraryHttpMessage,
  isWatchLibraryHttpMessage,
} from "../src/watch-library-client";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (handleRoomSessionStorageRuntimeMessage(message, sender, sendResponse)) {
      return true;
    }

    if (isAuthMessage(message)) {
      void handleAuthMessage(message).then(sendResponse);
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

    if (isWatchLibraryHttpMessage(message)) {
      void handleWatchLibraryHttpMessage(message).then(sendResponse);
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

  const reconcileStoredWebsiteSession = () => {
    void reconcileExtensionSessionAgainstWebsite({
      adoptIfMissing: false,
    }).catch(() => undefined);
  };
  chrome.runtime.onStartup?.addListener(reconcileStoredWebsiteSession);
  chrome.runtime.onInstalled?.addListener(reconcileStoredWebsiteSession);

  chrome.tabs.onRemoved.addListener((tabId) => {
    void removeRoomSessionForTab(tabId).catch(() => undefined);
  });
});

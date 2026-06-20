import { defineBackground } from "wxt/utils/define-background";
import { handleAuthMessage, isAuthMessage } from "../src/auth-client";
import { handleRoomHttpMessage, isRoomHttpMessage } from "../src/room-client";
import { handleSocialHttpMessage, isSocialHttpMessage } from "../src/social-client";
import {
  handleWatchLibraryHttpMessage,
  isWatchLibraryHttpMessage,
} from "../src/watch-library-client";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    if (isWatchLibraryHttpMessage(message)) {
      void handleWatchLibraryHttpMessage(message).then(sendResponse);
      return true;
    }

    return false;
  });
});

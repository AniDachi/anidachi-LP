import { WEBSITE_PRESENCE, WebsitePresenceRequestSchema } from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import { isTrialWebsiteSender } from "./trial-installation";

export function websitePresenceReply(
  message: unknown,
  sender: { id?: string; url?: string; origin?: string; frameId?: number },
  origins: readonly string[],
) {
  if (!isTrialWebsiteSender(sender, origins) || !WebsitePresenceRequestSchema.safeParse(message).success) return null;
  return { type: WEBSITE_PRESENCE, installed: true as const };
}

export function registerWebsitePresence() {
  const origins = [new URL(WEB_HTTP_BASE).origin];
  chrome.runtime.onMessageExternal?.addListener((message, sender, respond) => {
    const response = websitePresenceReply(message, sender, origins);
    if (response) respond(response);
    return false;
  });
}

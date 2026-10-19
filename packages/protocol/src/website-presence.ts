import { z } from "zod";

/** Read-only installation hint. No account, trial authority or installation identity. */
export const WEBSITE_PRESENCE = "anidachi:website-presence:v1";
export const WebsitePresenceRequestSchema = z.object({ type: z.literal(WEBSITE_PRESENCE) }).strict();
export const WebsitePresenceResponseSchema = z.object({
  type: z.literal(WEBSITE_PRESENCE), installed: z.literal(true),
}).strict();

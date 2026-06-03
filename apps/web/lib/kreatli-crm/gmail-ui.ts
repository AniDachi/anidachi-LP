import { isGmailConfigured } from "./gmail";
import { isGmailConnected, readGmailTokens } from "./gmail-tokens";

export type GmailUiStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  /** When true, GOOGLE_GMAIL_SENDER_NAME is set; the API will try to sync Gmail "Send mail as" display name. */
  senderDisplayNameEnvSet: boolean;
  /** If set, GOOGLE_GMAIL_FROM_EMAIL overrides the OAuth profile address — must match a Gmail send-as entry. */
  fromEmailOverride?: string;
};

export async function getGmailUiStatus(): Promise<GmailUiStatus> {
  const configured = isGmailConfigured();
  const tokens = await readGmailTokens();
  const fromOverride = process.env.GOOGLE_GMAIL_FROM_EMAIL?.trim();
  return {
    configured,
    connected: isGmailConnected(tokens),
    email: tokens?.email,
    senderDisplayNameEnvSet: Boolean(process.env.GOOGLE_GMAIL_SENDER_NAME?.trim()),
    fromEmailOverride: fromOverride || undefined,
  };
}

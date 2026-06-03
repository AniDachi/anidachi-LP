import type { OAuth2Client } from "google-auth-library";
import { google, type gmail_v1 } from "googleapis";
import { mergeGmailTokens, readGmailTokens } from "./gmail-tokens";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
/** Required so Gmail applies `GOOGLE_GMAIL_SENDER_NAME` (Gmail ignores MIME From display name for API sends). */
const GMAIL_SETTINGS_BASIC_SCOPE =
  "https://www.googleapis.com/auth/gmail.settings.basic";

export const GMAIL_OAUTH_SCOPES = [GMAIL_SEND_SCOPE, GMAIL_SETTINGS_BASIC_SCOPE];

export function getGmailRedirectUri(origin: string): string {
  const env = process.env.GOOGLE_GMAIL_REDIRECT_URI?.replace(/\/$/, "");
  if (env) return env;
  return `${origin.replace(/\/$/, "")}/api/kreatli-crm/gmail/callback`;
}

export function createGmailOAuth2(redirectUri: string): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function gmailAuthUrl(oauth2: OAuth2Client, state: string) {
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_OAUTH_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(
  oauth2: OAuth2Client,
  code: string
) {
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

async function getGmailClient(redirectUri: string) {
  const oauth2 = createGmailOAuth2(redirectUri);
  if (!oauth2) return null;
  const stored = await readGmailTokens();
  if (!stored?.refresh_token) return null;
  oauth2.setCredentials(stored);
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  return { gmail, oauth2 };
}

export async function fetchGmailProfileEmail(redirectUri: string): Promise<string | undefined> {
  const pair = await getGmailClient(redirectUri);
  if (!pair) return undefined;
  try {
    const res = await pair.gmail.users.getProfile({ userId: "me" });
    return res.data.emailAddress ?? undefined;
  } catch {
    return undefined;
  }
}

/** RFC 5322 + RFC 2047: display name + angle-addr for From */
function formatFromHeader(displayName: string, mailbox: string): string {
  const trimmed = displayName.trim();
  const asciiSafe = /^[\x20-\x7E]*$/.test(trimmed) && !/["\\]/.test(trimmed);
  const encodedName = asciiSafe
    ? `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : `=?UTF-8?B?${Buffer.from(trimmed, "utf8").toString("base64")}?=`;
  return `From: ${encodedName} <${mailbox}>`;
}

/**
 * Gmail’s send API uses the account’s “Send mail as” display name, not the raw MIME From phrase.
 * Patch the matching send-as row when `GOOGLE_GMAIL_SENDER_NAME` is set (exact address match only).
 */
async function trySyncSendAsDisplayName(
  gmail: gmail_v1.Gmail,
  sendAsEmail: string,
  displayName: string
): Promise<string | undefined> {
  try {
    const list = await gmail.users.settings.sendAs.list({ userId: "me" });
    const aliases = list.data.sendAs ?? [];
    const lower = sendAsEmail.toLowerCase();
    const entry = aliases.find(
      (a) => (a.sendAsEmail ?? "").toLowerCase() === lower
    );
    if (!entry?.sendAsEmail) {
      return `No Gmail "Send mail as" entry matches ${sendAsEmail}. Check the connected account or GOOGLE_GMAIL_FROM_EMAIL.`;
    }
    if (entry.displayName === displayName) return undefined;
    await gmail.users.settings.sendAs.patch({
      userId: "me",
      sendAsEmail: entry.sendAsEmail,
      requestBody: { displayName },
    });
    return undefined;
  } catch {
    return (
      "Could not update your Gmail send-as name. Disconnect Gmail on the CRM page, connect again " +
      "(to grant Mail settings access), or set the name in Gmail → Settings → See all settings → " +
      "Accounts → Send mail as."
    );
  }
}

export type SendPlaintextEmailResult = {
  id?: string | null;
  threadId?: string | null;
  /** Present when sender name could not be synced to Gmail settings (reconnect OAuth or set name in Gmail). */
  senderNameNote?: string;
  /** Dev-only: From address Gmail used for this send (compare to Show original on the received message). */
  fromMailbox?: string;
};

export async function sendPlaintextEmail(
  redirectUri: string,
  params: { to: string; subject: string; body: string }
): Promise<SendPlaintextEmailResult> {
  const pair = await getGmailClient(redirectUri);
  if (!pair) {
    throw new Error("Gmail not connected");
  }
  const { gmail, oauth2 } = pair;

  const senderName = process.env.GOOGLE_GMAIL_SENDER_NAME?.trim();
  const fromOverride = process.env.GOOGLE_GMAIL_FROM_EMAIL?.trim();
  const stored = await readGmailTokens();
  const fromMailbox =
    fromOverride ||
    stored?.email ||
    (await fetchGmailProfileEmail(redirectUri));

  let senderNameNote: string | undefined;
  if (senderName && fromMailbox) {
    senderNameNote = await trySyncSendAsDisplayName(gmail, fromMailbox, senderName);
  }

  const subjectB64 = Buffer.from(params.subject, "utf8").toString("base64");
  const subjectHeader = `=?UTF-8?B?${subjectB64}?=`;

  const headers: string[] = [];
  if (senderName && fromMailbox) {
    headers.push(formatFromHeader(senderName, fromMailbox));
  }

  const message = [
    ...headers,
    `To: ${params.to}`,
    `Subject: ${subjectHeader}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body,
  ].join("\r\n");

  const raw = Buffer.from(message, "utf8").toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  const creds = oauth2.credentials;
  if (creds.access_token && creds.expiry_date) {
    await mergeGmailTokens({
      access_token: creds.access_token,
      expiry_date: creds.expiry_date,
    });
  }

  return {
    id: res.data.id,
    threadId: res.data.threadId,
    senderNameNote,
    ...(process.env.NODE_ENV === "development" && fromMailbox
      ? { fromMailbox }
      : {}),
  };
}

export { GMAIL_SEND_SCOPE, GMAIL_SETTINGS_BASIC_SCOPE };

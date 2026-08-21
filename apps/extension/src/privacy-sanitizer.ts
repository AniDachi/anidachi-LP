const SECRET_FIELD_RE = /token|secret|cookie|authorization|password|credential|icepwd|attestation/i;

const USER_AUTHORED_CONTENT_FIELDS = new Set([
  "comment",
  "content",
  "displayName",
  "emoji",
  "episodeTitle",
  "groupName",
  "label",
  "message",
  "name",
  "reaction",
  "seasonTitle",
  "seriesTitle",
  "sourceTitle",
  "text",
  "title",
  "userText",
]);

const STABLE_PSEUDONYM_FIELDS = new Set([
  "email",
  "fingerprint",
  "sourceFingerprint",
  "targetKey",
  "username",
  "videoFingerprint",
]);

const STABLE_PSEUDONYM_KEY_RE = /(?:fingerprint|targetKey)$/i;

const HASH_IDENTIFIER_FIELDS = new Set([
  "id",
  "roomId",
  "userId",
  "ownerUserId",
  "authUserId",
  "participantId",
  "participantSessionId",
  "localParticipantId",
  "remoteUserId",
  "targetUserId",
  "fromUserId",
  "toUserId",
  "byUserId",
  "sessionId",
  "clientSignalId",
  "clientActionId",
  "senderConnectionId",
  "senderMediaSessionId",
  "mediaSessionId",
  "currentSenderConnectionId",
  "incomingSenderConnectionId",
  "previousSenderConnectionId",
  "nextSenderConnectionId",
  "currentSenderMediaSessionId",
  "incomingSenderMediaSessionId",
  "previousSenderMediaSessionId",
  "nextSenderMediaSessionId",
  "previousAuthUserId",
  "nextAuthUserId",
  "activeRoomId",
  "installId",
  "groupId",
]);

const HASH_IDENTIFIER_ARRAY_FIELDS = new Set([
  "activeSpeakerIds",
  "existingPeerIds",
  "participantIds",
  "remoteIds",
  "remoteAudioExpectedIds",
  "userIds",
]);

const HASH_IDENTIFIER_KEY_RE =
  /(?:room|user|participant|session|connection|signal|install|group|speaker|peer|friend|member|invite|request)Ids?$/i;

const MEDIA_IDENTIFIER_FIELDS = new Set([
  "deviceId",
  "mediaStreamId",
  "mediaTrackId",
  "streamId",
  "trackId",
]);

const RAW_MEDIA_FIELDS = new Set([
  "address",
  "candidate",
  "iceUfrag",
  "ip",
  "ipAddress",
  "msid",
  "sdp",
  "ssrc",
  "usernameFragment",
]);

const RAW_FRAME_FIELDS = new Set(["raw", "rawFrame", "rawMessage"]);

export function sanitizePrivacySafeData(value: unknown): unknown {
  const serialized = JSON.stringify(value, (key, item) => {
    if (USER_AUTHORED_CONTENT_FIELDS.has(key)) {
      return undefined;
    }

    if (SECRET_FIELD_RE.test(key)) {
      if (typeof item === "boolean" || typeof item === "number" || item === null) {
        return item;
      }
      return item === undefined ? item : "<redacted>";
    }

    if (RAW_FRAME_FIELDS.has(key)) {
      return item === undefined ? item : "<redacted-frame>";
    }

    if (RAW_MEDIA_FIELDS.has(key)) {
      return item === undefined ? item : "<redacted-media>";
    }

    if (MEDIA_IDENTIFIER_FIELDS.has(key)) {
      return item === undefined ? item : "<redacted-media-id>";
    }

    if (
      (STABLE_PSEUDONYM_FIELDS.has(key) || STABLE_PSEUDONYM_KEY_RE.test(key)) &&
      typeof item === "string"
    ) {
      return hashPrivacySafeId(item);
    }

    if (
      (HASH_IDENTIFIER_FIELDS.has(key) || HASH_IDENTIFIER_KEY_RE.test(key)) &&
      typeof item === "string"
    ) {
      return hashPrivacySafeId(item);
    }

    if (
      (HASH_IDENTIFIER_ARRAY_FIELDS.has(key) || HASH_IDENTIFIER_KEY_RE.test(key)) &&
      Array.isArray(item)
    ) {
      return item.map((entry) => (typeof entry === "string" ? hashPrivacySafeId(entry) : entry));
    }

    return typeof item === "string" ? sanitizePrivacySafeText(item) : item;
  });

  return serialized === undefined ? undefined : JSON.parse(serialized);
}

export function sanitizePrivacySafeText(value: string): string {
  if (looksLikeRawMediaPayload(value)) {
    return "<redacted-media>";
  }
  return redactNetworkAddress(redactPrivacySafeUrl(value));
}

export function hashPrivacySafeId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `id_${(hash >>> 0).toString(36)}`;
}

export function redactPrivacySafeUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    if (url.pathname === "/%3Credacted-media-source%3E") {
      return `${url.origin}/<redacted-media-source>`;
    }
    const providerPathname = redactProviderContentPath(url);
    const pathname = (providerPathname ?? url.pathname).replace(
      /\/(room|rooms|join|invite|invites)\/[^/]+/gi,
      (_match, route: string) => `/${route}/<redacted-id>`,
    );
    return `${url.origin}${pathname}`;
  } catch {
    return value;
  }
}

export function redactPrivacySafeMediaSourceUrl(value: string): string {
  if (!value) {
    return "";
  }

  if (/^blob:/i.test(value)) {
    try {
      const source = new URL(value.slice("blob:".length));
      if (source.protocol === "http:" || source.protocol === "https:") {
        return `blob:${source.origin}/<redacted-media-source>`;
      }
    } catch {
      // Malformed media URLs must fail closed instead of retaining opaque data.
    }
    return "blob:<redacted-media-source>";
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const source = new URL(value);
      return `${source.origin}/<redacted-media-source>`;
    } catch {
      // Malformed media URLs must fail closed instead of retaining opaque data.
    }
  }

  return "<redacted-media-source>";
}

function redactProviderContentPath(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();

  if (isHostOrSubdomain(hostname, "crunchyroll.com")) {
    const match = url.pathname.match(
      /^\/(?:(?<locale>[a-z]{2}(?:-[a-z]{2})?)\/)?watch\/[^/]+(?:\/[^/]*)?\/?$/i,
    );
    if (match) {
      const locale = match.groups?.locale;
      return `/${locale ? `${locale}/` : ""}watch/<redacted-id>`;
    }
  }

  if (isHostOrSubdomain(hostname, "youtu.be")) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 1) {
      return "/<redacted-id>";
    }
  }

  if (isHostOrSubdomain(hostname, "youtube.com")) {
    if (/^\/watch\/?$/i.test(url.pathname)) {
      return "/watch";
    }
    const pathMatch = url.pathname.match(/^\/(shorts|embed)\/[^/]+(?:\/.*)?$/i);
    if (pathMatch?.[1]) {
      return `/${pathMatch[1].toLowerCase()}/<redacted-id>`;
    }
  }

  if (isHostOrSubdomain(hostname, "youtube-nocookie.com")) {
    const embedMatch = url.pathname.match(/^\/embed\/[^/]+(?:\/.*)?$/i);
    if (embedMatch) {
      return "/embed/<redacted-id>";
    }
  }

  return null;
}

function isHostOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function looksLikeRawMediaPayload(value: string): boolean {
  return (
    /(?:^|[\s"'=:])v=0(?:[\r\n]|$)/i.test(value) ||
    /(?:^|[\s"'=:])a=(?:candidate|ice-ufrag|ice-pwd|fingerprint|msid|ssrc):/i.test(value) ||
    /(?:^|[\s"'=:])candidate:/i.test(value) ||
    /["'](?:candidate|sdp|icePwd|usernameFragment)["']\s*:/i.test(value)
  );
}

function redactNetworkAddress(value: string): string {
  return value
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<redacted-ip>")
    .replace(/\b(?:[a-f0-9]{1,4}:){2,}[a-f0-9:]{1,4}\b/gi, "<redacted-ip>")
    .replace(/\b[a-z0-9-]+\.local\b/gi, "<redacted-local>");
}

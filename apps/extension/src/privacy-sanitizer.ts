const SECRET_FIELD_RE = /token|secret|cookie|authorization|password|credential|icepwd/i;

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
    const pathname = url.pathname.replace(
      /\/(room|rooms|join|invite|invites)\/[^/]+/gi,
      (_match, route: string) => `/${route}/<redacted-id>`,
    );
    return `${url.origin}${pathname}${url.search ? "?<redacted>" : ""}${
      url.hash ? "#<redacted>" : ""
    }`;
  } catch {
    return value;
  }
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

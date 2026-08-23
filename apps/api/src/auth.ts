import { SignJWT, jwtVerify } from "jose";
import {
  MAX_DISPLAY_NAME_CHARS,
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_SESSION_ID_CHARS,
  MAX_URL_CHARS,
  ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
  ROOM_TOKEN_AUDIENCE,
  ROOM_TOKEN_ISSUER,
  RoomHistoryAttestationClaimsSchema,
  RoomCapabilitiesSchema,
  type RoomCapabilities,
} from "@anidachi/protocol";

export interface WorkerAuthEnv {
  ANIDACHI_JWT_SECRET?: string;
}

export interface VerifiedRoomToken {
  sub: string;
  roomId: string;
  role: "host" | "member";
  participantSessionId: string;
  capabilities?: RoomCapabilities;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface RoomHistoryAttestationClaims {
  sub: string;
  roomId: string;
  participantSessionId: string;
  roomGeneration: number;
  sourceGeneration: number;
}

function getSecret(env: WorkerAuthEnv): Uint8Array {
  const secret = env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function verifyRoomToken(
  token: string,
  expectedRoomId: string,
  env: WorkerAuthEnv,
): Promise<VerifiedRoomToken | null> {
  try {
    if (!isBoundedId(expectedRoomId, MAX_ROOM_ID_CHARS)) return null;
    const { payload } = await jwtVerify(token, getSecret(env), {
      algorithms: ["HS256"],
      issuer: ROOM_TOKEN_ISSUER,
      audience: ROOM_TOKEN_AUDIENCE,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (payload.typ !== "room") return null;
    if (!isBoundedId(payload.sub, MAX_PARTICIPANT_ID_CHARS)) return null;
    if (!isBoundedId(payload.roomId, MAX_ROOM_ID_CHARS) || payload.roomId !== expectedRoomId) {
      return null;
    }
    if (payload.role !== "host" && payload.role !== "member") return null;
    if (!isBoundedId(payload.participantSessionId, MAX_SESSION_ID_CHARS)) return null;
    const capabilities =
      payload.capabilities === undefined
        ? undefined
        : RoomCapabilitiesSchema.safeParse(payload.capabilities);
    if (capabilities !== undefined && !capabilities.success) return null;
    if (
      payload.displayName !== undefined &&
      !isBoundedId(payload.displayName, MAX_DISPLAY_NAME_CHARS)
    ) {
      return null;
    }
    if (
      payload.avatarUrl !== null &&
      payload.avatarUrl !== undefined &&
      !isBoundedUrl(payload.avatarUrl)
    ) {
      return null;
    }

    const verified: VerifiedRoomToken = {
      sub: payload.sub,
      roomId: payload.roomId,
      role: payload.role,
      participantSessionId: payload.participantSessionId,
      avatarUrl: payload.avatarUrl ?? null,
    };
    if (capabilities?.data) {
      verified.capabilities = capabilities.data;
    }
    if (payload.displayName) {
      verified.displayName = payload.displayName;
    }

    return verified;
  } catch {
    return null;
  }
}

export async function signRoomHistoryAttestation(
  claims: RoomHistoryAttestationClaims,
  env: WorkerAuthEnv,
): Promise<string> {
  if (
    !isBoundedId(claims.sub, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedId(claims.roomId, MAX_ROOM_ID_CHARS) ||
    !isBoundedId(claims.participantSessionId, MAX_SESSION_ID_CHARS) ||
    !isPositiveInteger(claims.roomGeneration) ||
    !isPositiveInteger(claims.sourceGeneration)
  ) {
    throw new Error("Invalid room history authority claims");
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  const signedClaims = RoomHistoryAttestationClaimsSchema.parse({
    typ: "room_history",
    iss: "anidachi-worker",
    aud: "anidachi-web-history",
    sub: claims.sub,
    roomId: claims.roomId,
    participantSessionId: claims.participantSessionId,
    roomGeneration: claims.roomGeneration,
    sourceGeneration: claims.sourceGeneration,
    iat: issuedAt,
    exp: issuedAt + ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
    jti: crypto.randomUUID(),
  });

  return new SignJWT({
    typ: signedClaims.typ,
    roomId: signedClaims.roomId,
    participantSessionId: signedClaims.participantSessionId,
    roomGeneration: signedClaims.roomGeneration,
    sourceGeneration: signedClaims.sourceGeneration,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(signedClaims.iss)
    .setAudience(signedClaims.aud)
    .setSubject(signedClaims.sub)
    .setIssuedAt(signedClaims.iat)
    .setExpirationTime(signedClaims.exp)
    .setJti(signedClaims.jti)
    .sign(getSecret(env));
}

function isBoundedId(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxChars;
}

function isBoundedUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_URL_CHARS &&
    URL.canParse(value)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export async function signRoomTokenForTest(
  params: VerifiedRoomToken,
  env: WorkerAuthEnv,
): Promise<string> {
  const claims: Record<string, unknown> = {
    roomId: params.roomId,
    role: params.role,
    participantSessionId: params.participantSessionId,
    avatarUrl: params.avatarUrl ?? null,
    typ: "room",
  };
  if (params.capabilities) {
    claims.capabilities = params.capabilities;
  }
  if (params.displayName) {
    claims.displayName = params.displayName;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.sub)
    .setIssuer(ROOM_TOKEN_ISSUER)
    .setAudience(ROOM_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getSecret(env));
}

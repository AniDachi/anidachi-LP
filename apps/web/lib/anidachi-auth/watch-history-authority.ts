import {
  ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
  RoomHistoryAttestationClaimsSchema,
  type RoomHistoryAttestationClaims,
  type WatchSharedRoomAuthority,
} from "@anidachi/protocol";
import { jwtVerify } from "jose";

const HISTORY_AUTHORITY_ISSUER = "anidachi-worker";
const HISTORY_AUTHORITY_AUDIENCE = "anidachi-web-history";
const HISTORY_AUTHORITY_TYPE = "room_history";

export type ValidatedWatchHistoryAuthority = RoomHistoryAttestationClaims;

export class WatchHistoryAuthorityError extends Error {
  readonly code = "INVALID_AUTHORITY" as const;

  constructor() {
    super("Shared room authority is invalid");
  }
}

function serverJwtSecret(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("Watch history authority is unavailable");
  return new TextEncoder().encode(secret);
}

export async function verifyWatchHistoryAuthority(params: {
  authenticatedUserId: string;
  authority: WatchSharedRoomAuthority;
  secret?: Uint8Array;
  now?: Date;
}): Promise<ValidatedWatchHistoryAuthority> {
  try {
    const { payload, protectedHeader } = await jwtVerify(
      params.authority.attestation,
      params.secret ?? serverJwtSecret(),
      {
        algorithms: ["HS256"],
        issuer: HISTORY_AUTHORITY_ISSUER,
        audience: HISTORY_AUTHORITY_AUDIENCE,
        requiredClaims: ["exp", "iat", "jti", "iss", "aud", "sub"],
        maxTokenAge: ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
        currentDate: params.now,
      },
    );
    const claims = RoomHistoryAttestationClaimsSchema.safeParse(payload);

    if (
      !claims.success ||
      Object.keys(protectedHeader).length !== 1 ||
      protectedHeader.alg !== "HS256" ||
      claims.data.typ !== HISTORY_AUTHORITY_TYPE ||
      claims.data.iss !== HISTORY_AUTHORITY_ISSUER ||
      claims.data.aud !== HISTORY_AUTHORITY_AUDIENCE ||
      claims.data.sub !== params.authenticatedUserId ||
      claims.data.roomId !== params.authority.roomId ||
      claims.data.participantSessionId !== params.authority.participantSessionId ||
      claims.data.roomGeneration !== params.authority.roomGeneration ||
      claims.data.sourceGeneration !== params.authority.sourceGeneration
    ) {
      throw new WatchHistoryAuthorityError();
    }

    return claims.data;
  } catch (error) {
    if (error instanceof WatchHistoryAuthorityError) throw error;
    throw new WatchHistoryAuthorityError();
  }
}

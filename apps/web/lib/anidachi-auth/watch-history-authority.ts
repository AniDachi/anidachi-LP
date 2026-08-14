import type { WatchSharedRoomAuthority } from "@anidachi/protocol";
import { jwtVerify } from "jose";

const HISTORY_AUTHORITY_ISSUER = "anidachi-worker";
const HISTORY_AUTHORITY_AUDIENCE = "anidachi-web-history";
const HISTORY_AUTHORITY_TYPE = "room_history";

export type ValidatedWatchHistoryAuthority = {
  sub: string;
  roomId: string;
  participantSessionId: string;
  roomGeneration: number;
  sourceGeneration: number;
  iat: number;
};

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
}): Promise<ValidatedWatchHistoryAuthority> {
  try {
    const { payload, protectedHeader } = await jwtVerify(
      params.authority.attestation,
      params.secret ?? serverJwtSecret(),
      {
        algorithms: ["HS256"],
        issuer: HISTORY_AUTHORITY_ISSUER,
        audience: HISTORY_AUTHORITY_AUDIENCE,
      },
    );
    const allowedClaims = new Set([
      "aud",
      "iat",
      "iss",
      "participantSessionId",
      "roomGeneration",
      "roomId",
      "sourceGeneration",
      "sub",
      "typ",
    ]);

    if (
      Object.keys(payload).length !== allowedClaims.size ||
      Object.keys(payload).some((claim) => !allowedClaims.has(claim)) ||
      protectedHeader.alg !== "HS256" ||
      payload.typ !== HISTORY_AUTHORITY_TYPE ||
      payload.iss !== HISTORY_AUTHORITY_ISSUER ||
      payload.aud !== HISTORY_AUTHORITY_AUDIENCE ||
      payload.sub !== params.authenticatedUserId ||
      typeof payload.roomId !== "string" ||
      typeof payload.participantSessionId !== "string" ||
      !isPositiveInteger(payload.roomGeneration) ||
      !isPositiveInteger(payload.sourceGeneration) ||
      typeof payload.iat !== "number" ||
      !Number.isInteger(payload.iat) ||
      payload.iat < 0 ||
      payload.roomId !== params.authority.roomId ||
      payload.participantSessionId !== params.authority.participantSessionId ||
      payload.roomGeneration !== params.authority.roomGeneration ||
      payload.sourceGeneration !== params.authority.sourceGeneration
    ) {
      throw new WatchHistoryAuthorityError();
    }

    return {
      sub: payload.sub,
      roomId: payload.roomId,
      participantSessionId: payload.participantSessionId,
      roomGeneration: payload.roomGeneration,
      sourceGeneration: payload.sourceGeneration,
      iat: payload.iat,
    };
  } catch (error) {
    if (error instanceof WatchHistoryAuthorityError) throw error;
    throw new WatchHistoryAuthorityError();
  }
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

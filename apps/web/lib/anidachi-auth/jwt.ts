import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { RoomSessionAdmissionInputSchema } from "@anidachi/protocol";
import {
  isRoomCapabilities,
  normalizePlanCode,
  type PlanCode,
  type RoomCapabilities,
} from "./plan-entitlements";
import { isAcceptedPlanCode } from "./plan-codes";
import { ACCESS_TOKEN_TTL_SECONDS } from "./token-policy";

export const ANIDACHI_AUTH_ISSUER = "anidachi-auth";
export const WEBSITE_ACCESS_AUDIENCE = "anidachi-web";
export const WEBSITE_ACCESS_TYPE = "website_access";

export function getJwtSecret(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

// ---------- Access token ----------

export type AccessTokenPayload = {
  sub: string; // userId
  email: string;
  plan: PlanCode;
};

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    plan: payload.plan,
    typ: WEBSITE_ACCESS_TYPE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ANIDACHI_AUTH_ISSUER)
    .setAudience(WEBSITE_ACCESS_AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: ANIDACHI_AUTH_ISSUER,
      audience: WEBSITE_ACCESS_AUDIENCE,
      requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
    });
    if (payload.aud !== WEBSITE_ACCESS_AUDIENCE) return null;
    if (payload.typ !== WEBSITE_ACCESS_TYPE) return null;
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email ||
      !payload.plan
    ) {
      return null;
    }
    if (!isAcceptedPlanCode(payload.plan)) return null;
    return {
      sub: payload.sub,
      email: payload.email as string,
      plan: normalizePlanCode(payload.plan),
    };
  } catch {
    return null;
  }
}

// ---------- Room token ----------

export type RoomTokenPayload = {
  sub: string; // userId
  roomId: string;
  role: "host" | "member";
  participantSessionId: string;
  capabilities?: RoomCapabilities;
  displayName?: string;
  avatarUrl?: string | null;
};

const ROOM_TOKEN_DEFAULT_TTL_SECONDS = 30 * 60;

export async function signRoomToken(
  payload: RoomTokenPayload,
  expiresInSeconds: number = ROOM_TOKEN_DEFAULT_TTL_SECONDS
): Promise<string> {
  const admission = RoomSessionAdmissionInputSchema.parse({
    participantSessionId: payload.participantSessionId,
  });
  // Free-plan hosts get tokens capped to their remaining daily quota (PD2);
  // the TTL can shrink but never exceed the standard room token life.
  const ttl = Math.max(
    1,
    Math.min(ROOM_TOKEN_DEFAULT_TTL_SECONDS, Math.floor(expiresInSeconds))
  );
  return new SignJWT({
    roomId: payload.roomId,
    role: payload.role,
    participantSessionId: admission.participantSessionId,
    capabilities: payload.capabilities,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl ?? null,
    typ: "room",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ANIDACHI_AUTH_ISSUER)
    .setSubject(payload.sub)
    .setAudience("anidachi-worker")
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getJwtSecret());
}

export async function verifyRoomToken(
  token: string
): Promise<RoomTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: ANIDACHI_AUTH_ISSUER,
      audience: "anidachi-worker",
      requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
    });
    if (payload.aud !== "anidachi-worker") return null;
    if (payload.typ !== "room") return null;
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.roomId !== "string" ||
      !payload.roomId ||
      payload.roomId.length > 128 ||
      !payload.role
    ) {
      return null;
    }
    if (payload.role !== "host" && payload.role !== "member") return null;
    const admission = RoomSessionAdmissionInputSchema.safeParse({
      participantSessionId: payload.participantSessionId,
    });
    if (!admission.success) return null;
    if (payload.capabilities !== undefined && !isRoomCapabilities(payload.capabilities)) {
      return null;
    }
    if (payload.displayName !== undefined && typeof payload.displayName !== "string") return null;
    if (
      payload.avatarUrl !== null &&
      payload.avatarUrl !== undefined &&
      typeof payload.avatarUrl !== "string"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      roomId: payload.roomId as string,
      role: payload.role,
      participantSessionId: admission.data.participantSessionId,
      capabilities: payload.capabilities,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export type { JWTPayload };

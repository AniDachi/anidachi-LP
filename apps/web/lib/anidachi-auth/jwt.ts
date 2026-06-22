import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import {
  isRoomCapabilities,
  normalizePlanCode,
  type PlanCode,
  type RoomCapabilities,
} from "./plan-entitlements";
import { isAcceptedPlanCode } from "./plan-codes";
import { ACCESS_TOKEN_TTL_SECONDS } from "./token-policy";

function getJwtSecret(): Uint8Array {
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
  return new SignJWT({ email: payload.email, plan: payload.plan })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.email || !payload.plan) return null;
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
  capabilities?: RoomCapabilities;
  displayName?: string;
  avatarUrl?: string | null;
};

const ROOM_TOKEN_DEFAULT_TTL_SECONDS = 30 * 60;

export async function signRoomToken(
  payload: RoomTokenPayload,
  expiresInSeconds: number = ROOM_TOKEN_DEFAULT_TTL_SECONDS
): Promise<string> {
  // Free-plan hosts get tokens capped to their remaining daily quota (PD2);
  // the TTL can shrink but never exceed the standard room token life.
  const ttl = Math.max(
    1,
    Math.min(ROOM_TOKEN_DEFAULT_TTL_SECONDS, Math.floor(expiresInSeconds))
  );
  return new SignJWT({
    roomId: payload.roomId,
    role: payload.role,
    capabilities: payload.capabilities,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl ?? null,
    typ: "room",
  })
    .setProtectedHeader({ alg: "HS256" })
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
      audience: "anidachi-worker",
    });
    if (payload.typ !== "room") return null;
    if (!payload.sub || !payload.roomId || !payload.role) return null;
    if (payload.role !== "host" && payload.role !== "member") return null;
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
      capabilities: payload.capabilities,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export type { JWTPayload };

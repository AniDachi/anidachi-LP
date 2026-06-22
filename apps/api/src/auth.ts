import { SignJWT, jwtVerify } from "jose";
import { RoomCapabilitiesSchema, type RoomCapabilities } from "@anidachi/protocol";

export interface WorkerAuthEnv {
  ANIDACHI_JWT_SECRET?: string;
}

export interface VerifiedRoomToken {
  sub: string;
  roomId: string;
  role: "host" | "member";
  capabilities?: RoomCapabilities;
  displayName?: string;
  avatarUrl?: string | null;
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
    const { payload } = await jwtVerify(token, getSecret(env), {
      audience: "anidachi-worker",
    });
    if (payload.typ !== "room") return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (payload.roomId !== expectedRoomId) return null;
    if (payload.role !== "host" && payload.role !== "member") return null;
    const capabilities =
      payload.capabilities === undefined
        ? undefined
        : RoomCapabilitiesSchema.safeParse(payload.capabilities);
    if (capabilities !== undefined && !capabilities.success) return null;
    if (payload.displayName !== undefined && typeof payload.displayName !== "string") return null;
    if (
      payload.avatarUrl !== null &&
      payload.avatarUrl !== undefined &&
      typeof payload.avatarUrl !== "string"
    ) {
      return null;
    }

    const verified: VerifiedRoomToken = {
      sub: payload.sub,
      roomId: payload.roomId,
      role: payload.role,
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

export async function signRoomTokenForTest(
  params: VerifiedRoomToken,
  env: WorkerAuthEnv,
): Promise<string> {
  const claims: Record<string, unknown> = {
    roomId: params.roomId,
    role: params.role,
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
    .setAudience("anidachi-worker")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getSecret(env));
}

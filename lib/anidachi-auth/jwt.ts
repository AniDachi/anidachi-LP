import { SignJWT, jwtVerify, type JWTPayload } from "jose";

function getJwtSecret(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

// ---------- Access token ----------

export type AccessTokenPayload = {
  sub: string; // userId
  email: string;
  plan: "watcher" | "nakama" | "junkie";
};

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({ email: payload.email, plan: payload.plan })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.email || !payload.plan) return null;
    return {
      sub: payload.sub,
      email: payload.email as string,
      plan: payload.plan as AccessTokenPayload["plan"],
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
  displayName?: string;
  avatarUrl?: string | null;
};

export async function signRoomToken(
  payload: RoomTokenPayload
): Promise<string> {
  return new SignJWT({
    roomId: payload.roomId,
    role: payload.role,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl ?? null,
    typ: "room",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience("anidachi-worker")
    .setIssuedAt()
    .setExpirationTime("30m")
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
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export type { JWTPayload };

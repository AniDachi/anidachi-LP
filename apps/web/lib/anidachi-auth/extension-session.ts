import { SignJWT, jwtVerify } from "jose";
import {
  generateRefreshToken,
  getUserById,
  storeRefreshToken,
  validateRefreshToken,
} from "./db";
import type { PlanCode } from "./plan-entitlements";

const EXTENSION_ACCESS_AUDIENCE = "anidachi-extension";
const EXTENSION_ACCESS_TYPE = "extension_access";
const EXTENSION_REFRESH_TOKEN_TTL_DAYS = 30;

function getJwtSecret(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type ExtensionAccessTokenPayload = {
  sub: string;
  email: string;
  plan: PlanCode;
};

export type ExtensionUserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  plan: PlanCode;
};

export async function signExtensionAccessToken(
  payload: ExtensionAccessTokenPayload,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    plan: payload.plan,
    typ: EXTENSION_ACCESS_TYPE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience(EXTENSION_ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getJwtSecret());
}

export async function verifyExtensionAccessToken(
  token: string,
): Promise<ExtensionAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      audience: EXTENSION_ACCESS_AUDIENCE,
    });
    if (payload.typ !== EXTENSION_ACCESS_TYPE) return null;
    if (!payload.sub || typeof payload.email !== "string") return null;
    if (payload.plan !== "watcher" && payload.plan !== "nakama" && payload.plan !== "junkie") {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      plan: payload.plan,
    };
  } catch {
    return null;
  }
}

export async function getExtensionSessionFromAuthorization(
  authorization: string | null,
): Promise<ExtensionAccessTokenPayload | null> {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return verifyExtensionAccessToken(authorization.slice("Bearer ".length));
}

export async function getExtensionUserProfile(
  userId: string,
): Promise<ExtensionUserProfile | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    plan: user.plan,
  };
}

export async function issueExtensionTokenPair(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: ExtensionUserProfile;
}> {
  const user = await getExtensionUserProfile(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const accessToken = await signExtensionAccessToken({
    sub: user.id,
    email: user.email,
    plan: user.plan,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXTENSION_REFRESH_TOKEN_TTL_DAYS);
  await storeRefreshToken(user.id, refreshToken, expiresAt);

  return { accessToken, refreshToken, user };
}

export async function refreshExtensionAccessToken(
  refreshToken: string,
): Promise<string | null> {
  const userId = await validateRefreshToken(refreshToken);
  if (!userId) return null;

  const user = await getExtensionUserProfile(userId);
  if (!user) return null;

  return signExtensionAccessToken({
    sub: user.id,
    email: user.email,
    plan: user.plan,
  });
}

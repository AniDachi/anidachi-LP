import { createHmac } from "node:crypto";
import { getJwtSecret, signAccessToken } from "./jwt";
import {
  createRefreshTokenFamily,
  generateRefreshToken,
  getUserById,
  revokeAllRefreshTokenFamiliesForUser,
  revokeRefreshTokenFamily,
  rotateRefreshTokenFamily,
  type RefreshChannel,
} from "./db";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

const REFRESH_SUCCESSOR_DOMAIN = "anidachi-refresh-successor-v1";

export function deriveRefreshTokenSuccessor(
  predecessor: string,
  channel: RefreshChannel,
): string {
  return createHmac("sha256", getJwtSecret())
    .update(REFRESH_SUCCESSOR_DOMAIN)
    .update("\0")
    .update(channel)
    .update("\0")
    .update(predecessor)
    .digest("base64url");
}

export async function issueRefreshTokenFamily(
  userId: string,
  channel: RefreshChannel,
): Promise<string> {
  const refreshToken = generateRefreshToken();
  await createRefreshTokenFamily(userId, refreshToken, channel);
  return refreshToken;
}

export async function rotateRefreshTokenForChannel(
  refreshToken: string,
  channel: RefreshChannel,
): Promise<{ userId: string; refreshToken: string } | null> {
  const successor = deriveRefreshTokenSuccessor(refreshToken, channel);
  const rotation = await rotateRefreshTokenFamily(refreshToken, successor, channel);
  if (
    (rotation.rotation_outcome !== "rotated" && rotation.rotation_outcome !== "reused") ||
    !rotation.user_id
  ) {
    return null;
  }
  return { userId: rotation.user_id, refreshToken: successor };
}

async function signAccessTokenForUser(userId: string): Promise<string | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  return signAccessToken({
    sub: userId,
    email: user.email,
    plan: user.plan,
  });
}

export async function issueTokenPair(userId: string): Promise<TokenPair> {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const accessToken = await signAccessToken({
    sub: userId,
    email: user.email,
    plan: user.plan,
  });

  const refreshToken = await issueRefreshTokenFamily(userId, "website");

  return { accessToken, refreshToken };
}

/** Atomically rotates a website refresh family and issues a fresh access token. */
export async function refreshTokenPair(
  refreshToken: string
): Promise<TokenPair | null> {
  const rotation = await rotateRefreshTokenForChannel(refreshToken, "website");
  if (!rotation) return null;

  const accessToken = await signAccessTokenForUser(rotation.userId);
  if (!accessToken) return null;

  return { accessToken, refreshToken: rotation.refreshToken };
}

/** Validates the incoming refresh token and issues a new access token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  return (await refreshTokenPair(refreshToken))?.accessToken ?? null;
}

export async function revokeRefreshToken(
  token: string,
  channel: RefreshChannel,
): Promise<void> {
  await revokeRefreshTokenFamily(token, channel);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await revokeAllRefreshTokenFamiliesForUser(userId);
}

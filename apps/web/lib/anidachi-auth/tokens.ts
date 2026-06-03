import { signAccessToken } from "./jwt";
import {
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokensForUser,
  getUserById,
} from "./db";

const REFRESH_TOKEN_TTL_DAYS = 7;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export async function issueTokenPair(userId: string): Promise<TokenPair> {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const accessToken = await signAccessToken({
    sub: userId,
    email: user.email,
    plan: user.plan,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  await storeRefreshToken(userId, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

/** Validates the incoming refresh token and issues a new access token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  const userId = await validateRefreshToken(refreshToken);
  if (!userId) return null;

  const user = await getUserById(userId);
  if (!user) return null;

  return signAccessToken({
    sub: userId,
    email: user.email,
    plan: user.plan,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await deleteRefreshToken(token);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await deleteAllRefreshTokensForUser(userId);
}

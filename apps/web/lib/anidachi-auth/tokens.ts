import { signAccessToken } from "./jwt";
import {
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokensForUser,
  getUserById,
  extendRefreshToken,
} from "./db";
import { REFRESH_TOKEN_TTL_DAYS } from "./token-policy";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

function refreshTokenExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
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

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(userId, refreshToken, refreshTokenExpiresAt());

  return { accessToken, refreshToken };
}

/** Validates and extends a refresh token, issuing a fresh access/refresh pair. */
export async function refreshTokenPair(
  refreshToken: string
): Promise<TokenPair | null> {
  const userId = await validateRefreshToken(refreshToken);
  if (!userId) return null;

  const accessToken = await signAccessTokenForUser(userId);
  if (!accessToken) return null;

  await extendRefreshToken(refreshToken, refreshTokenExpiresAt());

  return { accessToken, refreshToken };
}

/** Validates the incoming refresh token and issues a new access token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  return (await refreshTokenPair(refreshToken))?.accessToken ?? null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await deleteRefreshToken(token);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await deleteAllRefreshTokensForUser(userId);
}

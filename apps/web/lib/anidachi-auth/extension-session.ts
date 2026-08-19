import { SignJWT, jwtVerify } from "jose";
import {
  getUserById,
} from "./db";
import { ANIDACHI_AUTH_ISSUER, getJwtSecret } from "./jwt";
import { normalizePlanCode, type PlanCode } from "./plan-entitlements";
import { isAcceptedPlanCode } from "./plan-codes";
import { ACCESS_TOKEN_TTL_SECONDS } from "./token-policy";
import {
  issueRefreshTokenFamily,
  rotateRefreshTokenForChannel,
} from "./tokens";

const EXTENSION_ACCESS_AUDIENCE = "anidachi-extension";
const EXTENSION_ACCESS_TYPE = "extension_access";

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
    .setIssuer(ANIDACHI_AUTH_ISSUER)
    .setSubject(payload.sub)
    .setAudience(EXTENSION_ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyExtensionAccessToken(
  token: string,
): Promise<ExtensionAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: ANIDACHI_AUTH_ISSUER,
      audience: EXTENSION_ACCESS_AUDIENCE,
      requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
    });
    if (payload.typ !== EXTENSION_ACCESS_TYPE) return null;
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email ||
      !isAcceptedPlanCode(payload.plan)
    ) {
      return null;
    }
    const plan = normalizePlanCode(payload.plan);

    return {
      sub: payload.sub,
      email: payload.email,
      plan,
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

  const refreshToken = await issueRefreshTokenFamily(user.id, "extension");

  return { accessToken, refreshToken, user };
}

export async function refreshExtensionTokenPair(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const rotation = await rotateRefreshTokenForChannel(refreshToken, "extension");
  if (!rotation) return null;

  const user = await getExtensionUserProfile(rotation.userId);
  if (!user) return null;

  const accessToken = await signExtensionAccessToken({
    sub: user.id,
    email: user.email,
    plan: user.plan,
  });

  return { accessToken, refreshToken: rotation.refreshToken };
}

export async function refreshExtensionAccessToken(
  refreshToken: string,
): Promise<string | null> {
  return (await refreshExtensionTokenPair(refreshToken))?.accessToken ?? null;
}

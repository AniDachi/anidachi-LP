import { ExtensionAuthInitiationQuerySchema } from "@anidachi/protocol";
import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { sanitizeAuthReturnTo } from "./return-to";

export const EXTENSION_AUTH_HANDOFF_TTL_SECONDS = 10 * 60;

const EXTENSION_AUTH_HANDOFF_AUDIENCE = "anidachi-extension-connect";
const EXTENSION_AUTH_HANDOFF_ISSUER = "anidachi-web";
const EXTENSION_AUTH_HANDOFF_PURPOSE = "extension-auth-login-handoff";
const EXTENSION_AUTH_HANDOFF_TYPE = "anidachi-extension-auth-handoff+jwt";
const EXTENSION_AUTH_HANDOFF_MAX_CHARS = 2_048;

const EXTENSION_AUTH_HANDOFF_PATTERN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type ExtensionAuthQuery = ReturnType<
  (typeof ExtensionAuthInitiationQuerySchema)["parse"]
>;

export async function createExtensionAuthLoginRedirect(
  input: ExtensionAuthQuery,
  currentDate: Date = new Date(),
): Promise<string> {
  const parsed = ExtensionAuthInitiationQuerySchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid extension authorization handoff");

  const issuedAt = Math.floor(currentDate.getTime() / 1_000);
  const envelope = await new EncryptJWT({
    purpose: EXTENSION_AUTH_HANDOFF_PURPOSE,
    request: parsed.data,
  })
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
      typ: EXTENSION_AUTH_HANDOFF_TYPE,
    })
    .setIssuer(EXTENSION_AUTH_HANDOFF_ISSUER)
    .setAudience(EXTENSION_AUTH_HANDOFF_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setNotBefore(issuedAt)
    .setExpirationTime(issuedAt + EXTENSION_AUTH_HANDOFF_TTL_SECONDS)
    .encrypt(extensionAuthHandoffKey());

  return extensionAuthLoginRedirectForEnvelope(envelope);
}

export async function openExtensionAuthHandoff(
  envelope: string,
  currentDate: Date = new Date(),
): Promise<ExtensionAuthQuery | null> {
  const parsedEnvelope = parseExtensionAuthHandoffEnvelope(envelope);
  if (!parsedEnvelope) return null;

  try {
    const { payload } = await jwtDecrypt(
      parsedEnvelope,
      extensionAuthHandoffKey(),
      {
        audience: EXTENSION_AUTH_HANDOFF_AUDIENCE,
        issuer: EXTENSION_AUTH_HANDOFF_ISSUER,
        typ: EXTENSION_AUTH_HANDOFF_TYPE,
        maxTokenAge: EXTENSION_AUTH_HANDOFF_TTL_SECONDS,
        currentDate,
        clockTolerance: 0,
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
        requiredClaims: ["exp", "iat", "nbf", "purpose", "request"],
      },
    );
    if (
      payload.purpose !== EXTENSION_AUTH_HANDOFF_PURPOSE ||
      typeof payload.iat !== "number" ||
      typeof payload.nbf !== "number" ||
      typeof payload.exp !== "number" ||
      payload.nbf !== payload.iat ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > EXTENSION_AUTH_HANDOFF_TTL_SECONDS
    ) {
      return null;
    }

    const parsedRequest = ExtensionAuthInitiationQuerySchema.safeParse(
      payload.request,
    );
    return parsedRequest.success ? parsedRequest.data : null;
  } catch {
    return null;
  }
}

export function extensionAuthLoginRedirectForEnvelope(envelope: string): string {
  const parsed = parseExtensionAuthHandoffEnvelope(envelope);
  if (!parsed) throw new Error("Invalid extension authorization handoff");
  const resume = `/extension/connect?${new URLSearchParams({
    handoff: parsed,
  }).toString()}`;
  return `/login?next=${encodeURIComponent(resume)}`;
}

function parseExtensionAuthHandoffEnvelope(value: string): string | null {
  return value.length > 0 &&
    value.length <= EXTENSION_AUTH_HANDOFF_MAX_CHARS &&
    EXTENSION_AUTH_HANDOFF_PATTERN.test(value)
    ? value
    : null;
}

export async function sanitizeOAuthExtensionReturnTo(
  value: string,
  currentDate: Date = new Date(),
): Promise<string | null> {
  const safe = sanitizeAuthReturnTo(value);
  if (!safe) return null;

  try {
    const url = new URL(safe, "https://anidachi.invalid");
    const keys = [...url.searchParams.keys()];
    if (
      url.pathname !== "/extension/connect" ||
      url.hash ||
      keys.length !== 1 ||
      keys[0] !== "handoff"
    ) {
      return null;
    }
    const envelope = url.searchParams.get("handoff") ?? "";
    if (!(await openExtensionAuthHandoff(envelope, currentDate))) return null;
    return `/extension/connect?${new URLSearchParams({ handoff: envelope }).toString()}`;
  } catch {
    return null;
  }
}

function extensionAuthHandoffKey(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new Uint8Array(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("anidachi-extension-auth-handoff-v1", "utf8"),
      Buffer.from("encrypted-browser-handoff", "utf8"),
      32,
    ),
  );
}

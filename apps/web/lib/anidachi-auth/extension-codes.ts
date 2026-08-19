import {
  ExtensionAuthClientIdSchema,
  ExtensionAuthExchangeRequestSchema,
  ExtensionAuthInitiationSchema,
} from "@anidachi/protocol";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const EXTENSION_AUTH_CODE_TTL_SECONDS = 5 * 60;

type CreateExtensionAuthCodeInput = {
  userId: string;
  codeHash: string;
  stateHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

type ConsumeExtensionAuthCodeInput = Omit<
  CreateExtensionAuthCodeInput,
  "userId" | "codeChallengeMethod"
>;

export type ExtensionAuthCodeRepository = {
  create(input: CreateExtensionAuthCodeInput): Promise<void>;
  consume(input: ConsumeExtensionAuthCodeInput): Promise<{ userId: string } | null>;
};

const defaultRepository: ExtensionAuthCodeRepository = {
  async create(input) {
    const { error } = await db().rpc("create_extension_auth_code_v1", {
      p_user_id: input.userId,
      p_code_hash: input.codeHash,
      p_state_hash: input.stateHash,
      p_extension_id: input.clientId,
      p_redirect_uri: input.redirectUri,
      p_code_challenge: input.codeChallenge,
      p_code_challenge_method: input.codeChallengeMethod,
    });
    if (error) {
      console.error("[anidachi/auth] Extension authorization code create failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error("Failed to create extension authorization code");
    }
  },
  async consume(input) {
    const { data, error } = await db().rpc("consume_extension_auth_code_v1", {
      p_code_hash: input.codeHash,
      p_state_hash: input.stateHash,
      p_extension_id: input.clientId,
      p_redirect_uri: input.redirectUri,
      p_code_challenge: input.codeChallenge,
    });
    if (error) {
      console.error("[anidachi/auth] Extension authorization code consume failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error("Failed to consume extension authorization code");
    }
    return typeof data === "string" ? { userId: data } : null;
  },
};

export function generateExtensionAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionAuthCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deriveExtensionPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function readApprovedExtensionClientId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env.ANIDACHI_EXTENSION_CLIENT_ID?.trim();
  if (!value) return null;
  const parsed = ExtensionAuthClientIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isSafeExtensionRedirectUri(
  value: string,
  callbackPath: "/auth" | "/logout" = "/auth",
  approvedClientId = readApprovedExtensionClientId(),
): boolean {
  if (!approvedClientId) return false;
  return value === `https://${approvedClientId}.chromiumapp.org${callbackPath}`;
}

export async function createExtensionAuthCode(params: {
  userId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  repository?: ExtensionAuthCodeRepository;
}): Promise<string> {
  const approvedClientId = readApprovedExtensionClientId();
  const parsed = ExtensionAuthInitiationSchema.safeParse({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    state: params.state,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
  });
  if (!parsed.success || parsed.data.clientId !== approvedClientId) {
    throw new Error("Invalid extension authorization request");
  }
  if (!isSafeExtensionRedirectUri(parsed.data.redirectUri, "/auth", approvedClientId)) {
    throw new Error("Invalid extension authorization request");
  }

  const code = generateExtensionAuthCode();
  await (params.repository ?? defaultRepository).create({
    userId: params.userId,
    codeHash: hashExtensionAuthCode(code),
    stateHash: hashExtensionAuthCode(parsed.data.state),
    clientId: parsed.data.clientId,
    redirectUri: parsed.data.redirectUri,
    codeChallenge: parsed.data.codeChallenge,
    codeChallengeMethod: parsed.data.codeChallengeMethod,
  });
  return code;
}

export async function consumeExtensionAuthCode(params: {
  clientId: string;
  redirectUri: string;
  code: string;
  state: string;
  codeVerifier: string;
  repository?: ExtensionAuthCodeRepository;
}): Promise<{ userId: string } | null> {
  const approvedClientId = readApprovedExtensionClientId();
  const parsed = ExtensionAuthExchangeRequestSchema.safeParse({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    code: params.code,
    state: params.state,
    codeVerifier: params.codeVerifier,
  });
  if (!parsed.success || parsed.data.clientId !== approvedClientId) return null;
  if (!isSafeExtensionRedirectUri(parsed.data.redirectUri, "/auth", approvedClientId)) {
    return null;
  }

  return (params.repository ?? defaultRepository).consume({
    codeHash: hashExtensionAuthCode(parsed.data.code),
    stateHash: hashExtensionAuthCode(parsed.data.state),
    clientId: parsed.data.clientId,
    redirectUri: parsed.data.redirectUri,
    codeChallenge: deriveExtensionPkceChallenge(parsed.data.codeVerifier),
  });
}

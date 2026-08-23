import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { db } from "./db";
import { sanitizeOAuthExtensionReturnTo } from "./extension-auth-handoff";
import { sanitizeAuthReturnTo } from "./return-to";

export const OAUTH_LOGIN_TRANSACTION_TTL_SECONDS = 10 * 60;

export type OAuthLoginProvider = "discord" | "google";

type CreateOAuthLoginTransactionInput = {
  stateHash: string;
  browserCorrelationHash: string;
  provider: OAuthLoginProvider;
  returnTo: string;
};

type ConsumeOAuthLoginTransactionInput = Omit<
  CreateOAuthLoginTransactionInput,
  "returnTo"
>;

export type OAuthLoginTransactionRepository = {
  create(input: CreateOAuthLoginTransactionInput): Promise<void>;
  consume(
    input: ConsumeOAuthLoginTransactionInput,
  ): Promise<{ returnTo: string } | null>;
};

export type OAuthLoginTransactionStart = {
  state: string;
  correlationSecret: string;
  correlationCookieName: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

const defaultRepository: OAuthLoginTransactionRepository = {
  async create(input) {
    const { error } = await db().rpc("create_oauth_login_transaction_v1", {
      p_state_hash: input.stateHash,
      p_browser_correlation_hash: input.browserCorrelationHash,
      p_provider: input.provider,
      p_return_to: input.returnTo,
    });
    if (error) {
      console.error("[anidachi/auth] OAuth transaction create failed", {
        provider: input.provider,
        code: error.code,
        message: error.message,
      });
      throw new Error("Failed to create OAuth login transaction");
    }
  },
  async consume(input) {
    const { data, error } = await db().rpc("consume_oauth_login_transaction_v1", {
      p_state_hash: input.stateHash,
      p_browser_correlation_hash: input.browserCorrelationHash,
      p_provider: input.provider,
    });
    if (error) {
      console.error("[anidachi/auth] OAuth transaction consume failed", {
        provider: input.provider,
        code: error.code,
        message: error.message,
      });
      throw new Error("Failed to consume OAuth login transaction");
    }
    return typeof data === "string" ? { returnTo: data } : null;
  },
};

export async function createOAuthLoginTransaction(params: {
  provider: OAuthLoginProvider;
  returnTo: string | null | undefined;
  repository?: OAuthLoginTransactionRepository;
}): Promise<OAuthLoginTransactionStart> {
  const state = randomBytes(32).toString("base64url");
  const correlationSecret = randomBytes(32).toString("base64url");
  const codeVerifier = deriveOAuthPkceVerifier(state);
  const repository = params.repository ?? defaultRepository;
  const returnTo = await sanitizeOAuthTransactionReturnTo(params.returnTo);

  await repository.create({
    stateHash: hashOAuthSecret(state),
    browserCorrelationHash: hashOAuthSecret(correlationSecret),
    provider: params.provider,
    returnTo,
  });

  return {
    state,
    correlationSecret,
    correlationCookieName: oauthCorrelationCookieName(state),
    codeChallenge: deriveOAuthPkceChallenge(codeVerifier),
    codeChallengeMethod: "S256",
  };
}

async function sanitizeOAuthTransactionReturnTo(
  value: string | null | undefined,
): Promise<string> {
  const safe = sanitizeAuthReturnTo(value);
  if (!safe) return "";

  try {
    const url = new URL(safe, "https://anidachi.invalid");
    if (url.pathname !== "/extension/connect") {
      return url.pathname.startsWith("/extension/connect/") ? "" : safe;
    }
  } catch {
    return "";
  }

  return (await sanitizeOAuthExtensionReturnTo(safe)) ?? "";
}

export async function consumeOAuthLoginTransaction(params: {
  provider: OAuthLoginProvider;
  state: string;
  correlationSecret: string;
  repository?: OAuthLoginTransactionRepository;
}): Promise<{ returnTo: string; codeVerifier: string } | null> {
  if (
    !isCanonicalOAuthSecret(params.state) ||
    !isCanonicalOAuthSecret(params.correlationSecret)
  ) {
    return null;
  }

  const repository = params.repository ?? defaultRepository;
  const consumed = await repository.consume({
    stateHash: hashOAuthSecret(params.state),
    browserCorrelationHash: hashOAuthSecret(params.correlationSecret),
    provider: params.provider,
  });
  if (!consumed) return null;

  return {
    // Revalidate the durable boundary even when a custom repository is injected.
    returnTo: sanitizeAuthReturnTo(consumed.returnTo),
    codeVerifier: deriveOAuthPkceVerifier(params.state),
  };
}

export function deriveOAuthPkceVerifier(state: string): string {
  if (!isCanonicalOAuthSecret(state)) {
    throw new Error("Invalid OAuth state");
  }
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from(state, "base64url"),
      Buffer.from("oauth-pkce-v1", "utf8"),
      32,
    ),
  ).toString("base64url");
}

export function deriveOAuthPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function oauthCorrelationCookieName(state: string): string {
  if (!isCanonicalOAuthSecret(state)) {
    throw new Error("Invalid OAuth state");
  }
  return `anidachi_oauth_tx_${hashOAuthSecret(state).slice(0, 24)}`;
}

export function oauthCorrelationCookiePath(provider: OAuthLoginProvider): string {
  return `/api/auth/callback/${provider}`;
}

function hashOAuthSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isCanonicalOAuthSecret(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength === 32 && decoded.toString("base64url") === value;
}

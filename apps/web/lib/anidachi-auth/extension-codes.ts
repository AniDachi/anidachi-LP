import { createHash, randomBytes } from "crypto";
import { db } from "./db";

const EXTENSION_CODE_TTL_MS = 5 * 60 * 1000;

export function generateExtensionAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionAuthCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isSafeExtensionRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

export async function createExtensionAuthCode(params: {
  userId: string;
  redirectUri: string;
  state: string;
}): Promise<string> {
  if (!params.state.trim()) {
    throw new Error("Extension auth state is required");
  }
  if (!isSafeExtensionRedirectUri(params.redirectUri)) {
    throw new Error("Unsafe extension redirect URI");
  }

  const code = generateExtensionAuthCode();
  const expiresAt = new Date(Date.now() + EXTENSION_CODE_TTL_MS);
  const { error } = await db().from("extension_auth_codes").insert({
    user_id: params.userId,
    code_hash: hashExtensionAuthCode(code),
    state_hash: hashExtensionAuthCode(params.state),
    redirect_uri: params.redirectUri,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create extension auth code: ${error.message}`);
  }

  return code;
}

export async function consumeExtensionAuthCode(params: {
  code: string;
  state: string;
}): Promise<{ userId: string } | null> {
  if (!params.code || !params.state) {
    return null;
  }

  const client = db();
  const { data } = await client
    .from("extension_auth_codes")
    .select("id,user_id,state_hash,expires_at,consumed_at")
    .eq("code_hash", hashExtensionAuthCode(params.code))
    .maybeSingle();

  if (!data) return null;
  if (data.consumed_at) return null;
  if (data.state_hash !== hashExtensionAuthCode(params.state)) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const { data: consumed, error } = await client
    .from("extension_auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to consume extension auth code: ${error.message}`);
  }

  return consumed ? { userId: consumed.user_id as string } : null;
}

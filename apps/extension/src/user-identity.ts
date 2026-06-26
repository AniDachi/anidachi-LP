import type { Participant } from "@anidachi/protocol";
import { sendAuthCommand } from "./auth-client";
import type { ExtensionAuthTokens } from "./auth-tokens";

export interface CurrentParticipantResult {
  participant: Participant | null;
  authenticated: boolean;
  tokens: ExtensionAuthTokens | null;
  requiresPageReload?: boolean;
  message?: string;
}

export const EXTENSION_CONTEXT_INVALIDATED_MESSAGE =
  "Anidachi was updated. Reload this page to reconnect the extension.";

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /extension context invalidated/i.test(message);
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (isExtensionContextInvalidatedError(error)) {
    return EXTENSION_CONTEXT_INVALIDATED_MESSAGE;
  }

  return error instanceof Error ? error.message : fallback;
}

function participantFromTokens(tokens: ExtensionAuthTokens): Participant {
  return {
    id: tokens.user.id,
    displayName: tokens.user.displayName,
    avatarUrl: tokens.user.avatarUrl ?? undefined,
    role: "viewer",
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: Date.now(),
  };
}

export async function createCurrentParticipant(
  options: { fast?: boolean } = {},
): Promise<CurrentParticipantResult> {
  let response;
  try {
    response = await sendAuthCommand(options.fast ? "get-session-fast" : "get-session");
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return {
        participant: null,
        authenticated: false,
        tokens: null,
        requiresPageReload: true,
        message: EXTENSION_CONTEXT_INVALIDATED_MESSAGE,
      };
    }

    return {
      participant: null,
      authenticated: false,
      tokens: null,
    };
  }

  if (response?.ok && response.tokens) {
    return {
      participant: participantFromTokens(response.tokens),
      authenticated: true,
      tokens: response.tokens,
    };
  }

  return {
    participant: null,
    authenticated: false,
    tokens: null,
  };
}

/**
 * Best-effort, non-interactive pickup of an existing website session. Returns
 * an authenticated result when the website cookie session can be exchanged for
 * extension tokens without UI, otherwise null (stay signed out quietly).
 */
export async function trySilentSignIn(): Promise<CurrentParticipantResult | null> {
  let response;
  try {
    response = await sendAuthCommand("sign-in-silent");
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return {
        participant: null,
        authenticated: false,
        tokens: null,
        requiresPageReload: true,
        message: EXTENSION_CONTEXT_INVALIDATED_MESSAGE,
      };
    }

    return null;
  }

  if (response?.ok && response.tokens) {
    return {
      participant: participantFromTokens(response.tokens),
      authenticated: true,
      tokens: response.tokens,
    };
  }

  return null;
}

export async function signInAndCreateParticipant(): Promise<CurrentParticipantResult> {
  const response = await sendAuthCommand("sign-in");
  if (!response.ok || !response.tokens) {
    throw new Error(response.ok ? "Sign in did not return a session" : response.error);
  }

  return {
    participant: participantFromTokens(response.tokens),
    authenticated: true,
    tokens: response.tokens,
  };
}

export async function signOutAndClearParticipant(): Promise<CurrentParticipantResult> {
  const response = await sendAuthCommand("sign-out");
  if (!response.ok) {
    throw new Error(response.error);
  }

  return {
    participant: null,
    authenticated: false,
    tokens: null,
  };
}

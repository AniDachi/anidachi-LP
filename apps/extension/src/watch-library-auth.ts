import type { ExtensionAuthTokens } from "./auth-tokens";
import type { CurrentParticipantResult } from "./user-identity";

export interface WatchLibraryReconcileAuthDecision {
  accessToken: string | null;
  currentUserId: string | null;
  reason: "ok" | "not-signed-in" | "no-current-user" | "user-mismatch";
  tokenUserId: string | null;
}

export function resolveWatchLibraryReconcileAuth(
  currentUserId: string | null,
  result: CurrentParticipantResult,
): WatchLibraryReconcileAuthDecision {
  const tokens: ExtensionAuthTokens | null = result.tokens ?? null;
  const tokenUserId = tokens?.user.id ?? null;

  if (!tokens) {
    return {
      accessToken: null,
      currentUserId,
      reason: "not-signed-in",
      tokenUserId,
    };
  }

  if (!currentUserId) {
    return {
      accessToken: null,
      currentUserId,
      reason: "no-current-user",
      tokenUserId,
    };
  }

  if (tokenUserId !== currentUserId) {
    return {
      accessToken: null,
      currentUserId,
      reason: "user-mismatch",
      tokenUserId,
    };
  }

  return {
    accessToken: tokens.accessToken,
    currentUserId,
    reason: "ok",
    tokenUserId,
  };
}

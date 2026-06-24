export type LoginContext = {
  headline: string;
  subtitle: string;
  extensionNote?: string;
};

export function getLoginContext(returnTo: string): LoginContext {
  if (returnTo.startsWith("/room/")) {
    return {
      headline: "Sign in to join the watchroom",
      subtitle: "You will return to the room right after sign-in.",
    };
  }

  if (returnTo.startsWith("/friend/invite/")) {
    return {
      headline: "Sign in to accept this invite",
      subtitle: "Add your friend once you are signed in.",
    };
  }

  if (returnTo.startsWith("/extension/connect")) {
    return {
      headline: "Sign in to connect the extension",
      subtitle: "Link AniDachi in Chrome to sync watchrooms.",
      extensionNote: "You will return to Chrome automatically after sign-in.",
    };
  }

  if (returnTo.startsWith("/account")) {
    return {
      headline: "Sign in to your account",
      subtitle: "Manage friends, invites, and your watch library.",
    };
  }

  if (returnTo) {
    return {
      headline: "Sign in to continue",
      subtitle: "Pick up where you left off in AniDachi.",
    };
  }

  return {
    headline: "Sign in to AniDachi",
    subtitle: "Start a watchroom or pick up where you left off.",
  };
}

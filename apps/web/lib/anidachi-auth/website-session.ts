import { resolveRefreshTokenFamily, type RefreshChannel } from "./db";
import {
  getExtensionUserProfile,
  type ExtensionUserProfile,
} from "./extension-session";

interface WebsiteSessionDependencies {
  resolveRefreshToken: (
    refreshToken: string,
    channel: RefreshChannel,
  ) => Promise<string | null>;
  getUserProfile: (userId: string) => Promise<ExtensionUserProfile | null>;
}

const defaultDependencies: WebsiteSessionDependencies = {
  resolveRefreshToken: resolveRefreshTokenFamily,
  getUserProfile: getExtensionUserProfile,
};

export async function resolveWebsiteSession(
  refreshToken: string | undefined,
  dependencies: WebsiteSessionDependencies = defaultDependencies,
): Promise<ExtensionUserProfile | null> {
  if (!refreshToken) return null;

  const userId = await dependencies.resolveRefreshToken(refreshToken, "website");
  if (!userId) return null;

  return dependencies.getUserProfile(userId);
}

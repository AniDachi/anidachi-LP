import { validateRefreshToken } from "./db";
import {
  getExtensionUserProfile,
  type ExtensionUserProfile,
} from "./extension-session";

interface WebsiteSessionDependencies {
  validateRefreshToken: (refreshToken: string) => Promise<string | null>;
  getUserProfile: (userId: string) => Promise<ExtensionUserProfile | null>;
}

const defaultDependencies: WebsiteSessionDependencies = {
  validateRefreshToken,
  getUserProfile: getExtensionUserProfile,
};

export async function resolveWebsiteSession(
  refreshToken: string | undefined,
  dependencies: WebsiteSessionDependencies = defaultDependencies,
): Promise<ExtensionUserProfile | null> {
  if (!refreshToken) return null;

  const userId = await dependencies.validateRefreshToken(refreshToken);
  if (!userId) return null;

  return dependencies.getUserProfile(userId);
}

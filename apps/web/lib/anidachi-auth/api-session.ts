import type { NextRequest } from "next/server";
import type { PlanCode } from "./plan-entitlements";
import { getExtensionSessionFromAuthorization } from "./extension-session";
import { getSession } from "./session";

export type ApiSession = {
  userId: string;
  email: string;
  plan: PlanCode;
  source: "cookie" | "extension";
};

export async function getApiSession(
  request: NextRequest
): Promise<ApiSession | null> {
  const cookieSession = await getSession();
  if (cookieSession) {
    return {
      userId: cookieSession.userId,
      email: cookieSession.email,
      plan: cookieSession.plan,
      source: "cookie",
    };
  }

  const extensionSession = await getExtensionSessionFromAuthorization(
    request.headers.get("authorization")
  );
  if (!extensionSession) return null;

  return {
    userId: extensionSession.sub,
    email: extensionSession.email,
    plan: extensionSession.plan,
    source: "extension",
  };
}

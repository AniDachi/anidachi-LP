import { type NextRequest, NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "./api-session";

type DisabledWatchLibraryRouteDependencies = {
  getSession(request: NextRequest): Promise<ApiSession | null>;
};

export function createDisabledWatchLibraryRoute(
  dependencies: DisabledWatchLibraryRouteDependencies = { getSession: getApiSession },
) {
  return async function disabledWatchLibraryRoute(request: NextRequest): Promise<NextResponse> {
    const session = await dependencies.getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Watch History v2 is required", code: "UPGRADE_REQUIRED" },
      { status: 426 },
    );
  };
}

export const disabledWatchLibraryRoute = createDisabledWatchLibraryRoute();

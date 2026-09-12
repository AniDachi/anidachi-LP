import { type NextRequest, NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "./api-session";

type DisabledWatchLibraryRouteDependencies = {
  getSession(request: NextRequest): Promise<ApiSession | null>;
};

function createDisabledRoute(
  error: string,
  dependencies: DisabledWatchLibraryRouteDependencies,
) {
  return async function disabledRoute(request: NextRequest): Promise<NextResponse> {
    const session = await dependencies.getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error, code: "UPGRADE_REQUIRED" },
      { status: 426 },
    );
  };
}

export function createDisabledWatchLibraryRoute(
  dependencies: DisabledWatchLibraryRouteDependencies = { getSession: getApiSession },
) {
  return createDisabledRoute("Watch History v2 is required", dependencies);
}

export const disabledWatchLibraryRoute = createDisabledWatchLibraryRoute();

export function createDisabledWatchHistoryV2Route(
  dependencies: DisabledWatchLibraryRouteDependencies = { getSession: getApiSession },
) {
  return createDisabledRoute("Watch History v3 is required", dependencies);
}

export const disabledWatchHistoryV2Route = createDisabledWatchHistoryV2Route();

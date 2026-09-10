import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_OWNER_HEADER } from "../profile-owner";
import type { ApiSession } from "./api-session";
import { cleanDisplayName, normalizeHandle, type PublicProfile } from "./social";

type ProfileUpdate = { userId: string; displayName?: string; handle?: string | null; avatarUrl?: string | null };
export type ProfilePatchDependencies = {
  getSession(request: NextRequest): Promise<ApiSession | null>;
  readBody(request: NextRequest): Promise<unknown>;
  updateProfile(input: ProfileUpdate): Promise<PublicProfile>;
  errorResponse(error: unknown): NextResponse;
};

function cleanAvatarUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 1000);
  } catch { return undefined; }
}

export function createProfilePatchHandler(dependencies: ProfilePatchDependencies) {
  return async function patchProfile(request: NextRequest) {
    const session = await dependencies.getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const expectedOwner = request.headers.get(PROFILE_OWNER_HEADER);
    if (expectedOwner !== null && expectedOwner !== session.userId) {
      return NextResponse.json({ error: "Account changed. Refresh and try again." }, { status: 409 });
    }
    const body = await dependencies.readBody(request);
    const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
    let displayName: string | undefined;
    let handle: string | null | undefined;
    let avatarUrl: string | null | undefined;
    if ("displayName" in input) {
      const cleaned = cleanDisplayName(input.displayName);
      if (!cleaned) return NextResponse.json({ error: "Invalid displayName" }, { status: 400 });
      displayName = cleaned;
    }
    if ("handle" in input) {
      if (input.handle === null) handle = null;
      else {
        const cleaned = normalizeHandle(input.handle);
        if (!cleaned) return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
        handle = cleaned;
      }
    }
    if ("avatarUrl" in input) {
      const cleaned = cleanAvatarUrl(input.avatarUrl);
      if (cleaned === undefined) return NextResponse.json({ error: "Invalid avatarUrl" }, { status: 400 });
      avatarUrl = cleaned;
    }
    try {
      const profile = await dependencies.updateProfile({ userId: session.userId, displayName, handle, avatarUrl });
      return NextResponse.json({ profile });
    } catch (error) { return dependencies.errorResponse(error); }
  };
}

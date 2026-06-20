import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  cleanDisplayName,
  normalizeHandle,
  SocialApiError,
  updateOwnProfile,
} from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

function cleanAvatarUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 1000);
  } catch {
    return undefined;
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};

  let displayName: string | undefined;
  let handle: string | null | undefined;
  let avatarUrl: string | null | undefined;

  if ("displayName" in input) {
    const cleaned = cleanDisplayName(input.displayName);
    if (!cleaned) {
      return NextResponse.json({ error: "Invalid displayName" }, { status: 400 });
    }
    displayName = cleaned;
  }

  if ("handle" in input) {
    if (input.handle === null) {
      handle = null;
    } else {
      const cleaned = normalizeHandle(input.handle);
      if (!cleaned) {
        return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
      }
      handle = cleaned;
    }
  }

  if ("avatarUrl" in input) {
    const cleaned = cleanAvatarUrl(input.avatarUrl);
    if (cleaned === undefined) {
      return NextResponse.json({ error: "Invalid avatarUrl" }, { status: 400 });
    }
    avatarUrl = cleaned;
  }

  try {
    const profile = await updateOwnProfile({
      userId: session.userId,
      displayName,
      handle,
      avatarUrl,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof SocialApiError) return socialErrorResponse(error);
    return socialErrorResponse(error);
  }
}

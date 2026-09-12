import { type NextRequest } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { updateOwnProfile } from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";
import { createProfilePatchHandler } from "@/lib/anidachi-auth/profile-route";

export const dynamic = "force-dynamic";

const patchProfile = createProfilePatchHandler({
  getSession: getApiSession,
  readBody: readJsonBody,
  updateProfile: updateOwnProfile,
  errorResponse: socialErrorResponse,
});

export async function PATCH(request: NextRequest) {
  return patchProfile(request);
}

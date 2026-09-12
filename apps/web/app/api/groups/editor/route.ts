import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { saveFriendGroup } from "@/lib/anidachi-auth/social";
import {
  readJsonBody,
  socialErrorResponse,
} from "@/lib/anidachi-auth/social-routes";
import { createGroupEditorHandler } from "@/lib/anidachi-auth/group-editor-route";

export const dynamic = "force-dynamic";
export const POST = createGroupEditorHandler({
  getSession: getApiSession,
  readBody: readJsonBody,
  saveGroup: saveFriendGroup,
  errorResponse: socialErrorResponse,
});

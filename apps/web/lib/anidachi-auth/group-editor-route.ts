import { type NextRequest, NextResponse } from "next/server";
import type { ApiSession } from "./api-session";
import { cleanGroupName, isUuid, type saveFriendGroup } from "./social";
import { socialOwnerError } from "./social-routes";
import { SOCIAL_OWNER_HEADER } from "../social-editor-contracts";

type Dependencies = {
  getSession(request: NextRequest): Promise<ApiSession | null>;
  readBody(request: NextRequest): Promise<unknown>;
  saveGroup: typeof saveFriendGroup;
  errorResponse(error: unknown): NextResponse;
};
export function createGroupEditorHandler(deps: Dependencies) {
  return async function post(request: NextRequest) {
    const session = await deps.getSession(request);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownerError = socialOwnerError(request, session.userId);
    if (ownerError) return ownerError;
    if (!request.headers.get(SOCIAL_OWNER_HEADER))
      return NextResponse.json(
        { error: "Reload this account before saving." },
        { status: 409 },
      );
    const body = (await deps.readBody(request)) as Record<
      string,
      unknown
    > | null;
    const name = cleanGroupName(body?.name);
    if (
      !body ||
      !name ||
      typeof body.groupId !== "string" ||
      !isUuid(body.groupId) ||
      typeof body.create !== "boolean" ||
      !Array.isArray(body.memberIds) ||
      body.memberIds.length > 100 ||
      !body.memberIds.every((id) => typeof id === "string" && isUuid(id)) ||
      (!body.create &&
        (typeof body.expectedUpdatedAt !== "string" ||
          !Number.isFinite(Date.parse(body.expectedUpdatedAt))))
    ) {
      return NextResponse.json(
        { error: "Check the group name and selected friends." },
        { status: 400 },
      );
    }
    try {
      const group = await deps.saveGroup({
        ownerUserId: session.userId,
        groupId: body.groupId,
        name,
        memberIds: [...new Set(body.memberIds as string[])],
        create: body.create,
        expectedUpdatedAt: body.create
          ? null
          : (body.expectedUpdatedAt as string),
      });
      return NextResponse.json({ group });
    } catch (error) {
      return deps.errorResponse(error);
    }
  };
}

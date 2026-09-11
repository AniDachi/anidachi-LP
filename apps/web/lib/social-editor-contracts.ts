import {
  FriendGroupSchema,
  FriendGroupsResponseSchema,
  FriendListResponseSchema,
} from "@anidachi/protocol";

export const SOCIAL_OWNER_HEADER = "x-anidachi-social-owner";
const unavailable = "Account data is temporarily unavailable. Try again.";
export function parseFriendDirectory(value: unknown) {
  const result = FriendListResponseSchema.safeParse(value);
  if (!result.success) throw new Error(unavailable);
  return result.data;
}
export function parseGroupDirectory(value: unknown) {
  const result = FriendGroupsResponseSchema.safeParse(value);
  if (!result.success) throw new Error(unavailable);
  return result.data;
}
export function parseSavedGroup(value: unknown) {
  const result = FriendGroupSchema.safeParse(
    value && typeof value === "object" && "group" in value ? value.group : null,
  );
  if (!result.success) throw new Error(unavailable);
  return result.data;
}

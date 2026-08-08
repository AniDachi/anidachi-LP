import {
  RecentPeopleResponseSchema,
  type RecentPeopleResponse,
} from "@anidachi/protocol";

const INVALID_ACCOUNT_RESPONSE_MESSAGE =
  "Account data is temporarily unavailable. Try again.";

export function parseRecentPeopleResponse(value: unknown): RecentPeopleResponse {
  const result = RecentPeopleResponseSchema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(INVALID_ACCOUNT_RESPONSE_MESSAGE);
}

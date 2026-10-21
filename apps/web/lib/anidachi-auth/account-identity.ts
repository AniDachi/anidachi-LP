import { cache } from "react";
import { getUserIdentityById } from "./db";
import { ensureProfileForUser } from "./social";

// React.cache is scoped to a Server Component render, not a shared user cache.
// Do not use this for API authorization or the history before/after fences.
export const getAccountIdentity = cache(async (userId: string) => {
  const user = await getUserIdentityById(userId);
  const profile = user ? await ensureProfileForUser(userId, user) : null;
  return { user, profile };
});

import { cache } from "react";
import { getUserById } from "./db";
import { ensureProfileForUser } from "./social";

// React.cache is scoped to a Server Component render, not a shared user cache.
// Do not use this for API authorization or the history before/after fences.
export const getAccountIdentity = cache(async (userId: string) => {
  const [user, profile] = await Promise.all([
    getUserById(userId),
    ensureProfileForUser(userId),
  ]);
  return { user, profile };
});

import { NavBarClient } from "@/components/nav-bar-client";
import { getSession } from "@/lib/anidachi-auth/session";
import { getUserById } from "@/lib/anidachi-auth/db";

export async function NavBar() {
  let navUser: { displayName: string; avatarUrl: string | null; email: string; plan: string } | null = null;

  try {
    const session = await getSession();
    if (session) {
      const user = await getUserById(session.userId);
      if (user) {
        navUser = {
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          email: user.email,
          plan: user.plan,
        };
      }
    }
  } catch {
    // DB unavailable (e.g. missing env vars in dev) — render nav without user
  }

  return <NavBarClient user={navUser} />;
}

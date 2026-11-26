import { RoomLobbyProviderSchema, RoomSourceProviderSchema, type RoomSourceProvider } from "@anidachi/protocol";
import { db } from "./anidachi-auth/db";

export type InviteTicketDetails = {
  title: string;
  host?: string | null;
  episode?: string | null;
  provider?: RoomSourceProvider | null;
};

export function roomTicketDetails(room: {
  title: string | null; episode_id: string | null; source_provider: unknown; lobby_provider?: unknown;
}, host: string | null, lobbyHint?: unknown): InviteTicketDetails {
  const source = RoomSourceProviderSchema.safeParse(room.source_provider).data;
  const lobby = RoomLobbyProviderSchema.safeParse(room.lobby_provider ?? lobbyHint).data;
  return {
    title: !source && lobby ? "Let’s pick something together" : room.title?.trim() || "Watch together",
    host, episode: room.episode_id, provider: source ?? lobby,
  };
}

// A copied invite grants a read-only preview. Membership, launch details and user
// records stay on authenticated routes. Never select a full room or user here.
export async function readInviteTicket(returnTo: string): Promise<InviteTicketDetails | null> {
  const path = new URL(returnTo, "https://www.anidachi.app");
  const match = /^\/room\/([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\/?$/i.exec(path.pathname);
  if (!match || path.origin !== "https://www.anidachi.app") return null;
  const { data, error } = await db().from("rooms")
    .select("title,episode_id,source_provider,lobby_provider,host:users!rooms_host_user_id_fkey(display_name)")
    .eq("room_id", match[1])
    .in("status", ["lobby", "live"])
    .is("ended_at", null)
    .maybeSingle<{
      title: string | null; episode_id: string | null; source_provider: string | null;
      lobby_provider: string | null; host: { display_name: string | null } | null;
    }>();
  if (error) throw new Error("Could not load invitation details");
  return data ? roomTicketDetails(data, data.host?.display_name ?? null, path.searchParams.get("lobby")) : null;
}

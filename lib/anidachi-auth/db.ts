import { createClient } from "@supabase/supabase-js";

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export function db() {
  return getSupabaseServiceClient();
}

// ---------- Typed row shapes ----------

export type UserRow = {
  id: string;
  email: string;
  discord_id: string | null;
  google_id: string | null;
  display_name: string;
  avatar_url: string | null;
  plan: "watcher" | "nakama" | "junkie";
  created_at: string;
};

export type RoomRow = {
  id: string;
  room_id: string;
  host_user_id: string;
  show_id: string | null;
  episode_id: string | null;
  status: "lobby" | "live" | "ended";
  created_at: string;
};

// ---------- User helpers ----------

export async function upsertUser(params: {
  email: string;
  display_name: string;
  avatar_url?: string | null;
  discord_id?: string | null;
  google_id?: string | null;
}): Promise<UserRow> {
  const client = db();

  // Try to find existing user by email first
  const { data: existing } = await client
    .from("users")
    .select("*")
    .eq("email", params.email)
    .maybeSingle();

  if (existing) {
    const updates: Partial<UserRow> = {
      display_name: params.display_name,
      avatar_url: params.avatar_url ?? existing.avatar_url,
    };
    if (params.discord_id) updates.discord_id = params.discord_id;
    if (params.google_id) updates.google_id = params.google_id;

    const { data, error } = await client
      .from("users")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update user: ${error.message}`);
    return data as UserRow;
  }

  const { data, error } = await client
    .from("users")
    .insert({
      email: params.email,
      display_name: params.display_name,
      avatar_url: params.avatar_url ?? null,
      discord_id: params.discord_id ?? null,
      google_id: params.google_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as UserRow;
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const { data } = await db()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as UserRow | null) ?? null;
}

// ---------- Refresh token helpers ----------

import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export async function storeRefreshToken(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  const { error } = await db().from("refresh_tokens").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Failed to store refresh token: ${error.message}`);
}

export async function validateRefreshToken(
  token: string
): Promise<string | null> {
  const hash = hashToken(token);
  const { data } = await db()
    .from("refresh_tokens")
    .select("user_id, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.user_id as string;
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await db()
    .from("refresh_tokens")
    .delete()
    .eq("token_hash", hashToken(token));
}

export async function deleteAllRefreshTokensForUser(
  userId: string
): Promise<void> {
  await db().from("refresh_tokens").delete().eq("user_id", userId);
}

// ---------- Room helpers ----------

export async function createRoom(params: {
  hostUserId: string;
  showId?: string;
  episodeId?: string;
}): Promise<RoomRow> {
  const { data, error } = await db()
    .from("rooms")
    .insert({
      host_user_id: params.hostUserId,
      show_id: params.showId ?? null,
      episode_id: params.episodeId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return data as RoomRow;
}

export async function getRoomById(roomId: string): Promise<RoomRow | null> {
  const { data } = await db()
    .from("rooms")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function countActiveRoomsForHost(
  hostUserId: string
): Promise<number> {
  const { count } = await db()
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", hostUserId)
    .neq("status", "ended");
  return count ?? 0;
}

export async function addRoomMember(
  roomId: string,
  userId: string
): Promise<void> {
  const { error } = await db()
    .from("room_members")
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: "room_id,user_id" });
  if (error) throw new Error(`Failed to add room member: ${error.message}`);
}

export async function isRoomMember(
  roomId: string,
  userId: string
): Promise<boolean> {
  const { data } = await db()
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

export async function getRoomMemberCount(roomId: string): Promise<number> {
  const { count } = await db()
    .from("room_members")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", roomId);
  return count ?? 0;
}

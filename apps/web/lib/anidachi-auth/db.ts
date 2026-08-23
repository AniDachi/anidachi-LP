import type {
  ActiveRoomConflictResponse,
  ActiveRoomRole,
  RoomSourcePersistenceAcknowledgement,
  RoomSourcePersistenceCallback,
  RoomSourceProvider,
  RoomUsageSummary,
} from "@anidachi/protocol";
import { createClient } from "@supabase/supabase-js";
import {
  parseActiveRoomClaimRpcResult,
  parseActiveRoomCreateRpcResult,
  parseActiveRoomReleaseRpcResult,
  parseHostLobbyEndRpcResult,
} from "./active-room-session";
import type { PlanCode, RoomCapabilities } from "./plan-entitlements";
import {
  parseRoomSourcePersistenceRpcResult,
  roomSourceCreationColumns,
  roomSourcePersistenceErrorFromDatabase,
  roomSourcePersistenceRpcArguments,
} from "./room-source";

const UNIQUE_VIOLATION = "23505";

export function databaseResultOrThrow<T>(
  operation: string,
  result: { data: T | null; error: { message: string } | null },
): T | null {
  if (result.error) {
    throw new Error(`Failed to ${operation}: ${result.error.message}`);
  }
  return result.data;
}

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
  plan: PlanCode;
  created_at: string;
};

type ProfileSyncRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type BillingCustomerRow = {
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan_code: PlanCode;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type RoomRow = {
  id: string;
  room_id: string;
  host_user_id: string;
  show_id: string | null;
  episode_id: string | null;
  source_provider: RoomSourceProvider | null;
  source_url: string | null;
  video_fingerprint: string | null;
  source_generation: number | null;
  title: string | null;
  status: "lobby" | "live" | "ended";
  created_at: string;
  client_request_id: string | null;
  last_active_at: string;
  ended_at: string | null;
  host_connected_at: string | null;
  host_plan_code: PlanCode;
  max_participants: number;
  max_media_seats: number;
  can_name_room: boolean;
  can_send_push_invites: boolean;
};

export type RoomMemberRow = {
  room_id: string;
  user_id: string;
  joined_at: string;
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
    await syncProfileFromUserRow(data as UserRow);
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
  await syncProfileFromUserRow(data as UserRow);
  return data as UserRow;
}

async function syncProfileFromUserRow(user: UserRow): Promise<void> {
  const client = db();
  const { data: existing, error: readError } = await client
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) throw new Error(`Failed to load profile: ${readError.message}`);

  if (existing) {
    const profile = existing as ProfileSyncRow;
    const updates: Partial<ProfileSyncRow> & { updated_at?: string } = {};
    if (!profile.avatar_url && user.avatar_url) updates.avatar_url = user.avatar_url;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await client.from("profiles").update(updates).eq("user_id", user.id);
      if (error) throw new Error(`Failed to sync profile: ${error.message}`);
    }
    return;
  }

  const { error } = await client.from("profiles").insert({
    user_id: user.id,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
  });
  if (!error || error.code === UNIQUE_VIOLATION) return;

  throw new Error(`Failed to sync profile: ${error.message}`);
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const result = await db()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return databaseResultOrThrow("load user", {
    data: (result.data as UserRow | null) ?? null,
    error: result.error,
  });
}

// ---------- Refresh token helpers ----------

import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export type RefreshChannel = "website" | "extension";

export type RefreshRotationOutcome = "rotated" | "reused" | "replayed" | "invalid";

export type RefreshRotationRow = {
  rotation_outcome: RefreshRotationOutcome;
  user_id: string | null;
  family_id: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isRefreshRotationOutcome(value: unknown): value is RefreshRotationOutcome {
  return value === "rotated" || value === "reused" || value === "replayed" || value === "invalid";
}

export function parseRefreshTokenResolutionResult(value: unknown): string | null {
  if (value === null) return null;
  if (!isUuid(value)) {
    throw new Error("Malformed refresh token resolution response");
  }
  return value;
}

export function parseRefreshTokenRotationResult(value: unknown): RefreshRotationRow {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("Malformed refresh token rotation response");
  }

  const row = value[0];
  if (
    typeof row !== "object" ||
    row === null ||
    Array.isArray(row) ||
    Object.keys(row).sort().join(",") !== "family_id,rotation_outcome,user_id"
  ) {
    throw new Error("Malformed refresh token rotation response");
  }

  const { rotation_outcome: outcome, user_id: userId, family_id: familyId } = row as Record<
    string,
    unknown
  >;
  if (
    !isRefreshRotationOutcome(outcome) ||
    !isNullableUuid(userId) ||
    !isNullableUuid(familyId)
  ) {
    throw new Error("Malformed refresh token rotation response");
  }

  const coherent =
    ((outcome === "rotated" || outcome === "reused") && userId !== null && familyId !== null) ||
    (outcome === "replayed" && userId === null && familyId !== null) ||
    (outcome === "invalid" && userId === null);
  if (!coherent) {
    throw new Error("Malformed refresh token rotation response");
  }

  return {
    rotation_outcome: outcome,
    user_id: userId,
    family_id: familyId,
  };
}

export async function createRefreshTokenFamily(
  userId: string,
  token: string,
  channel: RefreshChannel,
  deviceId: string | null = null,
): Promise<void> {
  const result = await db().rpc("create_refresh_token_family_v1", {
    p_user_id: userId,
    p_channel: channel,
    p_token_hash: hashToken(token),
    p_device_id: deviceId,
  });
  databaseResultOrThrow("create refresh token family", result);
}

export async function resolveRefreshTokenFamily(
  token: string,
  channel: RefreshChannel,
): Promise<string | null> {
  const result = await db().rpc("resolve_refresh_token_family_v1", {
    p_token_hash: hashToken(token),
    p_channel: channel,
  });
  const resolved = databaseResultOrThrow(
    "resolve refresh token family",
    result as { data: unknown; error: { message: string } | null },
  );
  return parseRefreshTokenResolutionResult(resolved);
}

export async function rotateRefreshTokenFamily(
  token: string,
  successorToken: string,
  channel: RefreshChannel,
): Promise<RefreshRotationRow> {
  const result = await db().rpc("rotate_refresh_token_family_v1", {
    p_token_hash: hashToken(token),
    p_successor_token_hash: hashToken(successorToken),
    p_channel: channel,
  });
  const rows = databaseResultOrThrow(
    "rotate refresh token family",
    result as { data: unknown; error: { message: string } | null },
  );
  return parseRefreshTokenRotationResult(rows);
}

export async function revokeRefreshTokenFamily(
  token: string,
  channel: RefreshChannel,
): Promise<void> {
  const result = await db().rpc("revoke_refresh_token_family_v1", {
    p_token_hash: hashToken(token),
    p_channel: channel,
  });
  databaseResultOrThrow("revoke refresh token family", result);
}

export async function revokeAllRefreshTokenFamiliesForUser(
  userId: string
): Promise<void> {
  const result = await db().rpc("revoke_refresh_token_families_for_user_v1", {
    p_user_id: userId,
  });
  databaseResultOrThrow("revoke user refresh token families", result);
}

// ---------- Billing helpers ----------

export async function getBillingCustomerByUserId(
  userId: string
): Promise<BillingCustomerRow | null> {
  const { data } = await db()
    .from("billing_customers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as BillingCustomerRow | null) ?? null;
}

export async function getUserIdByStripeCustomerId(
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await db()
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

export async function upsertBillingCustomer(params: {
  userId: string;
  stripeCustomerId: string;
}): Promise<void> {
  const { error } = await db().from("billing_customers").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Failed to upsert billing customer: ${error.message}`);
}

export async function beginStripeEventProcessing(params: {
  eventId: string;
  eventType: string;
}): Promise<boolean> {
  const { error } = await db().from("stripe_events").insert({
    event_id: params.eventId,
    event_type: params.eventType,
  });
  if (!error) return true;

  if (error.code === UNIQUE_VIOLATION) {
    const { data, error: readError } = await db()
      .from("stripe_events")
      .select("processed_at")
      .eq("event_id", params.eventId)
      .maybeSingle();
    if (readError) {
      throw new Error(`Failed to read Stripe event: ${readError.message}`);
    }
    return !data?.processed_at;
  }

  throw new Error(`Failed to record Stripe event: ${error.message}`);
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const { error } = await db()
    .from("stripe_events")
    .update({
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to mark Stripe event processed: ${error.message}`);
}

export async function markStripeEventFailed(
  eventId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await db()
    .from("stripe_events")
    .update({
      last_error: errorMessage.slice(0, 2000),
    })
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to mark Stripe event failed: ${error.message}`);
}

export async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  planCode: PlanCode;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const { error } = await db().from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_price_id: params.stripePriceId,
      plan_code: params.planCode,
      status: params.status,
      current_period_end: params.currentPeriodEnd,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) throw new Error(`Failed to upsert subscription: ${error.message}`);
}

export async function listSubscriptionsForUser(
  userId: string
): Promise<SubscriptionRow[]> {
  const { data, error } = await db()
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to list subscriptions: ${error.message}`);
  return (data as SubscriptionRow[] | null) ?? [];
}

export async function updateUserPlan(
  userId: string,
  plan: PlanCode
): Promise<void> {
  const { error } = await db().from("users").update({ plan }).eq("id", userId);
  if (error) throw new Error(`Failed to update user plan: ${error.message}`);
}

// ---------- Room helpers ----------

type ActiveRoomSummary = ActiveRoomConflictResponse["activeRoom"];

export type ActiveRoomCreateResult =
  | {
      outcome: "claimed" | "reused";
      room: RoomRow;
    }
  | { outcome: "conflict"; activeRoom: ActiveRoomSummary };

export type ActiveRoomClaimResult =
  | { outcome: "claimed" | "reused" }
  | { outcome: "conflict"; activeRoom: ActiveRoomSummary };

export async function createRoomWithActiveSession(params: {
  hostUserId: string;
  participantSessionId: string;
  capabilities: RoomCapabilities;
  showId?: string;
  episodeId?: string;
  sourceProvider?: unknown;
  sourceUrl?: unknown;
  videoFingerprint?: unknown;
  title?: string;
  clientRequestId?: string;
}): Promise<ActiveRoomCreateResult> {
  const sourceColumns = roomSourceCreationColumns({
    sourceProvider: params.sourceProvider,
    sourceUrl: params.sourceUrl,
    videoFingerprint: params.videoFingerprint,
  });
  const result = await db().rpc("create_room_with_active_session_v1", {
    p_host_user_id: params.hostUserId,
    p_participant_session_id: params.participantSessionId,
    p_show_id: params.showId ?? null,
    p_episode_id: params.episodeId ?? null,
    p_source_provider: sourceColumns.source_provider,
    p_source_url: sourceColumns.source_url,
    p_video_fingerprint: sourceColumns.video_fingerprint,
    p_source_generation: sourceColumns.source_generation,
    p_title: params.title ?? null,
    p_client_request_id: params.clientRequestId ?? null,
    p_host_plan_code: params.capabilities.hostPlanCode,
    p_max_participants: params.capabilities.maxParticipants,
    p_max_media_seats: params.capabilities.maxMediaSeats,
    p_can_name_room: params.capabilities.canNameRoom,
    p_can_send_push_invites: params.capabilities.canSendPushInvites,
  });
  if (result.error) {
    throw new Error(`Failed to create active room: ${result.error.message}`);
  }
  const parsed = parseActiveRoomCreateRpcResult(result.data);
  if (parsed.outcome === "conflict") return parsed;
  return {
    outcome: parsed.outcome,
    room: parsed.roomRecord as RoomRow,
  };
}

export async function claimActiveRoomSession(params: {
  userId: string;
  roomId: string;
  role: ActiveRoomRole;
  participantSessionId: string;
}): Promise<ActiveRoomClaimResult> {
  const result = await db().rpc("claim_active_room_session_v1", {
    p_user_id: params.userId,
    p_room_id: params.roomId,
    p_role: params.role,
    p_participant_session_id: params.participantSessionId,
  });
  if (result.error) {
    throw new Error(`Failed to claim active room: ${result.error.message}`);
  }
  return parseActiveRoomClaimRpcResult(result.data);
}

export async function releaseActiveRoomSession(params: {
  userId: string;
  roomId: string;
  participantSessionId: string;
}): Promise<{ outcome: "released" | "stale" }> {
  const result = await db().rpc("release_active_room_session_v1", {
    p_user_id: params.userId,
    p_room_id: params.roomId,
    p_participant_session_id: params.participantSessionId,
  });
  if (result.error) {
    throw new Error(`Failed to release active room: ${result.error.message}`);
  }
  return parseActiveRoomReleaseRpcResult(result.data);
}

export async function endHostLobbyForActiveSession(params: {
  userId: string;
  roomId: string;
  participantSessionId: string;
  endedAt: string;
}): Promise<{ outcome: "room_ended" | "stale" }> {
  const result = await db().rpc("end_host_lobby_for_active_session_v1", {
    p_user_id: params.userId,
    p_room_id: params.roomId,
    p_participant_session_id: params.participantSessionId,
    p_ended_at: params.endedAt,
  });
  if (result.error) {
    throw new Error(`Failed to end active host lobby: ${result.error.message}`);
  }
  return parseHostLobbyEndRpcResult(result.data);
}

/**
 * Creates a room. When `clientRequestId` is provided the create is idempotent:
 * retrying (double click, network retry) returns the existing non-ended room
 * instead of creating a duplicate, enforced by the partial unique index
 * `uniq_rooms_host_client_request`.
 */
export async function createRoom(params: {
  hostUserId: string;
  capabilities: RoomCapabilities;
  showId?: string;
  episodeId?: string;
  sourceProvider?: unknown;
  sourceUrl?: unknown;
  videoFingerprint?: unknown;
  title?: string;
  clientRequestId?: string;
}): Promise<{ room: RoomRow; reused: boolean }> {
  const sourceColumns = roomSourceCreationColumns({
    sourceProvider: params.sourceProvider,
    sourceUrl: params.sourceUrl,
    videoFingerprint: params.videoFingerprint,
  });
  const { data, error } = await db()
    .from("rooms")
    .insert({
      host_user_id: params.hostUserId,
      show_id: params.showId ?? null,
      episode_id: params.episodeId ?? null,
      ...sourceColumns,
      title: params.title ?? null,
      client_request_id: params.clientRequestId ?? null,
      host_connected_at: new Date().toISOString(),
      host_plan_code: params.capabilities.hostPlanCode,
      max_participants: params.capabilities.maxParticipants,
      max_media_seats: params.capabilities.maxMediaSeats,
      can_name_room: params.capabilities.canNameRoom,
      can_send_push_invites: params.capabilities.canSendPushInvites,
    })
    .select()
    .single();

  if (!error) return { room: data as RoomRow, reused: false };

  if (error.code === UNIQUE_VIOLATION && params.clientRequestId) {
    const existing = await getActiveRoomByClientRequestId(
      params.hostUserId,
      params.clientRequestId
    );
    if (existing) return { room: existing, reused: true };
  }

  throw new Error(`Failed to create room: ${error.message}`);
}

export async function persistRoomSource(
  callback: RoomSourcePersistenceCallback,
): Promise<RoomSourcePersistenceAcknowledgement> {
  const result = await db().rpc(
    "persist_room_source_v1",
    roomSourcePersistenceRpcArguments(callback),
  );
  if (result.error) {
    throw roomSourcePersistenceErrorFromDatabase(result.error);
  }
  return parseRoomSourcePersistenceRpcResult(
    result.data,
    callback.sourceGeneration,
  );
}

export function roomCapabilitiesFromRoom(room: RoomRow): RoomCapabilities {
  return {
    hostPlanCode: room.host_plan_code,
    maxParticipants: room.max_participants,
    maxMediaSeats: room.max_media_seats,
    canNameRoom: room.can_name_room,
    canSendPushInvites: room.can_send_push_invites,
  };
}

export async function getActiveRoomByClientRequestId(
  hostUserId: string,
  clientRequestId: string
): Promise<RoomRow | null> {
  const { data } = await db()
    .from("rooms")
    .select("*")
    .eq("host_user_id", hostUserId)
    .eq("client_request_id", clientRequestId)
    .neq("status", "ended")
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function updateRoom(
  roomId: string,
  fields: Partial<
    Pick<RoomRow, "status" | "last_active_at" | "ended_at" | "host_connected_at">
  >
): Promise<void> {
  const { error } = await db().from("rooms").update(fields).eq("room_id", roomId);
  if (error) throw new Error(`Failed to update room: ${error.message}`);
}

export async function finalizeRoomUsage(
  roomId: string,
  endedAt: string,
  usage?: RoomUsageSummary,
): Promise<{ alreadyEnded: boolean; finalizedAt: string }> {
  const { data, error } = await db().rpc("finalize_room_usage", {
    p_room_id: roomId,
    p_ended_at: endedAt,
    p_usage_day: usage?.day ?? null,
    p_usage_seconds: usage?.seconds ?? null,
  });
  if (error) throw new Error(`Failed to finalize room usage: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : null;
  if (
    !row ||
    typeof row.already_ended !== "boolean" ||
    typeof row.finalized_at !== "string"
  ) {
    throw new Error("Failed to finalize room usage: invalid database response");
  }
  return {
    alreadyEnded: row.already_ended,
    finalizedAt: row.finalized_at,
  };
}

export async function getRoomById(roomId: string): Promise<RoomRow | null> {
  const { data } = await db()
    .from("rooms")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

// ---------- Usage metering helpers (PD2 daily host quota) ----------

export async function getUsageSecondsForDay(
  userId: string,
  day: string
): Promise<number> {
  const { data, error } = await db()
    .from("usage_daily")
    .select("host_seconds")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw new Error(`Failed to read room usage: ${error.message}`);
  return (data?.host_seconds as number | undefined) ?? 0;
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

export async function listRoomMembers(roomId: string): Promise<RoomMemberRow[]> {
  const { data, error } = await db()
    .from("room_members")
    .select("room_id,user_id,joined_at")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(`Failed to list room members: ${error.message}`);
  return (data as RoomMemberRow[] | null) ?? [];
}

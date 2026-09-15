import { z } from "zod";

/** Read-only daily quota view. Room admission and live metering remain server-owned. */
export const RoomQuotaStatusSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ownerUserId: z.uuid(),
  serverTime: z.iso.datetime({ offset: true }),
  quota: z.strictObject({
    remainingSeconds: z.number().int().min(0).max(1800),
    resetAt: z.iso.datetime({ offset: true }),
  }).nullable(),
}).refine((value) => {
  if (!value.quota) return true;
  const now = new Date(value.serverTime);
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Date.parse(value.quota.resetAt) === nextMidnight;
}, "Quota resets at the next server UTC midnight");

export type RoomQuotaStatus = z.infer<typeof RoomQuotaStatusSchema>;
export const ROOM_QUOTA_OWNER_HEADER = "x-anidachi-quota-owner";

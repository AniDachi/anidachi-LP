import { z } from "zod";

/** Saved canonical titles, independently per provider and identically on Plus/Pro. */
export const WATCH_HISTORY_PROVIDER_LIMITS = {
	youtube: 100,
	crunchyroll: 200,
} as const;

export const WatchHistoryCapacitySchema = z.strictObject({
	capacityVersion: z.literal(1),
	ownerUserId: z.uuid(),
	accountGeneration: z.number().int().positive(),
	serverTime: z.iso.datetime(),
	providers: z.strictObject({
		youtube: z.strictObject({
			used: z.number().int().nonnegative(),
			limit: z.literal(WATCH_HISTORY_PROVIDER_LIMITS.youtube),
		}),
		crunchyroll: z.strictObject({
			used: z.number().int().nonnegative(),
			limit: z.literal(WATCH_HISTORY_PROVIDER_LIMITS.crunchyroll),
		}),
	}),
});
export type WatchHistoryCapacity = z.infer<typeof WatchHistoryCapacitySchema>;

import { z } from "zod";

/** Saved canonical titles, independently per provider and identically on Plus/Pro. */
export const WATCH_HISTORY_PROVIDER_LIMITS = {
	youtube: 100,
	crunchyroll: 200,
} as const;

export const WatchHistoryCapacityV1Schema = z.strictObject({
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
/** Legacy default remains exact v1 until a client explicitly negotiates v2. */
export const WatchHistoryCapacitySchema = WatchHistoryCapacityV1Schema;
export type WatchHistoryCapacityV1 = z.infer<typeof WatchHistoryCapacityV1Schema>;
export type WatchHistoryCapacity = WatchHistoryCapacityV1;
export const WATCH_HISTORY_PROVIDER_LIMITS_V2 = { ...WATCH_HISTORY_PROVIDER_LIMITS, netflix: 200 } as const;
export const WatchHistoryCapacityV2Schema = WatchHistoryCapacityV1Schema.extend({
  capacityVersion: z.literal(2),
  providers: WatchHistoryCapacityV1Schema.shape.providers.extend({
    netflix: z.strictObject({ used: z.number().int().nonnegative(), limit: z.literal(WATCH_HISTORY_PROVIDER_LIMITS_V2.netflix) }),
  }),
});
export const WATCH_HISTORY_PROVIDER_LIMITS_V3 = { ...WATCH_HISTORY_PROVIDER_LIMITS_V2, primevideo: 200 } as const;
export const WatchHistoryCapacityV3Schema = WatchHistoryCapacityV2Schema.extend({
  capacityVersion: z.literal(3),
  providers: WatchHistoryCapacityV2Schema.shape.providers.extend({
    primevideo: z.strictObject({ used: z.number().int().nonnegative(), limit: z.literal(WATCH_HISTORY_PROVIDER_LIMITS_V3.primevideo) }),
  }),
});
export const WATCH_HISTORY_PROVIDER_LIMITS_V4 = { ...WATCH_HISTORY_PROVIDER_LIMITS_V3, disneyplus: 200 } as const;
export const WatchHistoryCapacityV4Schema = WatchHistoryCapacityV3Schema.extend({
  capacityVersion: z.literal(4),
  providers: WatchHistoryCapacityV3Schema.shape.providers.extend({
    disneyplus: z.strictObject({ used: z.number().int().nonnegative(), limit: z.literal(WATCH_HISTORY_PROVIDER_LIMITS_V4.disneyplus) }),
  }),
});
export type WatchHistoryCapacityV4 = z.infer<typeof WatchHistoryCapacityV4Schema>;
export type WatchHistoryCapacityV3 = z.infer<typeof WatchHistoryCapacityV3Schema>;
export const WatchHistoryCapacityCompatibleSchema = z.discriminatedUnion("capacityVersion", [WatchHistoryCapacityV1Schema, WatchHistoryCapacityV2Schema, WatchHistoryCapacityV3Schema, WatchHistoryCapacityV4Schema]);
export type WatchHistoryCapacityV2 = z.infer<typeof WatchHistoryCapacityV2Schema>;
export type WatchHistoryCapacityCompatible = z.infer<typeof WatchHistoryCapacityCompatibleSchema>;

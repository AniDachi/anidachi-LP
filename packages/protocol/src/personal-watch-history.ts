import { z } from "zod";
import { WatchProgressEventSchema } from "./watch-history";

// Keep v3 identity/source refinements. Omit() on the refined schema would lose
// those checks. Even sharedRoom:null is forbidden on the personal write path.
export const PersonalWatchProgressEventSchema =
	WatchProgressEventSchema.safeExtend({ sharedRoom: z.never().optional() })
		.superRefine((event, ctx) => {
			if (Object.hasOwn(event, "sharedRoom"))
				ctx.addIssue({
					code: "custom",
					path: ["sharedRoom"],
					message: "Personal capture cannot contain shared room authority",
				});
		})
		.transform(({ sharedRoom: _sharedRoom, ...event }) => event);
export const PersonalWatchProgressRequestSchema = z.strictObject({
	captureVersion: z.literal(1),
	accessEpoch: z.number().int().nonnegative(),
	youtubeConsentEpoch: z.number().int().nonnegative(),
	clientSequence: z.number().int().positive(),
	event: PersonalWatchProgressEventSchema,
});
export type PersonalWatchProgressEvent = z.infer<
	typeof PersonalWatchProgressEventSchema
>;
export type PersonalWatchProgressRequest = z.infer<
	typeof PersonalWatchProgressRequestSchema
>;
// Legacy WatchProgressEventSchema stays available for compatibility reads/tests.
// At cutover the HTTP writer must explicitly reject legacy bodies with 426;
// do not union them into the new personal writer or silently strip sharedRoom.
export const WatchHistoryAccessErrorCodeSchema = z.enum([
	"UNAUTHORIZED",
	"HISTORY_PLAN_REQUIRED",
	"HISTORY_ACCESS_CHANGED",
	"HISTORY_CLIENT_UPDATE_REQUIRED",
	"HISTORY_ACCESS_UNAVAILABLE",
]);

import { z } from "zod";
import {
	PrimeVideoProviderIdSchema,
	PersonalHistoryResumeSchema,
	PrimeNavigationSchema,
	type PrimeNavigation,
} from "@anidachi/protocol";
const OwnerSchema = z.strictObject({
	userId: z.string().min(1).max(128),
	loginId: z.string().min(1).max(256),
	generation: z.number().int().positive(),
});
export type PrimeLaunchOwner = z.infer<typeof OwnerSchema>;
export const PrimePendingSchema = z
	.strictObject({
		intentId: z.uuid(),
		contentId: PrimeVideoProviderIdSchema,
		owner: OwnerSchema,
		roomId: z.string().min(1).max(128).optional(),
		resume: PersonalHistoryResumeSchema.optional(),
		expiresAt: z.number().int().positive(),
		attempts: z.number().int().min(0).max(1),
		navigation: PrimeNavigationSchema.optional(),
	})
	.refine((v) => !!v.roomId !== !!v.resume)
	.refine((v) => !v.navigation || v.navigation.contentId === v.contentId)
	.refine(
		(v) =>
			!v.resume ||
			v.resume.sourceUrl === `https://www.primevideo.com/detail/${v.contentId}`,
	);
export type PrimePending = z.infer<typeof PrimePendingSchema>;
export type PrimePendingStorage = {
	get(): Promise<unknown>;
	set(value: unknown): Promise<void>;
	remove(): Promise<void>;
};
/** The background serializes operations; storage.session survives worker restarts. */
export function createPrimePendingStore(storage: PrimePendingStorage) {
	const read = async () => {
		const raw = await storage.get();
		return raw && typeof raw === "object" && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	};
	const valid = (v: unknown, now: number) => {
		const parsed = PrimePendingSchema.safeParse(v);
		return parsed.success &&
			parsed.data.expiresAt > now &&
			parsed.data.expiresAt <= now + 300000
			? parsed.data
			: null;
	};
	return {
		async put(tab: number, pending: PrimePending, now = Date.now()) {
			if (!Number.isInteger(tab) || tab < 0 || !valid(pending, now))
				throw new Error("Invalid launch");
			const root = await read();
			for (const key of Object.keys(root)) {
				const entry = root[key] as
					| { retired?: boolean; expiresAt?: number }
					| undefined;
				if (
					!valid(entry, now) &&
					!(
						entry?.retired === true &&
						typeof entry.expiresAt === "number" &&
						entry.expiresAt > now
					)
				)
					delete root[key];
			}
			if (Object.keys(root).length >= 64 && !root[String(tab)])
				throw new Error("Too many launches");
			root[String(tab)] = pending;
			await storage.set(root);
		},
		async peek(tab: number, owner: PrimeLaunchOwner, now = Date.now()) {
			const root = await read(),
				pending = valid(root[String(tab)], now);
			if (!pending || JSON.stringify(pending.owner) !== JSON.stringify(owner)) {
				if (root[String(tab)]) {
					root[String(tab)] = { retired: true, expiresAt: now + 300000 };
					await storage.set(root);
				}
				return null;
			}
			return pending;
		},
		async retireAll() {
			const root = await read();
			for (const key of Object.keys(root))
				root[key] = { retired: true, expiresAt: Date.now() + 300000 };
			await storage.set(root);
		},
		async forget(tab: number) {
			const root = await read();
			delete root[String(tab)];
			await storage.set(root);
		},
		async has(tab: number) {
			return Object.hasOwn(await read(), String(tab));
		},
		async cancel(tab: number) {
			const root = await read();
			if (root[String(tab)]) {
				root[String(tab)] = { retired: true, expiresAt: Date.now() + 300000 };
				await storage.set(root);
			}
		},
		async take(
			tab: number,
			owner: PrimeLaunchOwner,
			id: string,
			now = Date.now(),
		) {
			const root = await read(),
				pending = valid(root[String(tab)], now);
			if (
				pending &&
				JSON.stringify(pending.owner) === JSON.stringify(owner) &&
				pending.contentId !== id
			)
				return null;
			if (root[String(tab)]) {
				root[String(tab)] = { retired: true, expiresAt: now + 300000 };
				await storage.set(root);
			}
			return pending &&
                pending.attempts === 1 &&
				pending.contentId === id &&
				JSON.stringify(pending.owner) === JSON.stringify(owner)
				? pending
				: null;
		},
	};
}

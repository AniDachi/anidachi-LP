import { z } from "zod";
import { canonicalizeRoomSourceUrl } from "./source-url";

export const PERSONAL_HISTORY_RESUME_HASH = "anidachiResume";
export const PERSONAL_HISTORY_RESUME_TTL_MS = 300_000;
export const PersonalHistoryResumeSchema = z
	.strictObject({
		resumeVersion: z.literal(1),
		intentId: z.uuid(),
		ownerBinding: z.string().regex(/^[a-f0-9]{64}$/),
		accountGeneration: z.number().int().positive(),
		provider: z.enum(["crunchyroll", "youtube"]),
		sourceUrl: z.string().url().max(2048),
		currentTime: z.number().finite().nonnegative().max(604800),
		issuedAt: z.number().int().nonnegative(),
		expiresAt: z.number().int().positive(),
	})
	.superRefine((intent, ctx) => {
		const source = canonicalizeRoomSourceUrl(intent.sourceUrl, intent.provider);
		if (
			!source.ok ||
			source.source.sourceUrl !== intent.sourceUrl ||
			intent.expiresAt <= intent.issuedAt ||
			intent.expiresAt - intent.issuedAt > PERSONAL_HISTORY_RESUME_TTL_MS
		)
			ctx.addIssue({
				code: "custom",
				message: "Invalid personal resume source or lifetime",
			});
	});
export type PersonalHistoryResume = z.infer<typeof PersonalHistoryResumeSchema>;

/** Owner matching only. This digest is neither authentication nor entitlement. */
export async function personalHistoryResumeOwnerBinding(
	owner: string,
	intentId: string,
): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(JSON.stringify([1, owner, intentId])),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

export async function buildPersonalHistoryResumeUrl(input: {
	ownerUserId: string;
	accountGeneration: number;
	provider: "crunchyroll" | "youtube";
	sourceUrl: string;
	currentTime: number;
	now?: number;
	intentId?: string;
}): Promise<string> {
	const url = new URL(input.sourceUrl);
	const params = new URLSearchParams(url.hash.slice(1));
	url.hash = "";
	const now = input.now ?? Date.now();
	const intentId = input.intentId ?? crypto.randomUUID();
	const intent = PersonalHistoryResumeSchema.parse({
		resumeVersion: 1,
		intentId,
		ownerBinding: await personalHistoryResumeOwnerBinding(
			input.ownerUserId,
			intentId,
		),
		accountGeneration: input.accountGeneration,
		provider: input.provider,
		sourceUrl: url.toString(),
		currentTime: input.currentTime,
		issuedAt: now,
		expiresAt: now + PERSONAL_HISTORY_RESUME_TTL_MS,
	});
	params.set(PERSONAL_HISTORY_RESUME_HASH, JSON.stringify(intent));
	url.hash = params.toString();
	return url.toString();
}

export function parsePersonalHistoryResumeUrl(
	url: string,
	now = Date.now(),
): PersonalHistoryResume | null {
	try {
		const current = new URL(url);
		const params = new URLSearchParams(current.hash.slice(1));
		const raw = params.get(PERSONAL_HISTORY_RESUME_HASH);
		if (!raw || raw.length > 4096 || params.has("anidachiRoom")) return null;
		const parsed = PersonalHistoryResumeSchema.safeParse(JSON.parse(raw));
		current.hash = "";
		const source = parsed.success
			? canonicalizeRoomSourceUrl(current.toString(), parsed.data.provider)
			: null;
		return parsed.success &&
			source?.ok &&
			source.source.sourceUrl === parsed.data.sourceUrl &&
			now >= parsed.data.issuedAt &&
			now < parsed.data.expiresAt
			? parsed.data
			: null;
	} catch {
		return null;
	}
}

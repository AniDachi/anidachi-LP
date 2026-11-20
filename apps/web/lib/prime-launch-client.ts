import {
	type PrimeNavigation,
	parsePersonalHistoryResumeUrl,
} from "@anidachi/protocol";
type Runtime = {
	sendMessage(
		id: string,
		message: unknown,
		callback: (value: unknown) => void,
	): void;
	lastError?: unknown;
};
export async function requestPrimeLaunch(
	extensionId: string | null,
	message: Record<string, unknown>,
	current: () => boolean = () => true,
): Promise<boolean> {
	const runtime = (
		globalThis as typeof globalThis & { chrome?: { runtime?: Runtime } }
	).chrome?.runtime;
	if (!runtime || !extensionId || !/^[a-p]{32}$/.test(extensionId))
		return false;
	const send = (
		body: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> =>
		new Promise((resolve) => {
			let done = false;
			const finish = (value: Record<string, unknown> | null) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				resolve(value);
			};
			const timer = setTimeout(() => finish(null), 2500);
			try {
				runtime.sendMessage(
					extensionId,
					{ type: "ANIDACHI_PRIME_LAUNCH", ...body },
					(reply) => {
						const err = runtime.lastError;
						finish(
							!err && reply && typeof reply === "object"
								? (reply as Record<string, unknown>)
								: null,
						);
					},
				);
			} catch {
				finish(null);
			}
		});
	const prepared = await send({ action: "start", ...message });
	if (
		!current() ||
		prepared?.status !== "prepared" ||
		typeof prepared.intentId !== "string"
	)
		return false;
	const result = await send({
		action: "commit",
		intentId: prepared.intentId,
		expectedOwnerUserId: message.expectedOwnerUserId,
	});
	return (
		current() &&
		!!result &&
		["ready", "choice-required"].includes(String(result.status))
	);
}
export function primeResumeMessage(
	canonicalUrl: string,
	owner: string,
	navigation?: PrimeNavigation,
) {
	const resume = parsePersonalHistoryResumeUrl(canonicalUrl);
	if (!resume || resume.provider !== "primevideo")
		throw new Error("Invalid Prime launch");
	return {
		contentId: resume.sourceUrl.split("/").at(-1),
		resume,
		expectedOwnerUserId: owner,
		...(navigation ? { navigation } : {}),
	};
}

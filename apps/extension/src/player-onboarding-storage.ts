export const PLAYER_INTRODUCTION_KEY = "anidachi.playerIntroductionSeen.v3";
export const PLAYER_INTRODUCTION_MESSAGE = "ANIDACHI_PLAYER_INTRODUCTION";

interface IntroductionStorage {
	get(key: string): Promise<Record<string, unknown>>;
	set(values: Record<string, unknown>): Promise<void>;
}

/** Background owns the claim, so two tabs cannot both show the first-run tour.
 * Consumed at display, including an interrupted tour: never surprise the viewer
 * with another automatic pause on their next video. No account data is stored.
 */
export function createIntroductionClaim(area: IntroductionStorage) {
	let queue: Promise<unknown> = Promise.resolve();
	return (): Promise<boolean> => {
		const result = queue
			.then(async () => {
				if (
					(await area.get(PLAYER_INTRODUCTION_KEY))[PLAYER_INTRODUCTION_KEY] ===
					true
				)
					return false;
				await area.set({ [PLAYER_INTRODUCTION_KEY]: true });
				return true;
			})
			.catch(() => false);
		queue = result;
		return result;
	};
}

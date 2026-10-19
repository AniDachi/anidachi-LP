import {
	TrialChallengeSchema,
	TrialInstallationProofSchema,
	TRIAL_INSTALLATION_MESSAGE,
	type TrialInstallationProof,
} from "@anidachi/protocol";
import { postTrialAction } from "./trial-client";
export type TrialBrowserContext = {
	state: "ready";
	ownerUserId: string;
	challenge: string;
	extensionId: string | null;
};
type ExternalRuntime = {
	sendMessage(
		id: string,
		message: unknown,
		reply: (value: unknown) => void,
	): void;
	lastError?: unknown;
};
export async function prepareTrialBrowserContext(
	owner: string,
	requestId: string,
	signal: AbortSignal,
): Promise<TrialBrowserContext> {
	const context = await postTrialAction<TrialBrowserContext>(
		"context",
		owner,
		{ requestId },
		signal,
	);
	TrialChallengeSchema.parse(context.challenge);
	if (
		context.state !== "ready" ||
		(context.extensionId !== null && !/^[a-p]{32}$/.test(context.extensionId))
	)
		throw new Error("Trial confirmation is unavailable. Please try again.");
	return context;
}
export async function requestTrialInstallationProof(
	context: Pick<TrialBrowserContext, "challenge" | "extensionId">,
	signal: AbortSignal,
	runtime: ExternalRuntime | undefined = (
		globalThis as typeof globalThis & { chrome?: { runtime?: ExternalRuntime } }
	).chrome?.runtime,
	timeoutMs = 1000,
): Promise<TrialInstallationProof | undefined> {
	signal.throwIfAborted();
	if (!context.extensionId || !runtime?.sendMessage) return undefined;
	const extensionId = context.extensionId;
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (value?: TrialInstallationProof, error?: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal.removeEventListener("abort", abort);
			if (error) reject(error);
			else resolve(value);
		};
		const abort = () =>
			finish(
				undefined,
				signal.reason ?? new Error("Trial confirmation canceled"),
			);
		const timer = setTimeout(() => finish(), timeoutMs);
		signal.addEventListener("abort", abort, { once: true });
		try {
			runtime.sendMessage(
				extensionId,
				{ type: TRIAL_INSTALLATION_MESSAGE, challenge: context.challenge },
				(reply) => {
					const connectionError = runtime.lastError; // Chrome requires this to be read even for unavailable extensions.
					if (settled) return;
					if (
						connectionError ||
						reply === undefined ||
						(reply as { unavailable?: boolean })?.unavailable === true
					)
						return finish();
					const parsed = TrialInstallationProofSchema.safeParse(
						(reply as { proof?: unknown })?.proof,
					);
					if (!parsed.success || parsed.data.challenge !== context.challenge)
						return finish(
							undefined,
							new Error("Please refresh the trial confirmation and try again."),
						);
					finish(parsed.data);
				},
			);
		} catch {
			finish();
		}
	});
}

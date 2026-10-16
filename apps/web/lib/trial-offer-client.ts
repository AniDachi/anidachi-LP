import type { TrialInstallationProof } from "@anidachi/protocol";
import type { PricingOffer } from "./pricing-offer";
import {
	prepareTrialBrowserContext,
	requestTrialInstallationProof,
	type TrialBrowserContext,
} from "./trial-abuse-client";
import { postTrialAction, trialResultMessage } from "./trial-client";

type CheckedOffer = {
	offer: PricingOffer;
	context?: TrialBrowserContext;
	extensionProof?: TrialInstallationProof;
};
/** A display check only. The caller retains generation/owner fencing and explicit activation consent. */
export async function resolveBrowserTrialOffer(
	offer: PricingOffer,
	signal: AbortSignal,
	requestId = crypto.randomUUID(),
): Promise<CheckedOffer> {
	signal.throwIfAborted();
	if (
		offer.action !== "trial" ||
		offer.trialMode !== "cardless" ||
		offer.pendingTrialActivation
	)
		return { offer };
	const owner = offer.ownerUserId;
	if (!owner) throw new Error("Please sign in to view your plans.");
	const context = await prepareTrialBrowserContext(owner, requestId, signal);
	signal.throwIfAborted();
	const extensionProof = await requestTrialInstallationProof(context, signal);
	signal.throwIfAborted();
	const result = await postTrialAction<{ state: string; offer?: PricingOffer }>(
		"offer",
		owner,
		{ requestId, ...(extensionProof ? { extensionProof } : {}) },
		signal,
	);
	signal.throwIfAborted();
	if (result.state !== "ready")
		throw new Error(trialResultMessage(result.state));
	if (
		!result.offer ||
		result.offer.ownerUserId !== owner ||
		!["trial", "subscribe", "manage"].includes(result.offer.action) ||
		!Number.isFinite(result.offer.validForMs)
	)
		throw new Error("Your plans could not be confirmed. Please try again.");
	return { offer: result.offer, context, extensionProof };
}

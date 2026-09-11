import { createHmac } from "node:crypto";

export const TTFM_P95_BUDGET_MS = 6_000;
export const LEGACY_TTFM_BUDGET_MS = 8_000;

function b64url(input) {
	return Buffer.from(input).toString("base64url");
}

export function getHarnessHostIdentity(mediaV2Size) {
	return mediaV2Size
		? { sub: "p0", participantSessionId: "s0" }
		: { sub: "host", participantSessionId: "host-sess" };
}

export function createHarnessRoomToken({
	sub,
	role,
	participantSessionId,
	roomId,
	secret,
	mediaV2Size = 0,
	mediaCapabilityRevision = 1,
	nowSeconds = Math.floor(Date.now() / 1_000),
}) {
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const capabilities = mediaV2Size
		? {
				mediaProtocolVersion: 2,
				hostPlanCode:
					mediaV2Size === 15 ? "pro" : mediaV2Size === 6 ? "plus" : "free",
				maxParticipants: mediaV2Size,
				maxCameras: 4,
				maxMicrophones: mediaV2Size === 15 ? 8 : mediaV2Size,
				capabilityRevision: mediaCapabilityRevision,
				capabilitiesValidUntil: new Date(
					(nowSeconds + 1_700) * 1_000,
				).toISOString(),
			}
		: undefined;
	const payload = b64url(
		JSON.stringify({
			sub,
			roomId,
			role,
			participantSessionId,
			displayName: sub,
			avatarUrl: null,
			...(capabilities
				? {
						hostUserId: "p0",
						capabilities,
						mediaLease: {
							roomId,
							roomGeneration: 1,
							issuedAt: new Date(nowSeconds * 1_000).toISOString(),
							paidUntil: null,
							capabilities,
						},
					}
				: {}),
			typ: "room",
			iss: "anidachi-auth",
			aud: "anidachi-worker",
			iat: nowSeconds,
			exp: nowSeconds + 1_800,
		}),
	);
	const data = `${header}.${payload}`;
	return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

export function getP95(samples) {
	if (samples.length === 0) return null;
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

export function summarizeSelectedCandidatePairs(diagnostics) {
	const selectedTypes = diagnostics.flatMap((diagnostic) =>
		(diagnostic.stats?.peers ?? []).flatMap((peer) => {
			const pair = peer.stats?.candidatePair;
			return pair?.localCandidateType
				? [`${pair.localCandidateType}/${pair.remoteCandidateType ?? "?"}`]
				: [];
		}),
	);
	return {
		selectedCount: selectedTypes.length,
		relayCount: selectedTypes.filter((pair) => pair.startsWith("relay/"))
			.length,
		selectedTypes,
	};
}

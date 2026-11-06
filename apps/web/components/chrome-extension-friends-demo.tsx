"use client";

import type { InviteTargets } from "@anidachi/protocol";
import { CapsuleFriendsPanel } from "../../extension/src/capsule-friends-panel";
import type { RoomInviteTargetStatus } from "../../extension/src/room-invite-target-status";
import type { RoomDemoPhase } from "../lib/use-room-demo";

const noop = () => {};
const targets: InviteTargets = {
	friends: ["Emma", "Haruto", "Natsuki"].map((name) => ({
		friendshipId: `demo-friendship-${name.toLowerCase()}`,
		user: {
			userId: `demo-${name.toLowerCase()}`,
			displayName: name,
			handle: name.toLowerCase(),
			avatarUrl:
				name === "Emma"
					? "/demo/cameras/jane.jpg"
					: `/demo/avatars/${name.toLowerCase()}.jpg`,
		},
		status: "accepted",
		direction: "mutual",
		requestedAt: "2026-01-01T00:00:00Z",
		respondedAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	})),
	groups: [],
};
const pending: ReadonlyMap<string, RoomInviteTargetStatus> = new Map([
	[
		"friend:demo-emma",
		{
			state: "pending",
			recipientStatuses: new Map([["demo-emma", "pending"]]),
		},
	],
]);
const emptyStatuses = new Map<string, RoomInviteTargetStatus>();
const sendingEmma = new Map([["friend:demo-emma", ["demo-emma"]]]);
const emptySending = new Map<string, readonly string[]>();
const noFailures = new Set<string>();

// The real presentation component, with local fixtures only. The inert wrapper
// keeps its controls out of keyboard/pointer interaction and prevents real invites.
export function ChromeExtensionFriendsDemo({
	phase,
	open,
}: {
	phase: RoomDemoPhase;
	open: boolean;
}) {
	return (
		<div className="demo-friends-preview" inert aria-hidden="true">
			<CapsuleFriendsPanel
				open={open}
				targets={targets}
				loading={false}
				statuses={phase === "invited" ? pending : emptyStatuses}
				participants={
					phase === "accepted" || phase === "together"
						? [{ id: "demo-emma" }]
						: []
				}
				membershipReady
				sending={phase === "inviting" ? sendingEmma : emptySending}
				failedTargets={noFailures}
				notice={null}
				onRefresh={noop}
				onClose={noop}
				onSendFriend={noop}
				onSendGroup={noop}
				onCreateLink={async () => {
					throw new Error("Presentation only");
				}}
			/>
		</div>
	);
}

import { describe, expect, it } from "vitest";
import { capsuleInvitePresentation } from "../src/capsule-friends-model";
import type { RoomInviteTargetStatus } from "../src/room-invite-target-status";
const defaults = {
	ids: ["a"],
	statuses: new Map<string, RoomInviteTargetStatus>(),
	present: new Set<string>(),
	sending: new Set<string>(),
	membershipReady: true,
	failed: false,
};
function status(
	state: "pending" | "accepted" | "declined" | "expired",
	id = "a",
): [string, RoomInviteTargetStatus] {
	return [`friend:${id}`, { state, recipientStatuses: new Map([[id, state]]) }];
}
describe("capsule invitation presentation", () => {
	it("uses confirmed live membership instead of acceptance as presence", () => {
		const accepted = { ...defaults, statuses: new Map([status("accepted")]) };
		expect(capsuleInvitePresentation(accepted)).toMatchObject({
			label: "Invite",
			detail: "Accepted",
			disabled: false,
		});
		expect(
			capsuleInvitePresentation({ ...accepted, present: new Set(["a"]) }),
		).toMatchObject({ label: "In room", disabled: true });
		expect(
			capsuleInvitePresentation({ ...accepted, membershipReady: false }),
		).toMatchObject({ label: "Invite", disabled: true });
	});
	it.each([
		["pending", "Sent"],
		["declined", "Declined"],
		["expired", "Expired"],
	] as const)("shows %s accurately", (state, label) => {
		expect(
			capsuleInvitePresentation({
				...defaults,
				statuses: new Map([status(state)]),
			}),
		).toMatchObject({ label, disabled: true });
	});
	it("locks overlapping group recipients while leaving other friends available", () => {
		expect(
			capsuleInvitePresentation({
				...defaults,
				ids: ["a", "b"],
				sending: new Set(["b"]),
			}),
		).toMatchObject({ state: "sending", disabled: true });
		expect(
			capsuleInvitePresentation({ ...defaults, sending: new Set(["b"]) }),
		).toMatchObject({ label: "Invite", disabled: false });
	});
	it("counts only eligible missing members and preserves retry state", () => {
		const input = {
			...defaults,
			ids: ["a", "b", "c", "c"],
			statuses: new Map([status("pending", "b")]),
			present: new Set(["a"]),
		};
		expect(capsuleInvitePresentation(input)).toMatchObject({
			label: "Invite 1",
			inRoomCount: 1,
			disabled: false,
		});
		expect(capsuleInvitePresentation({ ...input, failed: true })).toMatchObject(
			{ label: "Retry 1", state: "error" },
		);
	});
	it("keeps empty groups disabled and mixed terminal statuses honest", () => {
		expect(capsuleInvitePresentation({ ...defaults, ids: [] })).toMatchObject({
			disabled: true,
		});
		expect(
			capsuleInvitePresentation({
				...defaults,
				ids: ["a", "b"],
				statuses: new Map([status("declined"), status("expired", "b")]),
			}),
		).toMatchObject({ label: "Ended", disabled: true });
	});
});

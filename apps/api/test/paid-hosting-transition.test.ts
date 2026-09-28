import { describe, expect, it } from "vitest";
import { parseEndRoomCommand } from "../src/room-lifecycle";

const command = {
	endedAt: 1000,
	reason: "capability_expired",
	cutover: {
		revision: 2,
		roomId: "cutover-room",
		roomGeneration: 1,
		closingAt: 1000,
	},
};
describe("internal commercial cutover command", () => {
	it("preserves the authoritative identity and original deadline", () => {
		expect(parseEndRoomCommand(command)).toEqual(command);
	});
	it.each([
		{ revision: 0 },
		{ roomGeneration: 0 },
		{ closingAt: -1 },
		{ roomId: "" },
		{ revision: Number.MAX_SAFE_INTEGER + 1 },
	])("rejects malformed cutover authority %j", (bad) => {
		expect(
			parseEndRoomCommand({
				...command,
				cutover: { ...command.cutover, ...bad },
			}),
		).toBeNull();
	});
	it("retains the existing plain room-end command", () => {
		expect(
			parseEndRoomCommand({ endedAt: 1000, reason: "host_ended" }),
		).toEqual({ endedAt: 1000, reason: "host_ended" });
	});
});

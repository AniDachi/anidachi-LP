import { describe, expect, it } from "vitest";
import {
	primeVideoFingerprint,
	primeVideoSourceUrl,
	type ServerEvent,
} from "@anidachi/protocol";
import { PrimeRoomProjection } from "../src/prime-room-projection";

const contentId = "0AAAAAAAAAAAAAAAAAAAAAAAAA";
const nextId = "0BBBBBBBBBBBBBBBBBBBBBBBBB";
const visit = "cd42a034-68ca-46a1-bf52-50d7ec4a4360";
function snapshot(
	id = contentId,
): Extract<ServerEvent, { type: "ROOM_SNAPSHOT" }> {
	const sourceUrl = primeVideoSourceUrl(id),
		videoFingerprint = primeVideoFingerprint(id);
	return {
		type: "ROOM_SNAPSHOT",
		roomId: "room1",
		serverSeq: 1,
		roomGeneration: 1,
		sourceGeneration: 1,
		source: {
			provider: "primevideo",
			sourceUrl,
			canonicalUrl: sourceUrl,
			videoFingerprint,
			title: "Fixture",
		},
		hostState: {
			videoFingerprint,
			primePlayerVisit: visit,
			playing: true,
			hostTime: 64,
			updatedAt: 100,
			playbackRate: 1,
		},
		participants: [
			{
				id: "guest",
				participantSessionId: "s1",
				displayName: "Guest",
				role: "viewer",
				cameraEnabled: false,
				mediaSeat: "none",
				syncStatus: "synced",
				lastSeenAt: 1,
			},
		],
	};
}

describe("Prime room document rebind", () => {
	it("publishes a Netflix host leaving an already paused episode exactly once", () => {
		const room = new PrimeRoomProjection();
		const initial = snapshot();
		const url = "https://www.netflix.com/watch/123", videoFingerprint = "netflix|watch/123";
		room.consume({ ...initial, participants: initial.participants.map(p => ({...p, role: "host" as const})),
			source: {provider: "netflix", title: "Episode", sourceUrl: url, canonicalUrl: url, videoFingerprint},
			hostState: {...initial.hostState!, hostSurface: "player", videoFingerprint, playing: false, hostTime: 17} });
		expect(room.pauseForCatalog("guest")?.state).toMatchObject({hostSurface: "catalog", playing: false, hostTime: 17});
		expect(room.pauseForCatalog("guest")).toBeNull();
	});
	it("keeps the browsing baseline while playback moves to another title without an attached UI", () => {
		const room = new PrimeRoomProjection();
		room.consume(snapshot());
		room.detach();
		const next = snapshot(nextId);
		room.consume({
			type: "SOURCE_CHANGED",
			roomId: next.roomId,
			source: next.source!,
			hostState: next.hostState!,
			sourceGeneration: 2,
			roomGeneration: 1,
			serverSeq: 3,
			serverReceivedAt: 110,
		});
		room.consume({ ...snapshot(), serverSeq: 2 });
		expect(room.snapshot?.source?.videoFingerprint).toBe(
			primeVideoFingerprint(nextId),
		);
		expect(room.baseline).toEqual({
			fingerprint: primeVideoFingerprint(contentId),
			visit,
		});
	});

	it("pauses the host's last verified playback at document detachment once, preserving its visit and rate", () => {
		const room = new PrimeRoomProjection(),
			initial = snapshot();
		room.consume({
			...initial,
			participants: initial.participants.map((p) => ({
				...p,
				role: "host" as const,
			})),
		});
		room.sentHostState("guest", {
			...initial.hostState!,
			hostTime: 23,
			updatedAt: 1000,
			playbackRate: 1.5,
		});
		room.detach(3000);
		const pause = room.pauseForCatalog("guest", 6000);
		expect(pause?.state).toMatchObject({
			playing: false,
			hostTime: 26,
			primePlayerVisit: visit,
			updatedAt: 6000,
		});
		expect(room.pauseForCatalog("guest", 7000)).toBeNull();
		room.consume(initial);
		room.detach(3000);
		expect(room.pauseForCatalog("guest", 6000)).toBeNull();
	});

	it("reserves only the current guest's new playing visit and rolls back only its own receipt", () => {
		const room = new PrimeRoomProjection();
		room.consume(snapshot());
		room.setBaseline({ fingerprint: "previous", visit: "old" });
		expect(room.reserveFollow("another-account", contentId, visit)).toBeNull();
		expect(room.reserveFollow("guest", nextId, visit)).toBeNull();
		expect(room.reserveFollow("guest", contentId, "stale-visit")).toBeNull();
		const reservation = room.reserveFollow("guest", contentId, visit)!;
		expect(reservation.source).toEqual(room.snapshot?.source);
		expect(room.reserveFollow("guest", contentId, visit)).toBeNull();
		expect(room.cancelFollow("old-receipt")).toBe(false);
		expect(room.cancelFollow(reservation.receipt)).toBe(true);
		expect(room.baseline).toEqual({ fingerprint: "previous", visit: "old" });
		const retry = room.reserveFollow("guest", contentId, visit)!;
		room.setBaseline(null);
		expect(room.cancelFollow(retry.receipt)).toBe(false);
	});

	it("rejects host, paused, and mismatched-source follow requests", () => {
		const room = new PrimeRoomProjection();
		const initial = snapshot();
		room.setBaseline({ fingerprint: "previous" });
		room.consume({
			...initial,
			participants: initial.participants.map((p) => ({
				...p,
				role: "host" as const,
			})),
		});
		expect(room.reserveFollow("guest", contentId, visit)).toBeNull();
		room.consume({
			...initial,
			hostState: { ...initial.hostState!, playing: false },
		});
		expect(room.reserveFollow("guest", contentId, visit)).toBeNull();
		room.consume({ ...initial, source: snapshot(nextId).source });
		expect(room.reserveFollow("guest", contentId, visit)).toBeNull();
	});

	it("retains 80 distinct text messages without replaying emoji or the departure of an obsolete participant session", () => {
		const room = new PrimeRoomProjection(),
			initial = snapshot();
		room.consume(initial);
		const guest = initial.participants[0]!;
		room.consume({
			type: "PARTICIPANT_JOINED",
			participant: { ...guest, participantSessionId: "s2" },
		});
		room.consume({ type: "PARTICIPANT_LEFT", participant: guest });
		expect(room.snapshot?.participants[0]?.participantSessionId).toBe("s2");
		const reaction = {
			id: "emoji",
			userId: "guest",
			roomId: "room1",
			videoTime: 0,
			createdAt: 100,
		};
		room.consume({ type: "REACTION", reaction: { ...reaction, emoji: "👍" } });
		for (let i = 0; i < 81; i++)
			room.consume({
				type: "REACTION",
				reaction: { ...reaction, text: "Hi", id: String(i) },
			});
		room.consume({
			type: "REACTION",
			reaction: { ...reaction, text: "Duplicate", id: "80" },
		});
		expect(room.chat.size).toBe(80);
		expect([...room.chat.keys()][0]).toBe("1");
		expect(room.chat.get("80")?.reaction.text).toBe("Hi");
	});
});

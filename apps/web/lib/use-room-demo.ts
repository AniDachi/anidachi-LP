"use client";

import { useEffect, useState } from "react";

export type RoomDemoPhase =
	| "pill"
	| "open"
	| "creating"
	| "ready"
	| "copy-link"
	| "link-copied"
	| "open-invites"
	| "friends"
	| "inviting"
	| "invited"
	| "accepted"
	| "together"
	| "camera"
	| "camera-on"
	| "watching"
	| "speaking"
	| "compose"
	| "typing"
	| "send"
	| "chat"
	| "reaction"
	| "layout-open"
	| "layout-tab"
	| "layout-preview"
	| "layout-size"
	| "layout-move-camera"
	| "layout-select-chat"
	| "layout-move-chat"
	| "layout-apply"
	| "layout-done";
const NEXT: Record<RoomDemoPhase, RoomDemoPhase> = {
	pill: "open",
	open: "creating",
	creating: "ready",
	ready: "copy-link",
	"copy-link": "link-copied",
	"link-copied": "open-invites",
	"open-invites": "friends",
	friends: "inviting",
	inviting: "invited",
	invited: "accepted",
	accepted: "together",
	together: "camera",
	camera: "camera-on",
	"camera-on": "watching",
	watching: "speaking",
	speaking: "compose",
	compose: "typing",
	typing: "send",
	send: "chat",
	chat: "reaction",
	reaction: "layout-open",
	"layout-open": "layout-tab",
	"layout-tab": "layout-preview",
	"layout-preview": "layout-size",
	"layout-size": "layout-move-camera",
	"layout-move-camera": "layout-select-chat",
	"layout-select-chat": "layout-move-chat",
	"layout-move-chat": "layout-apply",
	"layout-apply": "layout-done",
	"layout-done": "pill",
};
const DELAY: Record<RoomDemoPhase, number> = {
	pill: 1200,
	open: 1700,
	creating: 450,
	ready: 650,
	"copy-link": 750,
	"link-copied": 900,
	"open-invites": 650,
	friends: 1050,
	inviting: 300,
	invited: 500,
	accepted: 1200,
	together: 500,
	camera: 700,
	"camera-on": 450,
	watching: 600,
	speaking: 900,
	compose: 500,
	typing: 1800,
	send: 650,
	chat: 800,
	reaction: 2600,
	"layout-open": 600,
	"layout-tab": 700,
	"layout-preview": 800,
	"layout-size": 850,
	"layout-move-camera": 1000,
	"layout-select-chat": 650,
	"layout-move-chat": 1000,
	"layout-apply": 700,
	"layout-done": 1800,
};

export function getRoomDemoScene(phase: RoomDemoPhase): 1 | 2 | 3 | 4 {
	if (phase.startsWith("layout-")) return 4;
	if (["pill", "open", "creating", "ready"].includes(phase)) return 1;
	if (
		[
			"camera",
			"camera-on",
			"watching",
			"speaking",
			"compose",
			"typing",
			"send",
			"chat",
			"reaction",
		].includes(phase)
	)
		return 3;
	return 2;
}

export const DEMO_MESSAGE = "That was amazing!";

/** Typing belongs to the visible illustration, never the real composer. */
export function useDemoTyping(phase: RoomDemoPhase, playing: boolean) {
	const [length, setLength] = useState(0);
	useEffect(() => {
		if (phase !== "typing") {
			setLength(0);
			return;
		}
		if (!playing) return;
		const timer = setInterval(
			() => setLength((value) => Math.min(value + 1, DEMO_MESSAGE.length)),
			75,
		);
		return () => clearInterval(timer);
	}, [phase, playing]);
	return phase === "send"
		? DEMO_MESSAGE
		: phase === "typing"
			? DEMO_MESSAGE.slice(0, length)
			: "";
}

/** Local, automatic illustration. No room API, media devices or account state. */
export function useRoomDemo(visible: boolean, reducedMotion: boolean | null) {
	const [phase, setPhase] = useState<RoomDemoPhase>("pill");
	useEffect(() => {
		if (!visible || reducedMotion !== false) return;
		const timer = setTimeout(() => setPhase(NEXT[phase]), DELAY[phase]);
		return () => clearTimeout(timer);
	}, [phase, visible, reducedMotion]);

	// Reduced-motion users get the complete scene without automatic movement.
	return reducedMotion ? "reaction" : phase;
}

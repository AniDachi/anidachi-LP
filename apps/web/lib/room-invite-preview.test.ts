import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoomInvitePreviewPage from "../app/dev/room-invite/page";
import { RoomInviteView } from "../app/room/[roomId]/room-invite-view";

const originalMode = process.env.NODE_ENV;
const env = process.env as Record<string, string | undefined>;
afterEach(() => {
	if (originalMode === undefined) delete env.NODE_ENV;
	else env.NODE_ENV = originalMode;
});
for (const mode of ["production", "test", undefined]) {
	test(`invite preview is unavailable in ${mode ?? "unset"} mode`, () => {
		if (mode === undefined) delete env.NODE_ENV;
		else env.NODE_ENV = mode;
		assert.throws(RoomInvitePreviewPage, /NEXT_HTTP_ERROR_FALLBACK;404/);
	});
}
test("local invitation renders sample data without a join action or submit button", () => {
	env.NODE_ENV = "development";
	const html = renderToStaticMarkup(RoomInvitePreviewPage());
	assert.match(html, /sample room/);
	assert.match(html, /Frieren/);
	assert.match(html, /Join room/);
	assert.doesNotMatch(html, /action=|type="submit"|\/api\/rooms\//);
});
test("real invitation presentation preserves the POST join action", () => {
	const html = renderToStaticMarkup(
		React.createElement(RoomInviteView, {
			status: "live",
			roomTitle: "Room",
			roomSubtitle: null,
			hostName: "Host",
			isParticipant: false,
			hasLaunchUrl: true,
			initialMobile: false,
			joinAction: "/api/rooms/example/join",
		}),
	);
	assert.match(html, /action="\/api\/rooms\/example\/join" method="POST"/);
	assert.match(html, /type="submit"/);
});

for (const isParticipant of [false, true]) {
	test(`invite CTA reflects existing membership: ${isParticipant}`, () => {
		const html = renderToStaticMarkup(
			React.createElement(RoomInviteView, {
				status: "live",
				roomTitle: "Room",
				roomSubtitle: null,
				hostName: "Host",
				isParticipant,
				hasLaunchUrl: true,
				initialMobile: false,
				sourceProvider: "youtube",
			}),
		);
		assert.match(html, isParticipant ? /Open watchroom/ : /Join room/);
		assert.match(html, /YouTube/);
		assert.match(html, /Join free. No subscription needed/);
		assert.doesNotMatch(html, /Members:|<details[^>]*open/);
	});
}
test("invite without a video does not promise to launch one", () => {
	const html = renderToStaticMarkup(
		React.createElement(RoomInviteView, {
			status: "lobby",
			roomTitle: "Room",
			roomSubtitle: null,
			hostName: "Host",
			isParticipant: false,
			hasLaunchUrl: false,
			initialMobile: false,
		}),
	);
	assert.match(html, /keep this tab open while the host chooses a video/);
	assert.doesNotMatch(html, /Opens the video|Crunchyroll|YouTube/);
});

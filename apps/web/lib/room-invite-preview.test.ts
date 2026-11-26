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
	test(`invite preview is unavailable in ${mode ?? "unset"} mode`, async () => {
		if (mode === undefined) delete env.NODE_ENV;
		else env.NODE_ENV = mode;
		await assert.rejects(RoomInvitePreviewPage({searchParams: Promise.resolve({})}), /NEXT_HTTP_ERROR_FALLBACK;404/);
	});
}
test("local invitation renders sample data without a join action or submit button", async () => {
	env.NODE_ENV = "development";
	const html = renderToStaticMarkup(await RoomInvitePreviewPage({searchParams: Promise.resolve({})}));
	assert.match(html, /Local preview/);
	assert.match(html, /The Queen’s Gambit/);
	assert.match(html, /Join room/);
	assert.doesNotMatch(html, /action=|type="submit"|\/api\/rooms\//);
});

test("deployed samples require both the staging branch and its access gate", async () => {
  const baseline = process.env;
  const render = () => RoomInvitePreviewPage({searchParams: Promise.resolve({})});
  for (const [deployment, branch, gate, allowed] of [
    ["preview", "staging", "true", true], ["preview", "staging", "false", false],
    ["preview", "other", "true", false], ["production", "staging", "true", false],
  ] as const) {
    process.env = { ...baseline, NODE_ENV: "production",
      VERCEL_ENV: deployment, VERCEL_GIT_COMMIT_REF: branch, ANIDACHI_STAGING_GATE_ENABLED: gate,
      ANIDACHI_STAGING_GATE_PASSWORD_SHA256: "a".repeat(64) };
    try {
      if (allowed) assert.match(renderToStaticMarkup(await render()), /Staging preview/);
      else await assert.rejects(render(), /NEXT_HTTP_ERROR_FALLBACK;404/);
    } finally { process.env = baseline; }
  }
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
		assert.match(html, /Host<\/strong> invited you/);
		assert.doesNotMatch(html, /Members:|<details[^>]*open/);
	});
}
test("invite without a video does not promise to launch one", () => {
	const html = renderToStaticMarkup(
		React.createElement(RoomInviteView, {
			status: "lobby",
            joinAction: "/api/rooms/example/join",
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

for (const view of ["login","install"]) test("preview keeps ticket details with the " + view + " stub", async () => {
  env.NODE_ENV = "development";
  const html = renderToStaticMarkup(await RoomInvitePreviewPage({searchParams: Promise.resolve({view})}));
  assert.match(html, /The Queen’s Gambit/);
  assert.match(html, /Ads Mag/);
  assert.match(html, /Netflix/);
  assert.match(html, view === "login" ? /Continue with Google/ : /Install extension/);
  if (view === "login") assert.match(html, /Continue with email/);
  assert.doesNotMatch(html, /action="\/api\/rooms|href="\/api\/auth/);
});

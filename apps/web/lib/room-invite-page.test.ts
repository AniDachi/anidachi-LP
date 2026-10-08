import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, beforeEach, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { roomSourceCreationColumns } from "./anidachi-auth/room-source";

const moduleLoader = Module as typeof Module & {
  _load: (request: string, parent: NodeModule | undefined, isMain: boolean) => unknown;
};
const originalLoad = moduleLoader._load;
let userId = "guest";
let alreadyMember = false;
let authReturnPath = "";
let memberCountReads = 0;
const activeRoom = {
  id: "test-room", host_user_id: "host", status: "live", title: "Watch with friends",
  episode_id: null, show_id: null,
  ...roomSourceCreationColumns({ sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
};
let room: typeof activeRoom | null = activeRoom;

moduleLoader._load = (request, parent, isMain) => {
  if (request === "next/headers") {
    return { headers: async () => new Headers({ "user-agent": "Desktop Chrome" }) };
  }
  if (request === "@/lib/anidachi-auth/session") {
    return {
      requireAuth: async (path: string) => { authReturnPath = path; },
      getSession: async () => ({ userId }),
    };
  }
  if (request === "@/lib/anidachi-auth/db") {
    return {
      getRoomById: async () => room,
      getUserById: async () => ({ display_name: "Alex" }),
      isRoomMember: async () => alreadyMember,
      getRoomMemberCount: async () => { memberCountReads += 1; return 12; },
    };
  }
  return originalLoad(request, parent, isMain);
};
const { default: RoomPage } = createRequire(import.meta.url)("../app/room/[roomId]/page") as
  typeof import("../app/room/[roomId]/page");
after(() => { moduleLoader._load = originalLoad; });

beforeEach(() => {
  userId = "guest";
  alreadyMember = false;
  authReturnPath = "";
  memberCountReads = 0;
  room = { ...activeRoom };
});

async function renderPage() {
  return renderToStaticMarkup(await RoomPage({
    params: Promise.resolve({ roomId: "test-room" }),
    searchParams: Promise.resolve({}),
  }));
}

test("the real invite uses the agreed presentation and offers a newcomer Join room", async () => {
  const html = await renderPage();
  assert.equal(authReturnPath, "/room/test-room");
  assert.match(html.replace(/<[^>]*>/g, ""), /Watch together with Alex/);
  assert.match(html, /Join room/);
  assert.match(html, /action="\/api\/rooms\/test-room\/join" method="POST"/);
  assert.doesNotMatch(html, /Open watchroom|Members:|Ready to open in your video tab/);
  assert.equal(memberCountReads, 0);
});

for (const participant of ["member", "host"]) {
  test(`the real invite lets an existing ${participant} reopen the video`, async () => {
    alreadyMember = participant === "member";
    userId = participant === "host" ? "host" : "guest";
    const html = await renderPage();
    assert.match(html.replace(/<[^>]*>/g, ""), /Watch together with Alex/);
    assert.match(html, /Open watchroom/);
    assert.match(html, /action="\/api\/rooms\/test-room\/join" method="POST"/);
  });
}

test("a missing room keeps its terminal state without offering to join", async () => {
  room = null;
  const html = await renderPage();
  assert.match(html, /This watchroom has ended/);
  assert.doesNotMatch(html, /type="submit"|\/api\/rooms\/test-room\/join/);
});

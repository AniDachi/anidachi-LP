import assert from "node:assert/strict";
import { createRequire, default as Module } from "node:module";
import { after, test } from "node:test";

const loader = Module as typeof Module & { _load: (name: string, parent: NodeModule | undefined, isMain: boolean) => unknown };
const original = loader._load;
const id = "a12b3456-1234-4321-a000-0123456789ab";
const row = { title: "The Queen’s Gambit", episode_id: "Openings", source_provider: "netflix", lobby_provider: null, host: {display_name: "Ads Mag"} };
let result: typeof row | null = row;
let queries = 0;

const query = {
  select(columns: string) {
    assert.equal(columns, "title,episode_id,source_provider,lobby_provider,host:users!rooms_host_user_id_fkey(display_name)");
    return query;
  },
  eq(column: string, value: string) { assert.equal(column, "room_id"); assert.equal(value, id); return query; },
  in(column: string, values: string[]) { assert.equal(column, "status"); assert.deepEqual(values, ["lobby", "live"]); return query; },
  is(column: string, value: unknown) { assert.equal(column, "ended_at"); assert.equal(value, null); return query; },
  maybeSingle: async () => ({ data: result, error: null }),
};
loader._load = (name, parent, isMain) => name === "./anidachi-auth/db"
  ? {db: () => ({from: (table: string) => { assert.equal(table, "rooms"); queries++; return query; }})}
  : original(name, parent, isMain);
const { readInviteTicket, roomTicketDetails } = createRequire(import.meta.url)("./room-ticket") as typeof import("./room-ticket");
after(() => { loader._load = original; });

test("a valid invitation reveals only its display fields", async () => {
  assert.deepEqual(await readInviteTicket("/room/" + id + "?lobby=youtube"), {
    title: row.title, episode: row.episode_id, provider: "netflix", host: "Ads Mag",
  });
});

test("off-site and non-room return paths never look up invitation data", async () => {
  const before = queries;
  for (const path of ["https://example.com/room/" + id, "/room/not-a-room-id", "/room/" + id + "/launch"]) {
    assert.equal(await readInviteTicket(path), null);
  }
  assert.equal(queries, before);
});

test("ended or unknown rooms return no details", async () => {
  result = null;
  try { assert.equal(await readInviteTicket("/room/" + id), null); } finally { result = row; }
});

test("a catalog invite shows its persisted platform while a title is being chosen", () => {
  assert.deepEqual(roomTicketDetails({title: "Netflix watchroom", episode_id: null, source_provider: null, lobby_provider: "netflix"}, "Ads Mag", "youtube"),
    {title: "Let’s pick something together", episode: null, provider: "netflix", host: "Ads Mag"});
});

import { it, expect } from "vitest";
import * as session from "../src/prime-launch-session";
const id = "0IUGS56V361WRU60PCC5XH5D8Z";
it("survives worker restart and cleared fragment, consumes only once at exact SDK binding", async () => {
	let stored: unknown = null;
	const storage = {
		get: async () => stored,
		set: async (value: unknown) => {
			stored = structuredClone(value);
		},
		remove: async () => {
			stored = null;
		},
	};
	const create = session.createPrimePendingStore;
	const owner = { userId: "owner", loginId: "login", generation: 3 };
	const pending = {
		intentId: "11111111-1111-4111-8111-111111111111",
		contentId: id,
		owner,
		roomId: "room",
		expiresAt: 2000,
		attempts: 1,
	};
	await create(storage).put(3, pending, 1000);
	expect(await create(storage).take(4, owner, id, 1001)).toBeNull();
	expect(
		await create(storage).take(3, owner, "0GS9E1N0I97ENRMJPEH38ZYO1J", 1001),
	).toBeNull();
	// An intermediate default episode cannot consume the exact pending destination.
	expect((await create(storage).take(3, owner, id, 1002))?.roomId).toBe("room");
	await create(storage).put(3, pending, 1000);
	expect((await create(storage).take(3, owner, id, 1001))?.roomId).toBe("room");
	expect(await create(storage).take(3, owner, id, 1002)).toBeNull();
	await create(storage).put(3, pending, 1000);
	expect(
		await create(storage).take(3, { ...owner, generation: 4 }, id, 1001),
	).toBeNull();
	await create(storage).put(3, pending, 1000);
	expect(await create(storage).take(3, owner, id, 2000)).toBeNull();
});

it("keeps cancellation and account-change fences through read/restart until a fresh explicit launch", async () => {
	let stored: unknown = null;
	const storage = {
		get: async () => stored,
		set: async (value: unknown) => {
			stored = structuredClone(value);
		},
		remove: async () => {
			stored = null;
		},
	};
	const store = session.createPrimePendingStore(storage),
		owner = { userId: "owner", loginId: "login", generation: 1 };
	const pending = {
		intentId: "11111111-1111-4111-8111-111111111111",
		contentId: id,
		owner,
		roomId: "room",
		expiresAt: Date.now() + 60000,
		attempts: 1,
	};
	await store.put(1,{...pending,attempts:0});
 expect(await store.take(1,owner,id)).toBeNull();
 await store.put(1, pending);
	await store.retireAll();
	expect(await store.peek(1, owner)).toBeNull();
	expect(await store.has(1)).toBe(true);
	expect(
		await session.createPrimePendingStore(storage).take(1, owner, id),
	).toBeNull();
	await store.put(1, pending);
	expect((await store.take(1, owner, id))?.roomId).toBe("room");
	await store.forget(1);
	expect(await store.has(1)).toBe(false);
});

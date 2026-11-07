import assert from "node:assert/strict";
import test from "node:test";
import { loadExtensionWelcome } from "./extension-welcome-snapshot";
const owner = "f6250000-0000-4000-8000-000000000001",
	at = Date.parse("2030-01-01T12:00:00Z");
const status = {
	accountHostingVersion: 1 as const,
	ownerUserId: owner,
	planCode: "free" as const,
	serverTime: at,
	validUntil: at + 1000,
	period: { utcDay: "2030-01-01", resetAt: at + 43_200_000 },
	activeRoom: null,
	canCreateRoom: true,
	access: {
		kind: "daily_free" as const,
		budgetSeconds: 1200 as const,
		usedSeconds: 0,
		remainingSeconds: 1200,
		metering: false,
	},
};
test("welcome checks live owner before direct status or billing work and budgets whole read", async () => {
	let reads = 0,
		now = 0;
	const deps = {
		websiteUser: async () => ({ id: owner }),
		overview: async () => {
			throw Error("billing down");
		},
		readStatus: async () => {
			reads++;
			return { mode: "free20" as const, status };
		},
		clock: () => now,
	};
	assert.equal(
		(
			await loadExtensionWelcome(owner, {
				...deps,
				websiteUser: async () => ({ id: "other" }),
			})
		).kind,
		"sign_in",
	);
	assert.equal(reads, 0);
	assert.equal((await loadExtensionWelcome(owner, deps)).kind, "free20");
	assert.equal(
		(
			await loadExtensionWelcome(owner, {
				...deps,
				readStatus: async () => {
					now = 1000;
					return { mode: "free20", status };
				},
			})
		).kind,
		"error",
	);
});

test("SSR missing Free20 installation context is unavailable rather than a fresh allowance",async()=>{
 const {Free20ContextError}=await import("./free20-abuse");
 const result=await loadExtensionWelcome(owner,{websiteUser:async()=>({id:owner}),overview:async()=>{throw Error("No billing snapshot");},readStatus:async()=>{throw new Free20ContextError();},clock:()=>0});
 assert.equal(result.kind,"error");
});

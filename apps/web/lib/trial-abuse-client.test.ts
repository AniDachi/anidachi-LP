import assert from "node:assert/strict";
import test from "node:test";
import { requestTrialInstallationProof } from "./trial-abuse-client";
const context = {
	challenge: "a".repeat(180) + "." + "b".repeat(43),
	extensionId: "a".repeat(32),
};
test("missing/old extension, runtime errors and timeout fall back to cookie-only", async () => {
	assert.equal(
		await requestTrialInstallationProof(
			{ ...context, extensionId: null },
			new AbortController().signal,
			undefined,
			5,
		),
		undefined,
	);
	assert.equal(
		await requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{
				sendMessage: () => {
					throw Error("missing");
				},
			},
			5,
		),
		undefined,
	);
	assert.equal(
		await requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{ sendMessage: () => {} },
			5,
		),
		undefined,
	);
	assert.equal(
		await requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{ sendMessage: (_id, _msg, reply) => reply(undefined) },
			5,
		),
		undefined,
	);
});
test("late/aborted proof cannot continue checkout; malformed or different challenge is not silently ignored", async () => {
	const abort = new AbortController();
	let reply: (v: unknown) => void = () => {};
	const pending = requestTrialInstallationProof(
		context,
		abort.signal,
		{
			sendMessage: (_id, _msg, cb) => {
				reply = cb;
			},
		},
		500,
	);
	abort.abort();
	await assert.rejects(() => pending);
	reply({ unavailable: true });
	await assert.rejects(() =>
		requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{ sendMessage: (_id, _msg, cb) => cb({ proof: {} }) },
			5,
		),
	);
	const proof = {
		version: 1,
		challenge: context.challenge,
		publicKey: "a".repeat(122),
		signature: "b".repeat(86),
	};
	assert.deepEqual(
		await requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{ sendMessage: (_id, _msg, cb) => cb({ proof }) },
			5,
		),
		proof,
	);
	await assert.rejects(() =>
		requestTrialInstallationProof(
			context,
			new AbortController().signal,
			{
				sendMessage: (_id, _msg, cb) =>
					cb({
						proof: {
							...proof,
							challenge: "c".repeat(180) + "." + "b".repeat(43),
						},
					}),
			},
			5,
		),
	);
});

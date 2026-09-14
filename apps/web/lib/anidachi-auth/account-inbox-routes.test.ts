import assert from "node:assert/strict";
import test from "node:test";
import { AccountInboxApiError } from "./account-inbox";
import {
	accountInboxPageLimit,
	accountInboxIncludeReturnable,
} from "./account-inbox-routes";

test("account inbox page limit accepts the supported range", () => {
	assert.equal(accountInboxPageLimit(null), undefined);
	assert.equal(accountInboxPageLimit(""), undefined);
	assert.equal(accountInboxPageLimit("1"), 1);
	assert.equal(accountInboxPageLimit("100"), 100);
});

test("account inbox page limit rejects malformed and out-of-range values", () => {
	for (const value of ["0", "101", "1.5", "-1", "abc", " 10"] as const) {
		assert.throws(
			() => accountInboxPageLimit(value),
			(error) =>
				error instanceof AccountInboxApiError &&
				error.status === 400 &&
				error.message === "Invalid inbox limit",
		);
	}
});

test("Return projection requires an explicit valid opt-in; old clients keep v2", () => {
	assert.equal(accountInboxIncludeReturnable(null), false);
	assert.equal(accountInboxIncludeReturnable("false"), false);
	assert.equal(accountInboxIncludeReturnable("true"), true);
	for (const input of ["1", "", "yes", " true "]) {
		assert.throws(
			() => accountInboxIncludeReturnable(input),
			(error) => error instanceof AccountInboxApiError && error.status === 400,
		);
	}
});

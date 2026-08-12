import assert from "node:assert/strict";
import test from "node:test";
import { AccountInboxApiError } from "./account-inbox";
import { accountInboxPageLimit } from "./account-inbox-routes";

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

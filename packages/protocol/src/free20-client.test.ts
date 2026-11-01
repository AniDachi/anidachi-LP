import { describe, expect, it } from "vitest";
import {
	FREE20_CLIENT_HEADER,
	FREE20_CLIENT_VERSION,
	parseFree20ClientVersion,
} from "./free20-client";

describe("Free20 admission capability", () => {
	it("accepts only the exact supported value", () => {
		expect(FREE20_CLIENT_HEADER).toBe("x-anidachi-free20-client");
		expect(FREE20_CLIENT_VERSION).toBe(1);
		expect(parseFree20ClientVersion("1")).toBe(1);
		for (const value of [null, "", "0", "2", "01", "1, 1", " 1 ", "true"])
			expect(parseFree20ClientVersion(value)).toBeNull();
	});
	it("uses actual HTTP normalization but rejects duplicate serialization", () => {
		const headers = new Headers({ [FREE20_CLIENT_HEADER]: " 1 " });
		expect(parseFree20ClientVersion(headers.get(FREE20_CLIENT_HEADER))).toBe(1);
		headers.append(FREE20_CLIENT_HEADER, "1");
		expect(
			parseFree20ClientVersion(headers.get(FREE20_CLIENT_HEADER)),
		).toBeNull();
	});
});

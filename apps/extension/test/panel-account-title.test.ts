import { describe, expect, it } from "vitest";
import {
	calculatePlanGlyphOffset,
	getLastVisibleGrapheme,
} from "../src/panel-account-title";

describe("panel account title alignment", () => {
	it("aligns the plan to the actual top of the last visible grapheme", () => {
		expect(getLastVisibleGrapheme("Ads Mag")).toBe("g");
		expect(getLastVisibleGrapheme("Cafe\u0301")).toBe("e\u0301");
		expect(getLastVisibleGrapheme("Name   ")).toBe("e");
	});

	it("moves the plan in either direction while bounding pathological metrics", () => {
		expect(calculatePlanGlyphOffset(8, 6)).toBe(-2);
		expect(calculatePlanGlyphOffset(4, 6)).toBe(2);
		expect(calculatePlanGlyphOffset(40, 2)).toBe(-8);
		expect(calculatePlanGlyphOffset(2, 40)).toBe(8);
	});
});

import { expect, it } from "vitest";
import { RoomHostingAdmissionSchema } from "../src/room-hosting";

it("retains the pinned Free20 mode and quota denial in internal admission", () => {
	const allowed = {
		roomId: "daily",
		roomGeneration: 1,
		allowed: true,
		hostingTimeMode: "daily_free20",
	};
	expect(RoomHostingAdmissionSchema.parse(allowed)).toEqual(allowed);
	expect(
		RoomHostingAdmissionSchema.safeParse({
			...allowed,
			hostingTimeMode: "legacy1800",
		}).success,
	).toBe(false);
	expect(
		RoomHostingAdmissionSchema.safeParse({
			...allowed,
			allowed: false,
			code: "QUOTA_EXHAUSTED",
		}).success,
	).toBe(true);
});

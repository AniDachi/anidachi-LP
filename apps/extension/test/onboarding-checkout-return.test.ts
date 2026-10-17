import { expect, it, vi } from "vitest";
import {
	createOnboardingCheckoutReturn,
	type ReturnDependencies,
} from "../src/onboarding-checkout-return";
const token = "cbe6173e-b4fb-4e1c-9df9-8c77e73016b1";
const source = {
	id: "self",
	tab: { id: 42 },
	frameId: 7,
	documentId: "original-document",
} as chrome.runtime.MessageSender;
const website = {
	url: "https://staging.anidachi.app/success",
	origin: "https://staging.anidachi.app",
	frameId: 0,
};
function fixture() {
	let stored: Record<string, unknown> = {};
	let owner: string | null = "owner-a";
	let time = 1000;
	const deps: ReturnDependencies = {
		extensionId: "self",
		origins: ["https://staging.anidachi.app"],
		storage: {
			get: async () => stored,
			set: async (v) => {
				stored = { ...stored, ...v };
			},
		},
		owner: async () => owner,
		now: () => time,
		canReturn: vi.fn(async () => true),
		open: vi.fn(async () => {}),
		probe: vi.fn(async () => ({ ready: true })),
		focus: vi.fn(async () => {}),
	};
	return {
		deps,
		api: createOnboardingCheckoutReturn(deps),
		owner: (value: string | null) => {
			owner = value;
		},
		later: () => {
			time += 3_600_001;
		},
	};
}
const open = {
	type: "ANIDACHI_ONBOARDING_CHECKOUT_OPEN",
	token,
	offer: "trial",
};
const complete = {
	type: "anidachi:onboarding-return:v1",
	token,
	ownerUserId: "owner-a",
};
it("returns to the exact original document after worker suspension, once", async () => {
	const f = fixture();
	expect(await f.api.open(open, source)).toEqual({ opened: true });
	expect(f.deps.open).toHaveBeenCalledWith(
		expect.stringContaining("confirm=trial&onboarding=" + token),
	);
	const restarted = createOnboardingCheckoutReturn(f.deps);
	expect(await restarted.complete(complete, website)).toEqual({
		returned: true,
	});
	expect(f.deps.probe).toHaveBeenCalledWith(
		expect.objectContaining({
			tabId: 42,
			frameId: 7,
			documentId: "original-document",
		}),
	);
	expect(await restarted.complete(complete, website)).toEqual({
		returned: false,
	});
	expect(f.deps.focus).toHaveBeenCalledTimes(1);
});
it.each([
	"other-origin",
	"iframe",
	"account-change",
	"expired",
	"closed-tour",
	"closed-tab",
])("never switches tabs for %s", async (kind) => {
	const f = fixture();
	await f.api.open(open, source);
	const sender = { ...website };
	if (kind === "other-origin") sender.url = "https://evil.example/success";
	if (kind === "iframe") sender.frameId = 1;
	if (kind === "account-change") f.owner("owner-b");
	if (kind === "expired") f.later();
	if (kind === "closed-tour")
		vi.mocked(f.deps.probe).mockResolvedValue({ ready: false });
	if (kind === "closed-tab")
		vi.mocked(f.deps.probe).mockRejectedValue(new Error("No tab"));
	expect(await f.api.complete(complete, sender)).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("rejects a changed website owner and unknown tokens", async () => {
	const f = fixture();
	await f.api.open(open, source);
	expect(
		await f.api.complete({ ...complete, ownerUserId: "owner-b" }, website),
	).toEqual({ returned: false });
	expect(
		await f.api.complete(
			{ ...complete, token: "9b642249-fae4-4e28-bba8-b0879c9c01ed" },
			website,
		),
	).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("rechecks owner after the document probe", async () => {
	const f = fixture();
	await f.api.open(open, source);
	vi.mocked(f.deps.probe).mockImplementation(async () => {
		f.owner("owner-b");
		return { ready: true };
	});
	expect(await f.api.complete(complete, website)).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("does not focus after the website is left or a response expires", async () => {
	const f = fixture();
	await f.api.open(open, source);
	vi.mocked(f.deps.canReturn).mockResolvedValue(false);
	expect(await f.api.complete(complete, website)).toEqual({ returned: false });
	vi.mocked(f.deps.canReturn).mockResolvedValue(true);
	vi.mocked(f.deps.probe).mockImplementation(async () => {
		f.later();
		return { ready: true };
	});
	expect(await f.api.complete(complete, website)).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("rechecks the owner after consuming the navigation receipt", async () => {
	const f = fixture();
	await f.api.open(open, source);
	const save = f.deps.storage.set;
	f.deps.storage.set = async (value) => {
		await save(value);
		f.owner("owner-b");
	};
	expect(await f.api.complete(complete, website)).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("ignores a disconnected website document even when its replacement has the same URL", async () => {
	const f = fixture();
	await f.api.open(open, source);
	let alive = true;
	vi.mocked(f.deps.probe).mockImplementation(async () => {
		alive = false;
		return { ready: true };
	});
	expect(await f.api.complete(complete, website, () => alive)).toEqual({
		returned: false,
	});
	expect(f.deps.focus).not.toHaveBeenCalled();
});
it("checks owner after the final asynchronous tab lookup", async () => {
	const f = fixture();
	await f.api.open(open, source);
	vi.mocked(f.deps.canReturn)
		.mockResolvedValueOnce(true)
		.mockImplementationOnce(async () => {
			f.owner("owner-b");
			return true;
		});
	expect(await f.api.complete(complete, website)).toEqual({ returned: false });
	expect(f.deps.focus).not.toHaveBeenCalled();
});

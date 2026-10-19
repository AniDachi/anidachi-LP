import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostingPaywall, getHostingNoticeKind } from "../src/hosting-paywall";
import { useHostingAccess } from "../src/use-hosting-access";
import type { HostingAccountAccess } from "../src/hosting-access-client";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const owner = "11111111-1111-4111-8111-111111111111";
const access: HostingAccountAccess = {
	entitlementsVersion: 1,
	ownerUserId: owner,
	serverTime: "2026-09-28T01:00:00Z",
	planCode: "free",
	hostingOffer: { trialMode: "cardless", trialDays: 3, policyRevision: 2 },
	hosting: {
		hostingPolicyVersion: 2,
		hostingActivationAt: "2026-09-28T00:00:00Z",
		canHost: false,
		trialEligibility: "eligible",
		trialEndsAt: null,
	},
};
let root: Root | null;
let container: HTMLDivElement;
function ConnectedOffer({
	ownerUserId,
	request,
	onClose,
}: {
	ownerUserId: string;
	request: (owner: string) => Promise<HostingAccountAccess>;
	onClose(): void;
}) {
	const display = useHostingAccess({
		ownerUserId,
		sessionKey: "test-login",
		enabled: true,
		request,
	});
	return (
		<HostingPaywall
			state={display.state}
			onRefresh={display.refresh}
			onClose={onClose}
		/>
	);
}
async function mount(
	request: (owner: string) => Promise<HostingAccountAccess>,
) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	const close = vi.fn();
	await act(async () =>
		root!.render(
			<ConnectedOffer ownerUserId={owner} onClose={close} request={request} />,
		),
	);
	return close;
}
describe("hosting offer", () => {
	afterEach(async () => {
		await act(async () => root?.unmount());
		root = null;
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});
	it("opens selected Plus confirmation while the website still verifies browser markers", async () => {
		const request = vi.fn().mockResolvedValue(access);
		const close = await mount(request);
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		expect(container.textContent).toContain(
			"You can still join friends for free.",
		);
		expect(container.textContent).toContain("Try 3 days free");
		expect(container.textContent).toContain("No card required.");
		expect(container.textContent).not.toContain("Card required");
		const link = container.querySelector("a")!;
		expect(link.href).toBe(
			"http://localhost:3003/checkout?plan=plus&billing=monthly&confirm=trial",
		);
		expect(link.target).toBe("_blank");
		expect(link.rel).toBe("noopener noreferrer");
		expect(container.textContent).toContain("Choose Plus or Pro");
		expect(link.textContent).toContain("Try 3 days free");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[aria-label="Close plan offer"]')!
				.click(),
		);
		expect(close).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledTimes(1);
	});
	it.each([
		"existing_account",
		"used",
		"unavailable",
	] as const)("never promises a trial for %s", async (trialEligibility) => {
		await mount(
			vi.fn().mockResolvedValue({
				...access,
				hosting: { ...access.hosting, trialEligibility },
			}),
		);
		expect(container.textContent).not.toContain("Try 3 days free");
		expect(container.querySelector("a")?.href).toBe(
			"http://localhost:3003/pricing?plan=plus&billing=monthly",
		);
		expect(container.querySelector("a")?.textContent).toContain("View plans");
	});

	it("does not promise a trial when access is loading, unavailable or from an older server", async () => {
		const request = vi.fn().mockRejectedValue(new Error("Unavailable"));
		await mount(request);
		expect(container.textContent).not.toContain("Try 3 days free");
		expect(container.textContent).toContain("Couldn’t check your access");
		request.mockResolvedValue({ ...access, hosting: undefined });
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[aria-label="Refresh hosting access"]',
				)!
				.click(),
		);
		expect(container.textContent).not.toContain("Try 3 days free");
	});
	it("does not turn missing offer terms into a purchase fallback", async () => {
		const request = vi.fn().mockResolvedValue({ ...access, hostingOffer: undefined });
		await mount(request);
		expect(container.querySelector("a")).toBeNull();
		expect(container.textContent).toContain("Try again");
		expect(container.textContent).not.toContain("Continue with Plus");
	});
	it("keeps ordinary plans available on a confirmed card-required server", async () => {
		await mount(vi.fn().mockResolvedValue({ ...access,
			hostingOffer: { ...access.hostingOffer, trialMode: "card_required" } }));
		expect(container.querySelector("a")?.textContent).toContain("View plans");
		expect(container.querySelector("a")?.href).toBe(
			"http://localhost:3003/pricing?plan=plus&billing=monthly",
		);
		expect(container.textContent).not.toMatch(/Continue with Plus|Try 3 days free|No card required/);
	});
	it("refreshes after returning from checkout and never creates a room automatically", async () => {
		const request = vi.fn().mockResolvedValue(access);
		const close = await mount(request);
		request.mockResolvedValue({
			...access,
			planCode: "plus",
			hosting: { ...access.hosting, canHost: true, trialEligibility: "used" },
		});
		await act(async () => {
			window.dispatchEvent(new Event("blur"));
			window.dispatchEvent(new Event("focus"));
		});
		expect(container.textContent).toContain("You’re ready to host");
		expect(container.querySelector("a")).toBeNull();
		expect(close).not.toHaveBeenCalled();
	});
	it("dismisses with Escape and ignores an old owner's late response", async () => {
		let resolve!: (value: HostingAccountAccess) => void;
		const request = vi.fn().mockImplementation(
			() =>
				new Promise<HostingAccountAccess>((r) => {
					resolve = r;
				}),
		);
		const close = await mount(request);
		await act(async () =>
			container
				.querySelector('[role="dialog"]')!
				.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
				),
		);
		expect(close).toHaveBeenCalledTimes(1);
		const oldResolve = resolve;
		await act(async () =>
			root!.render(
				<ConnectedOffer
					ownerUserId="22222222-2222-4222-8222-222222222222"
					onClose={close}
					request={request}
				/>,
			),
		);
		await act(async () => oldResolve(access));
		expect(container.textContent).not.toContain("Try 3 days free");
	});
});

describe("truthful hosting copy", () => {
	const state = {
		mode: "paid-hosting" as const,
		access,
		error: false,
		busy: false,
	};
	it("does not infer browser trial eligibility from account-only hosting terms", () => {
		expect(getHostingNoticeKind(state)).toBe("plans");
		for (const hostingOffer of [
			undefined,
			{
				trialMode: "card_required" as const,
				trialDays: 3 as const,
				policyRevision: 2,
			},
			{
				trialMode: "cardless" as const,
				trialDays: 3 as const,
				policyRevision: 99,
			},
		]) {
			expect(
				getHostingNoticeKind({ ...state, access: { ...access, hostingOffer } }),
			).toBe(hostingOffer ? "plans" : "unverified");
		}
	});
	it("uses server time for trial expiry and keeps paid access above an old expired trial", () => {
		const expired = {
			...access,
			hosting: {
				...access.hosting!,
				trialEligibility: "used" as const,
				trialEndsAt: "2026-09-28T00:00:00Z",
			},
		};
		expect(getHostingNoticeKind({ ...state, access: expired })).toBe("ended");
		expect(
			getHostingNoticeKind({
				...state,
				access: {
					...expired,
					hosting: { ...expired.hosting, trialEndsAt: "2026-09-30T00:00:00Z" },
				},
			}),
		).toBe("plans");
		expect(
			getHostingNoticeKind({
				...state,
				access: {
					...expired,
					hosting: { ...expired.hosting, trialEndsAt: null },
				},
			}),
		).toBe("plans");
		expect(
			getHostingNoticeKind({
				...state,
				access: {
					...expired,
					planCode: "plus",
					hosting: { ...expired.hosting, canHost: true },
				},
			}),
		).toBe("ready");
	});
	it("retains known presentation during refresh or failure and keeps initial unknown neutral", () => {
		expect(getHostingNoticeKind({ ...state, busy: true })).toBe("plans");
		expect(getHostingNoticeKind({ ...state, error: true })).toBe("plans");
		expect(
			getHostingNoticeKind({ ...state, access: undefined, busy: true }),
		).toBe("checking");
		expect(
			getHostingNoticeKind({ ...state, access: undefined, error: true }),
		).toBe("error");
	});
});

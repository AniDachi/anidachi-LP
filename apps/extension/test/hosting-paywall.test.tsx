import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostingPaywall } from "../src/hosting-paywall";
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
function ConnectedOffer({ ownerUserId, request, onClose }: { ownerUserId: string; request: (owner: string) => Promise<HostingAccountAccess>; onClose(): void }) {
  const display = useHostingAccess({ ownerUserId, sessionKey: "test-login", enabled: true, request });
  return <HostingPaywall state={display.state} onRefresh={display.refresh} onClose={onClose} />;
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
	it("explains free joining, offers a verified trial, and only links to pricing", async () => {
		const request = vi.fn().mockResolvedValue(access);
		const close = await mount(request);
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		expect(container.textContent).toContain("Join friends’ rooms for free");
		expect(container.textContent).toContain("3-day free trial");
		expect(container.textContent).toContain("Card required");
		const link = container.querySelector("a")!;
		expect(link.href).toBe("http://localhost:3003/pricing");
		expect(link.textContent).toContain("Choose a plan");
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
			vi
				.fn()
				.mockResolvedValue({
					...access,
					hosting: { ...access.hosting, trialEligibility },
				}),
		);
		expect(container.textContent).not.toContain("3-day free trial");
		expect(container.querySelector("a")?.textContent).toContain(
			"Choose a plan",
		);
	});
	it("legacy account-age metadata offers a refresh without promising or denying a trial", async () => {
		const request = vi.fn().mockResolvedValue({
			...access,
			hosting: { ...access.hosting, trialEligibility: "existing_account" },
		});
		await mount(request);
		expect(container.textContent).not.toContain("starts with payment");
		expect(container.textContent).not.toContain("no free trial");
		expect(container.textContent).toContain("Check trial availability on the plans page");
		request.mockResolvedValue(access);
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Refresh hosting access"]')!.click());
		expect(container.textContent).toContain("3-day free trial");
		expect(request).toHaveBeenCalledTimes(2);
	});
	it("does not promise a trial when access is loading, unavailable or from an older server", async () => {
		const request = vi.fn().mockRejectedValue(new Error("Unavailable"));
		await mount(request);
		expect(container.textContent).not.toContain("3-day free trial");
		expect(container.textContent).toContain(
			"Could not check your current plan",
		);
		request.mockResolvedValue({ ...access, hosting: undefined });
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[aria-label="Refresh hosting access"]',
				)!
				.click(),
		);
		expect(container.textContent).not.toContain("3-day free trial");
	});
	it("refreshes after returning from checkout and never creates a room automatically", async () => {
		const request = vi.fn().mockResolvedValue(access);
		const close = await mount(request);
		request.mockResolvedValue({
			...access,
			planCode: "plus",
			hosting: { ...access.hosting, canHost: true, trialEligibility: "used" },
		});
		await act(async () => window.dispatchEvent(new Event("focus")));
		expect(container.textContent).toContain("Your account can create rooms");
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
		expect(container.textContent).not.toContain("3-day free trial");
	});
});

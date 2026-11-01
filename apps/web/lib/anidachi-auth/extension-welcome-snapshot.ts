import {
	billingDisplayValidityMs,
	type BillingOverview,
} from "../billing-view";
import {
	resolveExtensionWelcome,
	resolveHostingWelcome,
	type ExtensionWelcome,
} from "../extension-welcome";
import {
	readAccountHostingStatus,
	type AccountHostingRead,
} from "./account-hosting-status";

/** Explicit welcome only. No self-HTTP and no cookie credentials in client props. */
export async function loadExtensionWelcome(
	owner: string,
	deps: {
		websiteUser(): Promise<{ id: string } | null>;
		overview(owner: string): Promise<BillingOverview>;
		readStatus?: (
			owner: string,
			startedAt: number,
		) => Promise<AccountHostingRead>;
		clock?: () => number;
	},
): Promise<ExtensionWelcome> {
	const clock = deps.clock ?? (() => performance.now()),
		started = clock();
	const user = await deps.websiteUser();
	if (!user || user.id !== owner) return { kind: "sign_in" };
	const [billing, hosting] = await Promise.allSettled([
		deps.overview(owner),
		deps.readStatus
			? deps.readStatus(owner, started)
			: readAccountHostingStatus(owner, {}, started),
	]);
	const elapsed = clock() - started;
	if (!Number.isFinite(elapsed) || elapsed < 0) return { kind: "error" };
	if (
		billing.status === "fulfilled" &&
		billing.value.ownerUserId === owner &&
		billingDisplayValidityMs(billing.value) > elapsed
	) {
		const welcome = resolveExtensionWelcome(billing.value, elapsed);
		if (welcome.kind === "paid" || welcome.kind === "trial") return welcome;
	}
	if (hosting.status === "fulfilled" && hosting.value.mode === "free20")
		return resolveHostingWelcome(owner, hosting.value.status, elapsed);
	return billing.status === "fulfilled" &&
		billing.value.ownerUserId === owner &&
		hosting.status === "fulfilled" &&
		hosting.value.mode === "legacy"
		? { kind: "inactive" }
		: { kind: "error" };
}

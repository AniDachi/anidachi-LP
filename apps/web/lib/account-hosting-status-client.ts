import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	acceptAccountHostingStatus,
	type AccountHostingStatus,
} from "@anidachi/protocol";
import { api, ApiError } from "./client-api";
export type AccountHostingRead =
	| { mode: "legacy" }
	| { mode: "free20"; status: AccountHostingStatus };

/** Pending work only; no account authority is cached between activations. */
export async function requestAccountHostingStatus(
	owner: string,
	signal?: AbortSignal,
): Promise<AccountHostingRead> {
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	else signal?.addEventListener("abort", abort, { once: true });
	let timer: ReturnType<typeof setTimeout>;
	const deadline = new Promise<never>((_resolve, reject) => {
		controller.signal.addEventListener(
			"abort",
			() => reject(new Error("Hosting read aborted")),
			{ once: true },
		);
		timer = setTimeout(() => controller.abort(), 10_000);
	});
	try {
		controller.signal.throwIfAborted();
		const body = await Promise.race([
			api<unknown>("/api/me/hosting-status", {
				cache: "no-store",
				headers: { [ACCOUNT_HOSTING_OWNER_HEADER]: owner },
				signal: controller.signal,
			}),
			deadline,
		]);
		controller.signal.throwIfAborted();
		const status = acceptAccountHostingStatus(owner, body);
		if (!status) throw new Error("Invalid hosting status");
		return { mode: "free20", status };
	} catch (error) {
		if (
			!controller.signal.aborted &&
			error instanceof ApiError &&
			error.status === 404 &&
			error.code === "FREE20_DISABLED"
		)
			return { mode: "legacy" };
		throw error;
	} finally {
		clearTimeout(timer!);
		signal?.removeEventListener("abort", abort);
	}
}

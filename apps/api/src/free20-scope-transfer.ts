import {
	type Free20ContextTransferReceipt,
	type Free20ContextTransferRequest,
	Free20ContextTransferRequestSchema,
} from "@anidachi/protocol";
import type { PendingParticipantDisconnect } from "./participant-disconnect";
import { parseParticipantDisconnectState } from "./participant-disconnect";

export const FREE20_TRANSFER_KEY = "free20_scope_transfer_v1";
export const FREE20_TRANSFER_EPOCH_KEY = "free20_scope_transfer_epoch_v1";
const RECEIPT_PREFIX = "free20_scope_receipt_v1:";
export interface Free20ScopeTransfer {
	version: 1;
	request: Free20ContextTransferRequest;
	disconnect: PendingParticipantDisconnect;
	fencedAt: number;
	nextAttemptAt: number;
	phase: "stopped" | "settled" | "attached";
}
export function parseFree20ScopeTransfer(
	value: unknown,
): Free20ScopeTransfer | null {
	if (value === undefined) return null;
	const x = value as Free20ScopeTransfer;
	if (
		!x ||
		x.version !== 1 ||
		!Free20ContextTransferRequestSchema.safeParse(x.request).success ||
		!parseParticipantDisconnectState({
			schemaVersion: 1,
			records: [x.disconnect],
		}) ||
		x.disconnect.role !== "host" ||
		x.disconnect.userId !== x.request.ownerUserId ||
		!Number.isSafeInteger(x.fencedAt) ||
		x.fencedAt < 0 ||
		!Number.isSafeInteger(x.nextAttemptAt) ||
		x.nextAttemptAt < 0 ||
		!["stopped", "settled", "attached"].includes(x.phase)
	)
		throw new Error("Invalid durable Free20 transfer");
	return x;
}
export function sameFree20Transfer(
	a: Free20ContextTransferRequest,
	b: Free20ContextTransferRequest,
): boolean {
	return (
		a.version === b.version &&
		a.transferId === b.transferId &&
		a.ownerUserId === b.ownerUserId &&
		a.roomId === b.roomId &&
		a.roomGeneration === b.roomGeneration &&
		a.browserHash === b.browserHash &&
		a.installationHash === b.installationHash
	);
}
export function free20TransferReceipt(
	request: Free20ContextTransferRequest,
): Free20ContextTransferReceipt {
	const {
		browserHash: _browser,
		installationHash: _installation,
		...binding
	} = request;
	return { ...binding, outcome: "applied" };
}
export function free20TransferReceiptKey(
	request: Free20ContextTransferRequest,
): string {
	return RECEIPT_PREFIX + request.transferId;
}
export interface ScopeTransferOperation {
	storage: DurableObjectStorage;
	pending(): Free20ScopeTransfer | null;
	terminal(): boolean;
	matches(request: Free20ContextTransferRequest): boolean;
	start(request: Free20ContextTransferRequest): Promise<void>;
	detach(intent: Free20ScopeTransfer): Promise<void>;
	save(intent: Free20ScopeTransfer): Promise<void>;
	settle(): Promise<boolean>;
	attach(request: Free20ContextTransferRequest): Promise<void>;
	checkpoint(): Promise<void>;
	complete(intent: Free20ScopeTransfer): Promise<void>;
	expire(deadlineAt: number): Promise<void>;
}
/** Called only while holding the room's lifecycle queue. No recursive fetches.
 * Every retry resumes the same durable work; an uncertain ACK never lifts a fence. */
export async function transferFree20Scope(
	request: Free20ContextTransferRequest,
	op: ScopeTransferOperation,
): Promise<Response> {
	const headers = { "Cache-Control": "private, no-store" };
	const unavailable = () =>
		Response.json(
			{ code: "ROOM_AUTHORITY_UNAVAILABLE" },
			{ status: 503, headers },
		);
	const conflict = () =>
		Response.json({ code: "FREE20_CONTEXT_BUSY" }, { status: 409, headers });
	try {
		if (!op.matches(request)) return conflict();
		if (op.terminal()) return unavailable();
		const completed = op.storage.kv.get(free20TransferReceiptKey(request));
		if (completed !== undefined) {
			if (
				!sameFree20Transfer(
					Free20ContextTransferRequestSchema.parse(completed),
					request,
				)
			)
				return conflict();
			await op.storage.sync();
			// A prior receipt write may have committed while its flush failed. Retire
			// only that matching in-memory fence, without touching any host socket.
			const pending = op.pending();
			if (pending && sameFree20Transfer(pending.request, request))
				await op.complete(pending);
			return Response.json(free20TransferReceipt(request), { headers });
		}
		let intent = op.pending();
		if (intent && !sameFree20Transfer(intent.request, request))
			return conflict();
		if (!intent) {
			await op.start(request);
			intent = op.pending();
		}
		if (!intent) throw new Error("Missing transfer intent");
		const deadline = intent.disconnect.deadlineAt;
		const expired = async () => {
			if (Date.now() < deadline && !op.terminal()) return false;
			if (!op.terminal()) await op.expire(deadline);
			return true;
		};
		if (await expired()) return unavailable();
		// Always re-arm/flush before external I/O, including after an uncertain initial commit.
		intent = {
			...intent,
			nextAttemptAt: Math.min(deadline, Date.now() + 5_000),
		};
		await op.save(intent);
		await op.detach(intent);
		if (intent.phase === "stopped") {
			if (!(await op.settle())) return unavailable();
			intent = { ...intent, phase: "settled" };
			await op.save(intent);
		}
		if (await expired()) return unavailable();
		if (intent.phase === "settled") {
			await op.attach(request);
			intent = { ...intent, phase: "attached" };
			await op.save(intent);
		}
		if (await expired()) return unavailable();
		await op.checkpoint();
		if (await expired()) return unavailable();
		await op.storage.sync();
		await op.complete(intent);
		return Response.json(free20TransferReceipt(request), { headers });
	} catch (error) {
		return error instanceof Error && error.message === "FREE20_CONTEXT_BUSY"
			? conflict()
			: unavailable();
	}
}

/** Bound bytes and time before parsing even on authenticated internal transports. */
export async function parseFree20TransferRequest(
	request: Request,
): Promise<Free20ContextTransferRequest | null> {
	if (!request.body) return null;
	const reader = request.body.getReader();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const body = await Promise.race([
			(async () => {
				const decoder = new TextDecoder("utf-8", { fatal: true });
				let text = "";
				let bytes = 0;
				for (;;) {
					const next = await reader.read();
					if (next.done) break;
					bytes += next.value.byteLength;
					if (bytes > 4096) throw new Error("Invalid transfer request");
					text += decoder.decode(next.value, { stream: true });
				}
				return JSON.parse(text + decoder.decode()) as unknown;
			})(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Transfer request timeout")),
					8000,
				);
			}),
		]);
		return Free20ContextTransferRequestSchema.parse(body);
	} catch {
		return null;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
		void reader.cancel().catch(() => undefined);
	}
}

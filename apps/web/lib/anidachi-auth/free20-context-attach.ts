import {
	type Free20ContextTransferRequest,
	Free20ContextTransferRequestSchema,
} from "@anidachi/protocol";
import { boundedFree20, readBoundedFree20Json } from "./free20-abuse-http";

/** SQL-only receiver. It cannot call back into the DO that owns serialization. */
export async function handleFree20ContextAttach(
	request: Request,
	roomId: string,
	dependencies: {
		authorize(authorization: string | null): boolean;
		attach(request: Free20ContextTransferRequest): Promise<void>;
	},
): Promise<Response> {
	const headers = { "Cache-Control": "private, no-store" };
	if (!dependencies.authorize(request.headers.get("authorization")))
		return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
	let command;
	try {
		command = Free20ContextTransferRequestSchema.parse(
			await boundedFree20(8000, (signal) =>
				readBoundedFree20Json(request.body, 4096, signal),
			),
		);
		if (command.roomId !== roomId) throw new Error("Wrong room");
	} catch {
		return Response.json(
			{ code: "INVALID_TRANSFER_REQUEST" },
			{ status: 400, headers },
		);
	}
	try {
		await boundedFree20(8000, () => dependencies.attach(command));
		const {
			browserHash: _browser,
			installationHash: _installation,
			...binding
		} = command;
		return Response.json({ ...binding, outcome: "applied" }, { headers });
	} catch (error) {
		const busy =
			error instanceof Error && error.message === "FREE20_CONTEXT_BUSY";
		return Response.json(
			{ code: busy ? "FREE20_CONTEXT_BUSY" : "ROOM_AUTHORITY_UNAVAILABLE" },
			{ status: busy ? 409 : 503, headers },
		);
	}
}

import { createHmac, timingSafeEqual } from "node:crypto";
import {
	UNINSTALL_OFFER_VALID_FOR_MS,
	UninstallError,
} from "./uninstall-offer";

/** Opaque, purpose-separated review token; no owner or Stripe IDs in the token. */
export function uninstallRevisions(secret: Uint8Array, now = Date.now) {
	const mac = (snapshot: string, expiry: number) =>
		createHmac("sha256", secret)
			.update(`uninstall-review-v1\0${expiry}\0${snapshot}`)
			.digest("base64url");
	return {
		sign(snapshot: string) {
			const expiry = now() + UNINSTALL_OFFER_VALID_FOR_MS;
			return `${expiry}.${mac(snapshot, expiry)}`;
		},
		verify(token: string, snapshot: string) {
			if (!/^\d{13}\.[\w-]{43}$/.test(token))
				throw new UninstallError(
					409,
					"Review the current offer before continuing.",
				);
			const [e, signature] = token.split(".");
			const expiry = Number(e);
			if (
				expiry <= now() ||
				expiry > now() + UNINSTALL_OFFER_VALID_FOR_MS ||
				!timingSafeEqual(
					Buffer.from(signature),
					Buffer.from(mac(snapshot, expiry)),
				)
			)
				throw new UninstallError(
					409,
					"Your offer changed or expired. Review it again.",
				);
		},
	};
}

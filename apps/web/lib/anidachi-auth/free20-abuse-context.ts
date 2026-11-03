import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	FREE20_CONTEXT_HEADER,
} from "@anidachi/protocol";
import type { NextRequest } from "next/server";
import { getResolvedSiteOrigin } from "../site-url";
import { readApprovedExtensionClientId } from "./extension-codes";
import {
	createFree20AbuseTokens,
	type Free20AbuseContext,
	free20ContextCookieName,
} from "./free20-abuse";
export const free20AbuseEnabled = () =>
	process.env.ANIDACHI_FREE20_ABUSE_ENABLED === "true";
export function free20AllowedOrigin(
	value: string | null,
	siteOrigin: string,
	extensionId: string | null,
) {
	return (
		value === siteOrigin ||
		(!!extensionId && value === `chrome-extension://${extensionId}`)
	);
}
export function free20ServerTokens(origin = getResolvedSiteOrigin()) {
	return createFree20AbuseTokens(process.env.ANIDACHI_JWT_SECRET ?? "", origin);
}
/** Invalid/missing evidence is passed as absent to canonical SQL: paid owners and
 * guests bypass proof there, while free admission receives CONTEXT_REQUIRED. */
export function resolveFree20RequestContext(
	request: NextRequest,
	owner: string,
): Free20AbuseContext | null {
	if (!free20AbuseEnabled()) return null;
	const origin = getResolvedSiteOrigin();
	if (request.nextUrl.origin !== origin) return null;
	const header = request.headers.get(FREE20_CONTEXT_HEADER);
	if (header !== null) {
		if (
			request.headers.get(ACCOUNT_HOSTING_OWNER_HEADER) !== owner ||
			(request.headers.has("origin") &&
				!free20AllowedOrigin(
					request.headers.get("origin"),
					origin,
					readApprovedExtensionClientId(),
				))
		)
			return null;
		return free20ServerTokens(origin).readContext(header, owner);
	}
	// Cookie-only evidence is first-party; a supplied invalid header never falls back.
	if (request.headers.has("origin") && request.headers.get("origin") !== origin)
		return null;
	const cookie = request.cookies.get(free20ContextCookieName(origin))?.value;
	return cookie ? free20ServerTokens(origin).readContext(cookie, owner) : null;
}
export async function resolveFree20SsrContext(
	owner: string,
): Promise<Free20AbuseContext | null> {
	if (!free20AbuseEnabled()) return null;
	const { cookies } = await import("next/headers");
	const origin = getResolvedSiteOrigin();
	const cookie = (await cookies()).get(free20ContextCookieName(origin))?.value;
	return cookie ? free20ServerTokens(origin).readContext(cookie, owner) : null;
}

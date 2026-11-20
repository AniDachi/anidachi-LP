const localePrefix = /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i;

export function isCrunchyrollCatalogOrigin(origin: string) {
	return origin === "https://www.crunchyroll.com" || origin === "https://crunchyroll.com";
}

export function crunchyrollCatalogPath(pathname: string) {
	const path = pathname.replace(localePrefix, "") || "/";
	return path === "/" || /^\/(?:videos|series|movie|movies|music|artist|search|watchlist|history|simulcast|simulcastcalendar|releasecalendar|discovery|crunchylists)(?:\/|$)/.test(path);
}

/** Apply the guest's site language to a canonical Crunchyroll episode URL. */
export function localizedWatchUrl(target: URL, currentHref: string): URL {
	const current = new URL(currentHref);
	const prefix = isCrunchyrollCatalogOrigin(current.origin) && current.pathname.match(localePrefix)?.[0];
	if (prefix) target.pathname = prefix + target.pathname;
	return target;
}

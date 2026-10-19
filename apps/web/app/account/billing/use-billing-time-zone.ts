"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const serverTimeZone = () => "UTC";
const clientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Match server HTML during hydration, then display the viewer's local dates.
 * No polling, network requests, or subscription state changes are involved.
 */
export function useBillingTimeZone(): string {
	return useSyncExternalStore(subscribe, clientTimeZone, serverTimeZone);
}

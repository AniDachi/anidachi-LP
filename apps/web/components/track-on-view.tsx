"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/gtag";

/** Fires one analytics event when the page state renders. Renders nothing. */
export function TrackOnView({
  event,
  params,
}: {
  event: string;
  params?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    trackEvent(event, params);
    // Once per mount: params are static for the state that rendered this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

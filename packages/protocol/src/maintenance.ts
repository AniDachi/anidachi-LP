/** Deployment-local HTTP admission only; this does not drain sockets or writers. */
export function parseMaintenanceMode(value: string | undefined): "open" | "closed" {
  return value === undefined || value === "" || value === "open" ? "open" : "closed";
}

/** Fresh values keep consumers from mutating another request's response contract. */
export function maintenanceHttpResponse() {
  return {
    status: 503 as const,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-Anidachi-Maintenance": "closed",
    },
    body: {
      error: "MAINTENANCE" as const,
      message: "AniDachi is temporarily unavailable. Please try again shortly.",
    },
  };
}

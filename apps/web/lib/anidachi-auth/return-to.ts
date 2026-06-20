export function isSafeAuthReturnTo(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }

  if (value.startsWith("//")) {
    return false;
  }

  if (
    value.startsWith("/api/") ||
    value.startsWith("/_next/") ||
    value.startsWith("/__anidachi/")
  ) {
    return false;
  }

  return true;
}

export function sanitizeAuthReturnTo(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return isSafeAuthReturnTo(value) ? value : "";
}

export function isSafeAuthReturnTo(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }

  if (value.startsWith("//")) {
    return false;
  }

  return value.startsWith("/room/") || value.startsWith("/extension/connect?");
}

export function sanitizeAuthReturnTo(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return isSafeAuthReturnTo(value) ? value : "";
}

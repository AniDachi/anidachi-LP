export function isSafeAuthReturnTo(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }

  if (value.startsWith("//")) {
    return false;
  }

  return (
    value.startsWith("/room/") ||
    value.startsWith("/extension/connect?") ||
    value.startsWith("/friend/invite/")
  );
}

export function sanitizeAuthReturnTo(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return isSafeAuthReturnTo(value) ? value : "";
}

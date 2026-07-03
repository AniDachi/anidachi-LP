const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA_PATTERN.test(userAgent);
}

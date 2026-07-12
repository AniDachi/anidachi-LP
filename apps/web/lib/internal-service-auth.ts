export function internalServiceAuthorization(secret: string): string {
  return `Bearer ${secret}`;
}

export function hasValidInternalServiceAuthorization(
  authorization: string | null,
  secret = process.env.ANIDACHI_INTERNAL_API_SECRET,
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length);
  if (provided.length !== secret.length) return false;
  let difference = 0;
  for (let index = 0; index < secret.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return difference === 0;
}

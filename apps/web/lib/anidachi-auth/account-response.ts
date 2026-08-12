import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  type AccountOwnedResponseMeta,
  type AccountResponseMeta,
} from "@anidachi/protocol";

export function createAccountResponseMeta(now = new Date()): AccountResponseMeta {
  return {
    serverTime: now.toISOString(),
    schemaVersion: ACCOUNT_RESPONSE_SCHEMA_VERSION,
  };
}

export function createOwnedAccountResponseMeta(
  ownerUserId: string,
  now = new Date(),
): AccountOwnedResponseMeta {
  return {
    ...createAccountResponseMeta(now),
    ownerUserId,
  };
}

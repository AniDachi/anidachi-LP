import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  type AccountResponseMeta,
} from "@anidachi/protocol";

export function createAccountResponseMeta(now = new Date()): AccountResponseMeta {
  return {
    serverTime: now.toISOString(),
    schemaVersion: ACCOUNT_RESPONSE_SCHEMA_VERSION,
  };
}

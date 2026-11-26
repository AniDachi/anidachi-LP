/** Public builds negotiate the deployed v4 history contract. */
export function watchHistoryProviderVersion(): 4 | 5 {
  return import.meta.env.WXT_EXTENSION_CHANNEL === "staging" ? 5 : 4;
}

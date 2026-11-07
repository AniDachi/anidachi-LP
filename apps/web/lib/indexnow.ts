/**
 * IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam and other participating engines
 * that URLs changed. Google does not use IndexNow.
 *
 * The key is public by design: engines verify it by fetching `${INDEXNOW_KEY_LOCATION}`, served by
 * `app/anidachidd91b69e4d5d7425cb00ad9aa98ac352.txt/route.ts` on production only. If the key ever
 * changes, rename that route folder to match.
 */
export const INDEXNOW_KEY = "anidachidd91b69e4d5d7425cb00ad9aa98ac352";

export const INDEXNOW_HOST = "www.anidachi.app";
export const INDEXNOW_ORIGIN = `https://${INDEXNOW_HOST}`;
export const INDEXNOW_KEY_LOCATION = `${INDEXNOW_ORIGIN}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** The protocol allows up to 10,000 URLs per POST. */
export const INDEXNOW_MAX_URLS = 10_000;

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

/**
 * Turns paths or URLs into absolute www.anidachi.app URLs. Apex URLs are moved to www; anything on
 * another host is rejected, because IndexNow refuses the whole batch when one URL is off-host.
 */
export function normalizeIndexNowUrls(inputs: string[]): { urls: string[]; rejected: string[] } {
  const urls = new Set<string>();
  const rejected: string[] = [];
  for (const raw of inputs) {
    const value = raw.trim();
    if (!value || value.startsWith("#")) continue;
    let parsed: URL;
    try {
      parsed = value.startsWith("/") ? new URL(value, INDEXNOW_ORIGIN) : new URL(value);
    } catch {
      rejected.push(value);
      continue;
    }
    if (parsed.hostname === "anidachi.app") parsed.hostname = INDEXNOW_HOST;
    if (parsed.protocol !== "https:" || parsed.hostname !== INDEXNOW_HOST || parsed.port) {
      rejected.push(value);
      continue;
    }
    parsed.hash = "";
    urls.add(parsed.toString());
  }
  return { urls: [...urls], rejected };
}

/** Splits URLs into protocol-sized POST bodies. */
export function buildIndexNowPayloads(urls: string[]): IndexNowPayload[] {
  const payloads: IndexNowPayload[] = [];
  for (let i = 0; i < urls.length; i += INDEXNOW_MAX_URLS) {
    payloads.push({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls.slice(i, i + INDEXNOW_MAX_URLS),
    });
  }
  return payloads;
}

/** What each IndexNow response status means (https://www.indexnow.org/documentation). */
export function describeIndexNowStatus(status: number): string {
  switch (status) {
    case 200:
      return "OK: URLs submitted";
    case 202:
      return "Accepted: key validation pending";
    case 400:
      return "Bad request: invalid format";
    case 403:
      return "Forbidden: key not valid (key file missing or wrong)";
    case 422:
      return "Unprocessable: URLs do not belong to the host or key mismatch";
    case 429:
      return "Too many requests: slow down";
    default:
      return `Unexpected status ${status}`;
  }
}

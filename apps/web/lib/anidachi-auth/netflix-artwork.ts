/** Netflix metadata artwork is served by subdomains of the observed nflxso CDN.
 * Do not accept suffix lookalikes, credentials, ports or arbitrary source hosts. */
export function isNetflixArtworkUrl(value: string | null): boolean {
  if (value === null) return true;
  if (value.length > 2048 || !/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+nflxso\.net\/[^#\s]*$/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+nflxso\.net$/.test(url.hostname) &&
      !url.hash;
  } catch { return false; }
}

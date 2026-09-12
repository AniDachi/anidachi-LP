/** Use the observed video ID, not page metadata that can lag behind SPA navigation. */
export function youtubeHistoryArtworkUrl(videoId: string): string | null {
  return /^[A-Za-z0-9_-]{6,32}$/.test(videoId)
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : null;
}

export function findBestVideo(root: Document | ShadowRoot = document): HTMLVideoElement | null {
  const videos = findVideosDeep(root).filter(isUsableVideo);
  const scored = videos
    .map((video) => ({ video, score: scoreVideo(video) }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.video ?? null;
}

export function findVideosDeep(root: Document | ShadowRoot): HTMLVideoElement[] {
  const videos: HTMLVideoElement[] = [];
  const elements = Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    if (element instanceof HTMLVideoElement) {
      videos.push(element);
    }

    if (element.shadowRoot) {
      videos.push(...findVideosDeep(element.shadowRoot));
    }
  }

  return videos;
}

export function isUsableVideo(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  return (
    rect.width >= 160 &&
    rect.height >= 90 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

export function scoreVideo(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  const durationBonus = Number.isFinite(video.duration) && video.duration > 60 ? 50000 : 0;
  const playbackBonus = video.paused ? 0 : 100000;
  return rect.width * rect.height + durationBonus + playbackBonus;
}

export function findPlayerContainer(video: HTMLVideoElement): HTMLElement {
  const videoRect = video.getBoundingClientRect();
  let parent = video.parentElement;

  while (parent && parent !== document.body) {
    const rect = parent.getBoundingClientRect();
    const containsVideo = rect.width >= videoRect.width && rect.height >= videoRect.height;
    const widthSlack = Math.max(96, videoRect.width * 0.18);
    const heightSlack = Math.max(96, videoRect.height * 0.22);
    const tightlyWrapsVideo =
      rect.width <= videoRect.width + widthSlack && rect.height <= videoRect.height + heightSlack;

    if (containsVideo && tightlyWrapsVideo) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return video.parentElement ?? document.body;
}

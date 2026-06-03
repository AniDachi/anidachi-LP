export function duckVideoVolume(video: HTMLVideoElement, targetVolume = 0.1): () => void {
  const previousVolume = video.volume;
  const previousMuted = video.muted;
  let restored = false;

  video.volume = Math.min(previousVolume, targetVolume);

  return () => {
    if (restored) {
      return;
    }

    restored = true;
    video.volume = previousVolume;
    video.muted = previousMuted;
  };
}

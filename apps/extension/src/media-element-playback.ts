export async function attachAndPlayVideoElement(
  container: HTMLElement,
  video: HTMLVideoElement,
): Promise<void> {
  container.replaceChildren(video);
  await video.play();
}

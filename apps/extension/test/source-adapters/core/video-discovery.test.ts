import { describe, expect, it } from "vitest";
import {
  findBestVideo,
  findVideosDeep,
  isUsableVideo,
  scoreVideo,
} from "../../../src/source-adapters/core/video-discovery";

describe("video discovery", () => {
  it("discovers videos in open shadow roots", () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.querySelector("#host") as HTMLElement;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<video id="shadow-video"></video>';
    const video = shadow.querySelector("video") as HTMLVideoElement;

    expect(findVideosDeep(document)).toEqual([video]);
  });

  it("filters out videos that are too small or hidden", () => {
    document.body.innerHTML = `
      <video id="small"></video>
      <video id="hidden" style="display: none"></video>
      <video id="visible"></video>
    `;
    const small = document.querySelector("#small") as HTMLVideoElement;
    const hidden = document.querySelector("#hidden") as HTMLVideoElement;
    const visible = document.querySelector("#visible") as HTMLVideoElement;
    mockRect(small, 159, 90);
    mockRect(hidden, 1920, 1080);
    mockRect(visible, 640, 360);

    expect([small, hidden, visible].filter(isUsableVideo)).toEqual([visible]);
  });

  it("scores playing and long-form videos above larger paused previews", () => {
    document.body.innerHTML = '<video id="preview"></video><video id="episode"></video>';
    const preview = document.querySelector("#preview") as HTMLVideoElement;
    const episode = document.querySelector("#episode") as HTMLVideoElement;
    mockRect(preview, 500, 400);
    mockRect(episode, 320, 180);
    Object.defineProperty(episode, "duration", { configurable: true, value: 120 });
    Object.defineProperty(episode, "paused", { configurable: true, value: false });

    expect(scoreVideo(episode)).toBeGreaterThan(scoreVideo(preview));
    expect(findBestVideo(document)).toBe(episode);
  });

  it("keeps DOM order when usable videos have the same score", () => {
    document.body.innerHTML = '<video id="first"></video><video id="second"></video>';
    const first = document.querySelector("#first") as HTMLVideoElement;
    const second = document.querySelector("#second") as HTMLVideoElement;
    mockRect(first, 640, 360);
    mockRect(second, 640, 360);

    expect(findBestVideo(document)).toBe(first);
  });
});

function mockRect(element: Element, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

import { describe, expect, it } from "vitest";
import { GenericVideoAdapter } from "../../../src/source-adapters/generic/adapter";
import { genericDefinition } from "../../../src/source-adapters/generic/definition";

describe("generic source adapter", () => {
  it("creates the existing HTML5 adapter for the selected video", () => {
    document.body.innerHTML = `
      <main id="player"><video></video></main>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const player = document.querySelector("#player") as HTMLElement;
    mockRect(video, 640, 360);
    mockRect(player, 640, 360);

    const adapter = genericDefinition.detect(video);

    expect(genericDefinition).toMatchObject({
      id: "generic-html5-video",
      provider: "generic",
      priority: 0,
    });
    expect(adapter).toBeInstanceOf(GenericVideoAdapter);
    expect(adapter?.video).toBe(video);
    expect(adapter?.container).toBe(player);
    expect(adapter?.getFingerprint()).toBe("html5|/|/");
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

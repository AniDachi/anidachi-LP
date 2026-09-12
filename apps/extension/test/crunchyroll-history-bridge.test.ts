import { afterEach, expect, it, vi } from "vitest";
import variants from "./fixtures/crunchyroll/catalog-variants.json";
import { CRUNCHYROLL_CONTROL_SOURCE, CRUNCHYROLL_CONTROL_RESULT_SOURCE } from "../src/source-adapters/crunchyroll/bridge-contract";
vi.mock("wxt/utils/define-content-script", () => ({ defineContentScript: (value: unknown) => value }));
import script from "../entrypoints/crunchyroll.content";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("MAIN captures locale/player tracks before async auth and keeps provider credentials inside MAIN", async () => {
  vi.useFakeTimers();
  document.documentElement.lang = "fr-FR";
  Object.defineProperty(window, "location", { configurable: true, value: new URL("https://www.crunchyroll.com/watch/G8WUNEWJE") });
  const video = document.createElement("video");
  video.getBoundingClientRect = () => ({ width: 640, height: 360 } as DOMRect);
  document.body.append(video);
  window.__anidachiCrunchyrollBitmovinPlayers = [{ getVideoElement: () => video, getAudio: () => ({ lang: "ja-JP" }), subtitles: { list: () => [{ lang: "en-US", enabled: true }] } } as never];
  const posted = vi.spyOn(window, "postMessage");
  let release!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/auth/")) return new Promise<Response>((resolve) => { release = resolve; });
    if (url.includes("/objects/G8WUNEWJE")) return Response.json(variants.objectResponses.G8WUNEWJE);
    if (url.includes("/objects/")) return Response.json({ data: [{ id: variants.objectResponses.G8WUNEWJE.data[0]!.episode_metadata.series_id,
      images: { poster_tall: [[{ source: "https://www.crunchyroll.com/poster.jpg", width: 480, height: 720 }]] } }] });
    if (url.includes("/series/")) return Response.json(variants.seasonsResponse);
    return Response.json(variants.episodesResponse);
  }));
  (script as unknown as { main(): void }).main();
  window.dispatchEvent(new MessageEvent("message", { source: window, data: { source: CRUNCHYROLL_CONTROL_SOURCE, id: "identity-request", action: "historyIdentity", contentId: "G8WUNEWJE", locale: "fr-FR" } }));
  await vi.advanceTimersByTimeAsync(1);
  expect(release).toBeTypeOf("function");
  document.documentElement.lang = "de-DE";
  release(Response.json({ access_token: "private-provider-token", country: "VN", expires_in: 3600 }));
  await vi.advanceTimersByTimeAsync(1);
  const result = posted.mock.calls.map((call) => call[0]).find((value) => value.source === CRUNCHYROLL_CONTROL_RESULT_SOURCE && value.id === "identity-request");
  expect(result).toMatchObject({ ok: true, metadata: { identity: { providerContentId: "G8WUNEWJE", audioLocale: "en-US" }, context: { requestedLocale: "fr-FR", audioLocale: "ja-JP", region: "VN", subtitleLocales: ["en-US"] } } });
  expect(JSON.stringify(result)).not.toContain("private-provider-token");
  expect(result.metadata.artworkUrl).toBe("https://www.crunchyroll.com/poster.jpg");
});

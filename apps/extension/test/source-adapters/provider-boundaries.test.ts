import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceAdaptersDirectory = resolve(process.cwd(), "src/source-adapters");
const sourceDirectory = resolve(process.cwd(), "src");
const providerDirectories = ["youtube", "crunchyroll", "generic"] as const;
const sharedOverlayRuntimeFiles = [
  "overlay-app.tsx",
  "overlay-layout-runtime.ts",
  "overlay-layout.ts",
  "top-bubble-reveal.ts",
] as const;

describe("source adapter provider boundaries", () => {
  it("does not import a sibling provider folder", () => {
    for (const provider of providerDirectories) {
      const siblingDirectories = providerDirectories.filter((candidate) => candidate !== provider);
      const siblingImport = new RegExp(
        `from\\s+["']\\.\\./(?:${siblingDirectories.join("|")})/`,
      );
      const providerDirectory = resolve(sourceAdaptersDirectory, provider);

      for (const file of readdirSync(providerDirectory, { recursive: true })) {
        if (typeof file !== "string" || !file.endsWith(".ts")) {
          continue;
        }

        const source = readFileSync(resolve(providerDirectory, file), "utf8");
        expect(source, `${provider}/${file}`).not.toMatch(siblingImport);
      }
    }
  });

  it("keeps provider player-chrome modules out of shared overlay runtime", () => {
    const providerChromeImport = /from\s+["'][^"']*source-adapters\/(?:youtube|crunchyroll)\/player-chrome["']/;

    for (const file of sharedOverlayRuntimeFiles) {
      const source = readFileSync(resolve(sourceDirectory, file), "utf8");
      expect(source, file).not.toMatch(providerChromeImport);
    }
  });

  it("does not branch on adapter IDs while mapping player overlay geometry", () => {
    const providerIdComparison = /adapter\.id\s*[!=]==?\s*["'](?:youtube|crunchyroll)["']/;
    const source = readFileSync(resolve(sourceDirectory, "overlay-app.tsx"), "utf8");
    const geometryStart = source.indexOf("const playerBottomInsetPx");
    const geometryEnd = source.indexOf("const liveVoiceActiveSpeakerIds", geometryStart);

    expect(geometryStart).toBeGreaterThanOrEqual(0);
    expect(geometryEnd).toBeGreaterThan(geometryStart);
    expect(source.slice(geometryStart, geometryEnd)).not.toMatch(providerIdComparison);
  });
});

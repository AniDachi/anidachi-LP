import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { HREFLANG_PAIRS, hreflangPairFor, languageAlternates } from "./hreflang";
import { staticPathsToSitemapEntries } from "./sitemap-discovery";

const APP_DIR = path.join(process.cwd(), "app");

function pageFile(urlPath: string): string {
  return path.join(APP_DIR, ...urlPath.split("/").filter(Boolean), "page.tsx");
}

describe("hreflang pairs", () => {
  it("keeps each version's canonical on itself and English as x-default", () => {
    const pair = { en: "/netflix-watch-party", de: "/de/netflix-watchparty" };
    assert.deepEqual(languageAlternates(pair, "de"), {
      canonical: "/de/netflix-watchparty",
      languages: { en: "/netflix-watch-party", de: "/de/netflix-watchparty", "x-default": "/netflix-watch-party" },
    });
    assert.equal(languageAlternates(pair, "en").canonical, "/netflix-watch-party");
  });

  it("points both pages of every pair at each other in their metadata", () => {
    for (const pair of HREFLANG_PAIRS) {
      for (const lang of ["en", "de"] as const) {
        const source = fs.readFileSync(pageFile(pair[lang]), "utf8");
        assert.ok(source.includes("languageAlternates("), `${pair[lang]} does not use languageAlternates`);
        const other = lang === "en" ? pair.de : pair.en;
        assert.ok(source.includes(`"${other}"`), `${pair[lang]} does not name ${other}`);
      }
    }
  });

  it("finds a pair from either language", () => {
    assert.equal(hreflangPairFor("/de/youtube-watchparty")?.en, "/watch-youtube-together");
    assert.equal(hreflangPairFor("/watch-youtube-together")?.de, "/de/youtube-watchparty");
    assert.equal(hreflangPairFor("/about"), undefined);
  });

  it("adds alternates to paired sitemap entries only", () => {
    const [paired, single] = staticPathsToSitemapEntries(
      "https://www.anidachi.app",
      ["/de", "/about"],
      () => null,
    );
    assert.deepEqual(paired.alternates?.languages, {
      en: "https://www.anidachi.app/",
      de: "https://www.anidachi.app/de",
      "x-default": "https://www.anidachi.app/",
    });
    assert.equal(single.alternates, undefined);
  });
});

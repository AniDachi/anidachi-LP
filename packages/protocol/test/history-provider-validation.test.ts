import { describe, expect, it } from "vitest";
import { historyKeyMatchesProvider, historyReadKeyMatchesProvider, historyEpisodeSourceMatches, historyReadReferencesMatchProvider } from "../src/history-provider-validation";

describe("history read provider compatibility", () => {
  it.each(["crunchyroll", "youtube"])("preserves legacy colon namespaces for %s reads", provider => {
    expect(historyReadReferencesMatchProvider(provider, ["season:one", "episode:old", "bare-key", null], ["https://www.crunchyroll.com/watch/ONE"])).toBe(true);
  });
  it.each(["crunchyroll", "youtube"])("does not allow Netflix references to enter %s history", provider => {
    expect(historyReadReferencesMatchProvider(provider, ["netflix:episode:10"], [])).toBe(false);
    expect(historyReadReferencesMatchProvider(provider, ["season:one"], ["https://www.netflix.com/watch/10"])).toBe(false);
  });
  it("rejects foreign qualified provider keys and preserves strict Netflix/catalog keys", () => {
    expect(historyReadReferencesMatchProvider("youtube", ["crunchyroll:episode:ONE"], [])).toBe(false);
    expect(historyReadReferencesMatchProvider("netflix", ["youtube:video:abcdefghijk"], [])).toBe(false);
    expect(historyKeyMatchesProvider("netflix", "season:one", ["season"])).toBe(false);
    expect(historyKeyMatchesProvider("netflix", "netflix:season:20", ["season"])).toBe(true);
    expect(historyKeyMatchesProvider("crunchyroll", "season:one", ["season"])).toBe(false);
    expect(historyReadKeyMatchesProvider("crunchyroll", "season:one", ["season"])).toBe(true);
    expect(historyEpisodeSourceMatches("crunchyroll", { episodeKey: "episode:one", seasonKey: "season:one", sourceUrl: "https://www.crunchyroll.com/watch/ONE" })).toBe(true);
    expect(historyReadKeyMatchesProvider("crunchyroll", "netflix:season:20", ["season"])).toBe(false);
  });
});

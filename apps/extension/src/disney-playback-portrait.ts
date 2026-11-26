const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const portraitEvent = "anidachi:disney-title-portrait";
export const catalogPath = /^\/explore\/v[\d.]+\/(deeplink|page\/entity-[a-f0-9-]+|playerExperience\/[a-f0-9-]+)$/i;

type Artwork = { standard?: { tile?: { "0.67"?: { imageId?: string } } } };
type Visual = { networkAttribution?: { slug?: string } };
type Experience = Visual & { availId?: string; image?: Artwork };
type Action = { type?: string; pageId?: string; availId?: string };
type CatalogData = {
  page?: { id?: string; visuals?: Visual & { artwork?: Artwork } };
  deeplink?: { actions?: Action[] };
  playerExperience?: Experience;
};

function titleId(pageId?: string) {
  if (!pageId?.startsWith("entity-")) return;
  const id = pageId.slice(7);
  return uuid.test(id) ? id : undefined;
}

function portrait(art?: Artwork, visual?: Visual) {
  const image = art?.standard?.tile?.["0.67"]?.imageId;
  if (!image || !uuid.test(image)) return;
  const slug = visual?.networkAttribution?.slug;
  const brand = slug && /^[a-z0-9-]{1,80}$/.test(slug) ? "_" + slug : "";
  return "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/" + image
    + "/compose?format=webp&label=standard_art_vertical" + brand + "_067&width=800";
}

// Pair the two playback responses by Disney's availability ID, even when requests overlap.
export function disneyPlaybackPortraits() {
  const pairs = new Map<string, { id?: string; url?: string }>();
  return (path: string, data: CatalogData) => {
    if (path.startsWith("page/")) {
      const p = data.page;
      const id = titleId(p?.id);
      const url = portrait(p?.visuals?.artwork, p?.visuals);
      return id && url && path === "page/entity-" + id ? { id, url } : undefined;
    }
    let avail: string | undefined;
    let id: string | undefined;
    let url: string | undefined;
    if (path === "deeplink") {
      const actions = data.deeplink?.actions;
      if (!Array.isArray(actions)) return;
      avail = actions.find(action => action.type === "playback")?.availId;
      id = titleId(actions.find(action => action.type === "browse")?.pageId);
      if (!id) return;
    } else {
      const exp = data.playerExperience;
      avail = exp?.availId;
      if (path !== "playerExperience/" + avail) return;
      url = portrait(exp?.image, exp);
      if (!url) return;
    }
    if (!avail || !uuid.test(avail)) return;
    const pair = pairs.get(avail) ?? {};
    if (id) pair.id = id;
    if (url) pair.url = url;
    if (pair.id && pair.url) {
      pairs.delete(avail);
      return { id: pair.id, url: pair.url };
    }
    pairs.set(avail, pair);
    if (pairs.size > 12) pairs.delete(pairs.keys().next().value!);
  };
}

import { disneyCatalogPortrait } from "@anidachi/protocol";

export const DISNEY_PORTRAIT_MESSAGE = "ANIDACHI_DISNEY_CATALOG_PORTRAITS";
const entityPath = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})*\/)?browse\/entity-([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/?$/i;

export function disneyPortraitCard(image: HTMLImageElement) {
  const url = disneyCatalogPortrait(image.currentSrc || image.src);
  if (!url) return null;
  const link = image.closest<HTMLAnchorElement>("a[href]");
  const target = link && URL.parse(link.href);
  const id = target?.origin === "https://www.disneyplus.com" && entityPath.exec(target.pathname)?.[1];
  return id ? { id: id.toLowerCase(), url } : null;
}

export function watchDisneyPortraitCards(doc: Document) {
  if (doc.location?.origin !== "https://www.disneyplus.com" || doc.defaultView?.top !== doc.defaultView) return () => {};
  const observed = new Map<string, string>();
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    timer = undefined;
    const cards = Array.from(pending, ([id, url]) => ({ id, url }));
    pending.clear();
    for (let i = 0; i < cards.length; i += 40) {
      const batch = cards.slice(i, i + 40);
      void chrome.runtime.sendMessage({ type: DISNEY_PORTRAIT_MESSAGE, cards: batch }).catch(() => {
        for (const card of batch) observed.delete(card.id);
      });
    }
  }
  function collect(image: HTMLImageElement) {
    const card = disneyPortraitCard(image);
    if (!card || observed.get(card.id) === card.url) return;
    if (observed.size >= 200) observed.delete(observed.keys().next().value!);
    observed.set(card.id, card.url);
    pending.set(card.id, card.url);
    timer ??= setTimeout(flush, 100);
  }
  const onLoad = (event: Event) => { if (event.target instanceof HTMLImageElement) collect(event.target); };
  const onSelect = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const image = event.target.closest("a[href]")?.querySelector("img");
    const card = image && disneyPortraitCard(image);
    if (card) void chrome.runtime.sendMessage({ type: DISNEY_PORTRAIT_MESSAGE, cards: [card], selected: true }).catch(() => {});
  };
  doc.addEventListener("click", onSelect, true);
  doc.addEventListener("load", onLoad, true);
  for (const image of doc.querySelectorAll<HTMLImageElement>("a[href] img")) collect(image);
  return () => { doc.removeEventListener("click", onSelect, true); doc.removeEventListener("load", onLoad, true); clearTimeout(timer); };
}

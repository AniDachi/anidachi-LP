/**
 * Interface text shared by the marketing templates, per page language.
 * English stays the default; German is the localization pilot (docs/superpowers/plans/2026-11-12-german-localization-pilot.md).
 */
export type PageLocale = "en" | "de";

export interface UiStrings {
  /** Intl locale for numbers and dates. */
  intl: string;
  shortAnswer: string;
  onThisPage: string;
  seeItInAction: string;
  worksOn: string;
  mobileInstallNote: string;
  faqTitle: string;
  faqMore: string;
  faqFewer: string;
  reviewsTitle: string;
  breadcrumb: string;
  joinedSuffix: string;
  bylinePublished: string;
  bylineUpdated: string;
  bylineBy: string;
  bylineEditorialPolicy: string;
  tocContents: string;
  tocAside: string;
}

export const UI_STRINGS: Record<PageLocale, UiStrings> = {
  en: {
    intl: "en-US",
    shortAnswer: "Short answer",
    onThisPage: "On this page",
    seeItInAction: "See It in Action",
    worksOn: "Works on",
    mobileInstallNote:
      "Watch parties run in desktop Chrome. Open the install page on your computer, or copy the link to open it there.",
    faqTitle: "Frequently asked questions",
    faqMore: "More questions",
    faqFewer: "Fewer questions",
    reviewsTitle: "What our users say",
    breadcrumb: "Breadcrumb",
    joinedSuffix: "people have joined AniDachi",
    bylinePublished: "Published",
    bylineUpdated: "Updated",
    bylineBy: "By",
    bylineEditorialPolicy: "Editorial policy",
    tocContents: "Contents",
    tocAside: "Table of contents",
  },
  de: {
    intl: "de-DE",
    shortAnswer: "Kurz gesagt",
    onThisPage: "Auf dieser Seite",
    seeItInAction: "So sieht es aus",
    worksOn: "Funktioniert mit",
    mobileInstallNote:
      "Watchpartys laufen in Chrome auf dem Computer. Öffne den Link am Computer oder kopiere ihn, um ihn dort zu öffnen.",
    faqTitle: "Häufige Fragen",
    faqMore: "Mehr Fragen",
    faqFewer: "Weniger Fragen",
    reviewsTitle: "Das sagen unsere Nutzer",
    breadcrumb: "Brotkrümelnavigation",
    joinedSuffix: "Menschen nutzen AniDachi",
    bylinePublished: "Veröffentlicht am",
    bylineUpdated: "Aktualisiert am",
    bylineBy: "Von",
    bylineEditorialPolicy: "Redaktionelle Richtlinien",
    tocContents: "Inhalt",
    tocAside: "Inhaltsverzeichnis",
  },
};

/** German platform hubs, for "Works with" links on German pages. */
export const DE_PLATFORM_HUBS: Record<string, string> = {
  Netflix: "/de/netflix-watchparty",
  YouTube: "/de/youtube-watchparty",
  Crunchyroll: "/de/crunchyroll-watchparty",
};

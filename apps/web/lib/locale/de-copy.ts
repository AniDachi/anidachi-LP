import { getPlanPolicy } from "@anidachi/protocol";

/**
 * German product facts for the /de pilot pages. Keep them in step with lib/pricing-copy.ts
 * (PRICING_FREE20_SUMMARY) and lib/product-facts.ts whenever the English facts change.
 */
export const DE_FREE_ROOM = getPlanPolicy("free").maxParticipants;
export const DE_PLUS_ROOM = getPlanPolicy("plus").maxParticipants;
export const DE_PRO_ROOM = getPlanPolicy("pro").maxParticipants;

export const DE_PRICING_FREE20_SUMMARY = `Mit Free hast du 20 Minuten am Tag für Räume mit bis zu ${DE_FREE_ROOM} Personen, dich eingeschlossen. Plus und Pro haben kein tägliches Zeitlimit.`;

export const DE_ROOM_SIZES = `bis zu ${DE_FREE_ROOM} Personen mit Free, ${DE_PLUS_ROOM} mit Plus und ${DE_PRO_ROOM} mit Pro (inklusive Gastgeber)`;

export const DE_HERO_FINE_PRINT = "20 Minuten am Tag kostenlos. Freunde treten kostenlos bei.";

export const DE_DESKTOP_ONLY =
  "AniDachi läuft als Erweiterung in Chrome auf dem Computer. Für Handy, Tablet und Smart-TV gibt es keine App.";

export const DE_OG_LOCALE = "de_DE";


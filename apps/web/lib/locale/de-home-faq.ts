import { getPlanPolicy } from "@anidachi/protocol";
import { DE_PRICING_FREE20_SUMMARY } from "@/lib/locale/de-copy";

/**
 * German homepage FAQ for /de, in the same order as lib/home-faq.ts (core product questions
 * first). Keep the facts in step with the English answers in lib/home-faq.ts and lib/pricing-copy.ts.
 */
export const deHomeFAQ = [
  {
    question: "Ist AniDachi kostenlos?",
    answer: `Ja. ${DE_PRICING_FREE20_SUMMARY} Freunde können deinem Raum kostenlos beitreten. Für Free brauchst du keine Kreditkarte.`,
  },
  {
    question: "Wie funktionieren meine kostenlosen Minuten?",
    answer:
      "Deine Minuten laufen, solange du und mindestens ein Gast in deinem Raum seid, auch wenn das Video pausiert ist. Allein warten kostet keine Zeit. Du teilst dir ein Kontingent über alle Räume und Geräte. Es wird jeden Tag um 00:00 UTC zurückgesetzt (in Deutschland um 1 Uhr, im Sommer um 2 Uhr); übrige Minuten verfallen. Wer dem Raum eines anderen beitritt, verbraucht keine eigenen Minuten.",
  },
  {
    question: "Welche Streamingdienste unterstützt AniDachi?",
    answer:
      "Crunchyroll, YouTube und Netflix in Chrome auf dem Computer. AniDachi synchronisiert den Player jeder Person und ergänzt Chat, Reaktionen, Sprach- und Videoanruf. YouTube Shorts, eingebettete Videos und die YouTube-Startseite werden nicht unterstützt.",
  },
  {
    question: "Wie schaue ich mit AniDachi Crunchyroll mit Freunden?",
    answer:
      "Installiere AniDachi in Chrome auf dem Computer und öffne eine Folge auf Crunchyroll. Öffne das AniDachi-Panel, klicke auf „Create room“ und teile den Einladungslink. Deine Freunde brauchen die Erweiterung und eigenen Zugriff auf die Folge.",
  },
  {
    question: "Brauchen alle meine Freunde ein AniDachi-Abo?",
    answer:
      "Nein. Freunde treten deinem Raum kostenlos bei. Dein Plan bestimmt die Raumgröße. Jeder braucht die Erweiterung und eigenen Zugriff auf das Video. Den eigenen Schaufortschritt speichern kann nur, wer selbst Plus oder Pro hat.",
  },
  {
    question: "Was ist der Unterschied zwischen Plus und Pro?",
    answer: `Plus erlaubt bis zu ${getPlanPolicy("plus").maxParticipants} Personen, Pro bis zu ${getPlanPolicy("pro").maxParticipants}, jeweils inklusive Gastgeber. Beide haben kein tägliches Zeitlimit und speichern deinen persönlichen Schauverlauf. Pro hat außerdem mehr Mikrofone und bevorzugten Support. Beide gibt es monatlich oder jährlich.`,
  },
  {
    question: "Kann ich mit AniDachi YouTube zusammen schauen?",
    answer:
      "Ja. Öffne ein Video auf youtube.com/watch in Chrome auf dem Computer. Ein Gastgeber mit Free, Plus oder Pro erstellt den Raum und teilt den Link; Freunde treten kostenlos bei und schauen im eigenen YouTube-Player. Shorts, eingebettete Videos und die Handy-Apps werden nicht unterstützt.",
  },
  {
    question: "Kann man Anime mit Freunden auch zeitversetzt schauen?",
    answer:
      "Noch nicht. AniDachi unterstützt derzeit Live-Räume, in denen ihr gleichzeitig schaut und chattet. Zeitversetztes Nachholen kommt bald.",
  },
  {
    question: "Brauchen alle meine Freunde ein Crunchyroll-Konto?",
    answer:
      "Für Anime auf Crunchyroll braucht jeder ein eigenes Crunchyroll-Konto. Bei YouTube nutzt jeder seine eigene YouTube-Sitzung. Bei Netflix braucht jeder eigenen Zugriff auf denselben Titel. AniDachi kümmert sich um Synchronisation, Raum und Chat.",
  },
  {
    question: "Hat Crunchyroll eine eingebaute Watchparty-Funktion?",
    answer:
      "Nein. Crunchyroll bietet keine eigene Funktion zum gemeinsamen Schauen. AniDachi füllt diese Lücke mit einer Chrome-Erweiterung, die die Wiedergabe synchronisiert, den Anime automatisch erkennt und einen Live-Chat zu deinem Crunchyroll-Konto hinzufügt.",
  },
  {
    question: "Was unterscheidet AniDachi von Teleparty oder Crunchyroll Party?",
    answer:
      "AniDachi synchronisiert den Player jeder Person auf Crunchyroll, YouTube und Netflix. Chat, Reaktionen, Sprach- und Videoanruf liegen direkt auf dem Video. Plus und Pro speichern außerdem deinen persönlichen Schaufortschritt.",
  },
  {
    question: "Funktioniert AniDachi auf dem Handy?",
    answer:
      "Auf der Webseite kannst du am Handy dein Konto und deinen gespeicherten Schauverlauf verwalten. Für Live-Räume brauchst du Chrome auf dem Computer mit der AniDachi-Erweiterung.",
  },
];

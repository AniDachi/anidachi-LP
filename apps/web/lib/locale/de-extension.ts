import { DE_PRICING_FREE20_SUMMARY } from "@/lib/locale/de-copy";

/**
 * German text for the install page (/de/erweiterung). Same order as lib/extension-using-guide.ts
 * and lib/extension-install-faq.ts; keep the facts in step with those files. Button and menu names
 * from the extension are quoted exactly as they appear in it.
 */
export const deExtensionUsingSteps = [
  {
    name: "Kapsel öffnen",
    text: "Klicke auf die Kapsel oben rechts im Player, um die Raum-Steuerung zu öffnen.",
  },
  {
    name: "Raum erstellen",
    text: `Wähle „Create room“, um deinen Raum zu starten. ${DE_PRICING_FREE20_SUMMARY}`,
  },
  {
    name: "Freunde einladen",
    text: "Klicke auf „Invite friends“, um „Friends & groups“ zu öffnen, und wähle „Invite“ neben einem Freund oder einer Gruppe. Oder kopiere den Raum-Link und teile ihn.",
  },
  {
    name: "Mikrofon- und Kameraplätze",
    text: "Unter „People“ steuert der Gastgeber mit dem runden Knopf, wer Mikrofon und Kamera nutzen darf: weiß heißt an, grau heißt aus. Gäste ohne Freigabe können trotzdem zuhören und chatten. Bis zu vier Kameras können gleichzeitig an sein.",
  },
  {
    name: "Reaktionen",
    text: "Schalte unter „Settings → Reactions“ die „Quick reactions“ ein. Drücke 1–9 oder 0, um das passende Emoji zu senden. Klicke auf ein Emoji, um es zu ändern.",
  },
  {
    name: "Nachricht senden",
    text: "Drücke beim Schauen Enter, um das Nachrichtenfeld zu öffnen. Schreib deine Nachricht und drücke noch einmal Enter, um sie zu senden.",
  },
  {
    name: "Layout",
    text: "Zieh unter „Settings → Layout“ die Kameras und den Chat dorthin, wo du sie haben willst. Pass die Größe an und wähle „Apply“, um dein Layout zu speichern.",
  },
  {
    name: "Mikrofon und Kamera",
    text: "Halte V gedrückt, um zu sprechen. Klicke auf das Mikrofon, damit es an bleibt; ein weiterer Klick schaltet zurück. Klicke auf die Kamera, um Video an- oder auszuschalten. Diese Beispiele nutzen nie dein Mikrofon oder deine Kamera.",
  },
  {
    name: "Oberfläche",
    text: "Lege unter „Settings → Interface“ fest, wann die Steuerung erscheint. „Auto hide“ zeigt die Kapsel, wenn du in die Nähe des Player-Rands kommst. „Smart“ zeigt die Teilnehmer, wenn jemand spricht oder du über den Rand fährst.",
  },
  {
    name: "Raum",
    text: "Lege unter „Settings → Room“ fest, wie Mikrofon und Kamera starten. Mit „Last used“ merkt sich AniDachi deine letzte Wahl, oder du wählst einen festen Modus.",
  },
] as const;

export const deExtensionInstallFaq = [
  {
    question: "Wo kann ich AniDachi installieren?",
    answer:
      "Installiere AniDachi über den offiziellen Eintrag im Chrome Web Store, der auf dieser Seite verlinkt ist. Installiere AniDachi nicht von anderen Seiten.",
  },
  {
    question: "Wie schließe ich die Einrichtung nach der Installation ab?",
    answer:
      "Hefte AniDachi über das Erweiterungsmenü in Chrome an. Öffne ein Video auf Crunchyroll, YouTube oder Netflix, klicke auf die AniDachi-Kapsel und melde dich an. Erstelle einen Raum oder öffne den Einladungslink eines Freundes, um beizutreten.",
  },
  {
    question: "Wie bestätige ich die Installation in Chrome?",
    answer:
      "Chrome zeigt beim Hinzufügen einer neuen Erweiterung eventuell eine Bestätigung. Prüfe die angefragten Berechtigungen und wähle „Erweiterung hinzufügen“.",
  },
  {
    question: "Welche Browser funktionieren?",
    answer:
      "Google Chrome ab Version 121 auf dem Computer und Microsoft Edge (Chromium). Safari, Firefox, Chrome auf iOS und Android sowie die Apps von YouTube, Crunchyroll und Netflix können die Erweiterung nicht laden.",
  },
  {
    question: "Aktualisiert sich die Erweiterung selbst?",
    answer:
      "Installationen aus dem Chrome Web Store werden automatisch aktualisiert. Lade nach einem Update geöffnete Videos auf YouTube, Crunchyroll oder Netflix bei Bedarf neu. Dein AniDachi-Konto bleibt dasselbe.",
  },
  {
    question: "Welche Berechtigungen fragt AniDachi an?",
    answer:
      "AniDachi läuft auf YouTube, Crunchyroll und Netflix und verbindet sich mit den eigenen Diensten. Es fragt keinen Zugriff auf alle Webseiten an. Die vollständige Liste der Berechtigungen steht auf der Security-Seite.",
  },
];

export const deExtensionHowToSteps = [
  {
    name: "Erweiterung hinzufügen",
    text: "Wähle im Chrome Web Store „Hinzufügen“ und dann „Erweiterung hinzufügen“.",
  },
  {
    name: "AniDachi anheften",
    text: "Öffne das Puzzle-Symbol in der Chrome-Symbolleiste, such AniDachi und klicke auf die Stecknadel.",
  },
  {
    name: "Video öffnen und anmelden",
    text: "Öffne ein unterstütztes Video, klicke im Player auf die AniDachi-Kapsel und melde dich an.",
  },
];

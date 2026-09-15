export const extensionInstallFaq = [
  {
    question: "Why isn’t AniDachi on the Chrome Web Store yet?",
    answer:
      "Chrome reviews every new listing before it goes live, including a publisher verification step. AniDachi is in that queue — it often takes a couple of weeks. Until Chrome publishes the Store page, download the official zip from anidachi.app/extension and load it unpacked. Do not install AniDachi from any other site.",
  },
  {
    question: "Is it safe to turn on Developer mode?",
    answer:
      "Chrome requires Developer mode for any extension that is not in the Store. The toggle is in the top-right of chrome://extensions, to the right of the search bar. You are only enabling it so Chrome can load AniDachi from a folder you downloaded from this site. Keep it on while you use this zip, or Chrome will disable the extension.",
  },
  {
    question: "Chrome asked me to disable developer extensions. What do I do?",
    answer:
      "Click Cancel. Chrome shows that warning on restart for unpacked extensions. It goes away once AniDachi is installed from the Chrome Web Store. If you click Disable, you will need to Load unpacked again.",
  },
  {
    question: "Which browsers work?",
    answer:
      "Desktop Google Chrome 121 or newer, and Chromium Microsoft Edge. Safari, Firefox, Chrome on iOS/Android, and YouTube/Crunchyroll mobile apps cannot load this extension.",
  },
  {
    question: "Will the extension update itself?",
    answer:
      "Not while it is loaded unpacked. Chrome Web Store updates are not available yet. Check /extension or Discord when we publish a new zip, then Load unpacked again on the new folder. Your AniDachi account stays the same.",
  },
  {
    question: "What permissions does AniDachi ask for?",
    answer:
      "Narrow hosts only: YouTube, Crunchyroll, AniDachi, and our API. The zip does not request access to every website. See /security for the full permission list.",
  },
];

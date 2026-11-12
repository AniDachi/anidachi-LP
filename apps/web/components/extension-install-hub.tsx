"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Chrome,
  Copy,
  Download,
  EllipsisVertical,
  Pin,
  Puzzle,
  SquarePlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FAQSection } from "@/components/faq-section";
import { trackConversion } from "@/lib/conversion-events";
import {
  formatZipBytes,
  type PublicExtensionArtifact,
} from "@/lib/extension-artifact";
import { extensionInstallFaq } from "@/lib/extension-install-faq";
import { deExtensionInstallFaq } from "@/lib/locale/de-extension";
import type { PageLocale } from "@/lib/locale/ui-strings";
import {
  CHROME_EXTENSIONS_PAGE,
  CHROME_WEB_STORE_URL,
  CHROME_WEB_STORE_URL_DE,
  DE_INSTALL_HUB_PATH,
  EXTENSION_DOWNLOAD_PATH,
  EXTENSION_INSTALL_MODE,
  INSTALL_HUB_PATH,
  INSTALL_ZIP_CTA_LABEL,
  isSafeInstallNextPath,
} from "@/lib/install-cta";
import { InstallStep, OverlayUsingGuide } from "@/components/overlay-using-guide";
import { WatchPlatformLinks } from "@/components/watch-platform-links";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";
import { isMobileInstallDevice } from "@/lib/mobile-install";
import { InstallLink } from "@/components/install-link";
import { shareOrCopyUrl } from "@/lib/use-mobile-device";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { InstallPlatformMarks } from "./install-platform-marks";
import styles from "./extension-install.module.css";
import { ExtensionWelcomeHero } from "./extension-welcome-hero";
import type { ExtensionWelcome } from "@/lib/extension-welcome";

type BrowserKind = "chrome" | "edge" | "other";

function detectBrowser(ua: string): BrowserKind {
  if (/Edg\//i.test(ua)) return "edge";
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return "chrome";
  return "other";
}

function ChromeExtensionsMock({
  highlight,
}: {
  highlight: "developer" | "load";
}) {
  const on =
    "rounded-md border border-ani-control-border bg-ani-selected-quiet text-ani-text";
  const off = "rounded-md border border-transparent text-ani-muted";

  return (
    <div
      className="overflow-hidden rounded-xl border border-ani-line bg-ani-canvas text-left"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 border-b border-ani-line bg-ani-panel px-3 py-2">
        <span className="shrink-0 text-xs font-semibold text-ani-text">
          Extensions
        </span>
        <span className="hidden min-w-0 flex-1 truncate rounded-full border border-ani-line px-3 py-1 text-[11px] text-ani-muted sm:block">
          Search extensions
        </span>
        <span
          className={`ml-auto flex shrink-0 items-center gap-2 px-1.5 py-1 text-[11px] font-semibold ${
            highlight === "developer" ? on : off
          }`}
        >
          Developer mode
          <span className="relative h-4 w-7 rounded-full bg-[#8ab4f8]">
            <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-[#202124]" />
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2 px-3 py-3">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            highlight === "load"
              ? "border-ani-control-border bg-ani-selected-quiet text-ani-text"
              : "border-ani-line text-ani-muted"
          }`}
        >
          Load unpacked
        </span>
        <span className="inline-flex rounded-full border border-ani-line px-2.5 py-1 text-[11px] text-ani-muted">
          Pack extension
        </span>
        <span className="inline-flex rounded-full border border-ani-line px-2.5 py-1 text-[11px] text-ani-muted">
          Update
        </span>
      </div>
    </div>
  );
}

function ChromePinMock() {
  return (
    <div
      className="max-w-sm overflow-hidden rounded-xl border border-ani-line bg-ani-panel text-left"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <AnidachiLogo size={22} aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-medium text-ani-text">
          Anidachi
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ani-control-border bg-ani-selected-quiet">
          <Pin className="h-4 w-4 text-ani-text" />
        </span>
        <span className="flex h-8 w-8 items-center justify-center text-ani-muted">
          <EllipsisVertical className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

/** German text for /de/erweiterung (Chrome Web Store mode). The sideload path stays English. */
const COPY = {
  en: {
    titleMobile: "Watch together on desktop",
    title: "Add AniDachi to Chrome",
    mobileNote: "Open this page in Chrome on your computer to install AniDachi.",
    buttonMobile: "Install AniDachi",
    button: "Add to Chrome",
    browserNote: "Use desktop Chrome or Edge to install the extension.",
    platformsLabel: "Watch together on these platforms",
    linkShared: "Install link shared",
    linkCopied: "Install link copied",
    returnLabel: "Return to your invitation",
    returnText: "Already installed? Your invitation is ready.",
    returnLink: "Open the watchroom",
    setupLabel: "Install AniDachi",
    setup: [
      ["Install", "Add AniDachi to Chrome."],
      ["Pin", "Pin it from the Extensions menu."],
      ["Open a video", "Open AniDachi and sign in."],
    ],
    faqTitle: "Questions",
  },
  de: {
    titleMobile: "Zusammen schauen am Computer",
    title: "AniDachi zu Chrome hinzufügen",
    mobileNote: "Öffne diese Seite in Chrome auf deinem Computer, um AniDachi zu installieren.",
    buttonMobile: "AniDachi installieren",
    button: "Zu Chrome hinzufügen",
    browserNote: "Nutze Chrome oder Edge auf dem Computer, um die Erweiterung zu installieren.",
    platformsLabel: "Auf diesen Diensten zusammen schauen",
    linkShared: "Installationslink geteilt",
    linkCopied: "Installationslink kopiert",
    returnLabel: "Zurück zu deiner Einladung",
    returnText: "Schon installiert? Deine Einladung wartet.",
    returnLink: "Raum öffnen",
    setupLabel: "AniDachi installieren",
    setup: [
      ["Installieren", "Füge AniDachi zu Chrome hinzu."],
      ["Anheften", "Hefte es über das Erweiterungsmenü an."],
      ["Video öffnen", "Öffne AniDachi und melde dich an."],
    ],
    faqTitle: "Fragen",
  },
} as const;

export function ExtensionInstallHub({
  artifact,
  welcome,
  extensionId,
  locale = "en",
}: {
  artifact: PublicExtensionArtifact;
  welcome?: ExtensionWelcome;
  extensionId?: string | null;
  /** German text on /de/erweiterung; the post-install welcome flow stays on /extension. */
  locale?: PageLocale;
}) {
  const de = locale === "de";
  const copy = COPY[locale];
  const hubPath = de ? DE_INSTALL_HUB_PATH : INSTALL_HUB_PATH;
  const hubTemplate = de ? "de_pilot" : "install";
  const searchParams = useSearchParams();
  const nextPath = isSafeInstallNextPath(searchParams.get("next"));
  const [isMobile, setIsMobile] = useState(false);
  const [browser, setBrowser] = useState<BrowserKind>("chrome");
  const [copiedChrome, setCopiedChrome] = useState(false);
  const [linkStatus, setLinkStatus] = useState<"idle" | "copied" | "shared">("idle");

  const sizeLabel = formatZipBytes(artifact.bytes);

  const desktopInstallUrl = useMemo(() => {
    if (typeof window === "undefined") return hubPath;
    return window.location.href;
  }, [hubPath]);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(isMobileInstallDevice(navigator));
    setBrowser(detectBrowser(ua));
  }, []);

  useEffect(() => {
    trackConversion("install_hub_view", {
      page_path: hubPath,
      page_template: hubTemplate,
      placement: "install_hub",
      cta_variant: "install_hub",
      zip_available: artifact.available,
    });
  }, [artifact.available, hubPath, hubTemplate]);

  async function copyChromeExtensions() {
    try {
      await navigator.clipboard.writeText(CHROME_EXTENSIONS_PAGE);
      setCopiedChrome(true);
      window.setTimeout(() => setCopiedChrome(false), 1600);
    } catch {
      setCopiedChrome(false);
    }
  }

  async function copyDesktopLink() {
    try {
      const result = await shareOrCopyUrl(desktopInstallUrl, {
        title: "Install AniDachi",
        text: "Open this on desktop Chrome to install AniDachi",
      });
      setLinkStatus(result === "shared" ? "shared" : "copied");
      trackConversion("desktop_install_link_copied", {
        page_path: hubPath,
        page_template: hubTemplate,
        placement: "install_hub_mobile",
        cta_variant: result,
      });
    } catch {
      setLinkStatus("idle");
    }
  }

  function onDownloadClick(event: MouseEvent<HTMLAnchorElement>) {
    const insertId = crypto.randomUUID();
    const url = new URL(event.currentTarget.href, window.location.origin);
    url.searchParams.set("iid", insertId);

    trackConversion("extension_zip_download", {
      page_path: INSTALL_HUB_PATH,
      page_template: "install",
      placement: "install_hub",
      cta_variant: "zip_button",
      extension_version: artifact.version,
      insert_id: insertId,
    });
    trackConversion("install_step_viewed", {
      page_path: INSTALL_HUB_PATH,
      page_template: "install",
      placement: "install_hub",
      cta_variant: "download",
      install_step: 1,
    });

    const newTab =
      event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
    if (newTab) {
      event.currentTarget.href = url.toString();
      return;
    }

    event.preventDefault();
    const flush = import("@/lib/amplitude")
      .then(async (amp) => {
        await amp.trackAmplitudeEvent("extension_zip_download", {
          page_path: INSTALL_HUB_PATH,
          page_template: "install",
          placement: "install_hub",
          cta_variant: "zip_button",
          extension_version: artifact.version,
          insert_id: insertId,
        });
        await amp.flushAmplitude();
      })
      .catch(() => {});
    void Promise.race([
      flush,
      new Promise((resolve) => window.setTimeout(resolve, 400)),
    ]).finally(() => {
      window.location.assign(url.toString());
    });
  }

  function onStoreClick() {
    trackConversion("cta_click", {
      page_path: hubPath,
      page_template: hubTemplate,
      placement: "install_hub",
      cta_variant: "chrome_web_store",
    });
  }

  return (
    <div className={styles.hub}>
      {welcome ? <ExtensionWelcomeHero welcome={welcome} extensionId={extensionId} /> : <section className={styles.hero} aria-labelledby="install-title">
        <div className={styles.brand}>
          <AnidachiLogo size={44} priority aria-hidden />
          <span>AniDachi</span>
        </div>
        <h1 id="install-title" className={styles.title}>
          {isMobile ? copy.titleMobile : copy.title}
        </h1>
        {isMobile ? (
          <p className={styles.mobileNote}>
            {copy.mobileNote}
          </p>
        ) : null}
        <div className={styles.action}>
          {EXTENSION_INSTALL_MODE === "cws" ? (
            <Button asChild size="control" variant="cream" className={styles.installButton}>
              <InstallLink href={de ? CHROME_WEB_STORE_URL_DE : CHROME_WEB_STORE_URL} shareHref={desktopInstallUrl} storePlacement="install_hub" target="_blank" rel="noopener noreferrer" onClick={onStoreClick}>
                <Chrome className="size-6" aria-hidden="true" />
                {isMobile ? copy.buttonMobile : copy.button}
                <span className="sr-only"> — Chrome Web Store</span>
              </InstallLink>
            </Button>
          ) : isMobile ? (
            <Button type="button" size="control" variant="cream"
              className={styles.installButton} onClick={() => void copyDesktopLink()}>
              <Copy className="size-5" aria-hidden="true" />
              {linkStatus === "shared" ? "Shared" : linkStatus === "copied"
                ? "Link copied" : "Copy desktop install link"}
            </Button>
          ) : artifact.available ? (
            <Button asChild size="control" variant="cream" className={styles.installButton}>
              <a href={EXTENSION_DOWNLOAD_PATH} onClick={onDownloadClick}>
                <Download className="size-5" aria-hidden="true" />{INSTALL_ZIP_CTA_LABEL}
              </a>
            </Button>
          ) : (
            <Button size="control" variant="creamOutline" disabled>Zip publishing shortly</Button>
          )}
          {!isMobile && EXTENSION_INSTALL_MODE !== "cws" ? (
            <p className="mt-3 text-sm text-ani-muted">v{artifact.version}{sizeLabel ? ` · ${sizeLabel}` : ""}</p>
          ) : null}
        </div>
        {!isMobile && browser === "other" ? (
          <p className={styles.browserNote}>{copy.browserNote}</p>
        ) : null}
        <InstallPlatformMarks label={copy.platformsLabel} />
        <span className="sr-only" role="status" aria-live="polite">
          {linkStatus === "shared" ? copy.linkShared : linkStatus === "copied" ? copy.linkCopied : ""}
        </span>
      </section>}

      {nextPath && !isMobile ? (
        <aside className={styles.returnNotice} aria-label={copy.returnLabel}>
          <p>{copy.returnText}</p>
          <Link href={nextPath}>{copy.returnLink} <span aria-hidden="true">→</span></Link>
        </aside>
      ) : null}

      {EXTENSION_INSTALL_MODE === "cws" ? (
        <OverlayUsingGuide
          locale={locale}
          setup={welcome ? undefined : <>
            <ol className={styles.setupSteps} aria-label={copy.setupLabel}>
              {[Puzzle, Pin, SquarePlay].map((Icon, i) => (
                <li key={copy.setup[i][0]}>
                  <Icon className={styles.setupIcon} strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <h3>{copy.setup[i][0]}</h3>
                    <p>{copy.setup[i][1]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>}
        />
      ) : (
      <ol className="mt-10 space-y-6">
        <InstallStep n={1} title="Download the zip">
          <p className="mt-1 text-sm text-ani-muted">Use the button above.</p>
        </InstallStep>
        <InstallStep n={2} title="Unzip it">
          <p className="mt-1 text-sm text-ani-muted">
            Unzip the downloaded ZIP file.
          </p>
        </InstallStep>
        <InstallStep n={3} title="Open Chrome extensions">
          <p className="mt-1 text-sm text-ani-muted">Copy this address, paste it into Chrome’s address bar, then press Enter.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-full border border-ani-line px-4 py-2 text-sm text-ani-text">{CHROME_EXTENSIONS_PAGE}</code>
            <Button
              type="button"
              size="control"
              variant="creamQuiet"
              onClick={() => void copyChromeExtensions()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copiedChrome ? "Copied" : "Copy link"}
            </Button>
          </div>
        </InstallStep>
        <InstallStep n={4} title="Turn on Developer mode">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            On the Extensions page, look at the{" "}
            <span className="text-ani-text">top-right</span>, to the right of
            the search bar. Flip the{" "}
            <span className="text-ani-text">Developer mode</span> toggle on. It
            turns blue.
          </p>
          <div className="mt-3">
            <ChromeExtensionsMock highlight="developer" />
          </div>
        </InstallStep>
        <InstallStep n={5} title="Load unpacked">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Click <span className="text-ani-text">Load unpacked</span> and select
            the unzipped AniDachi folder.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ani-muted">
            The selected folder should contain{" "}
            <code className="text-ani-text">manifest.json</code>.
          </p>
          <div className="mt-3">
            <ChromeExtensionsMock highlight="load" />
          </div>
        </InstallStep>
        <InstallStep n={6} title="Pin, then watch">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Click the puzzle-piece icon in Chrome&apos;s toolbar (top-right, next
            to your profile). Find AniDachi in the list. Click the{" "}
            <span className="text-ani-text">pin</span> on the right of that row
            — it fills in when it is pinned. Then open Crunchyroll, YouTube, or Netflix
            and sign in when AniDachi asks.
            {nextPath ? " Then return to your watchroom invite." : ""}
          </p>
          <div className="mt-3">
            <ChromePinMock />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextPath ? (
              <Button asChild size="control" variant="cream">
                <Link href={nextPath}>Open the watchroom</Link>
              </Button>
            ) : null}
            <WatchPlatformLinks />
          </div>
          <p className="mt-3 text-sm">
            <a
              href={`#${EXTENSION_USING_HASH}`}
              className="text-ani-muted underline-offset-4 hover:text-ani-text hover:underline"
            >
              Then: How to Watch Together
            </a>
          </p>
        </InstallStep>
      </ol>
      )}

      {EXTENSION_INSTALL_MODE !== "cws" ? <OverlayUsingGuide locale={locale} /> : null}

      <FAQSection
        title={copy.faqTitle}
        questions={de ? deExtensionInstallFaq : extensionInstallFaq}
        moreLabel={de ? "Mehr Fragen" : undefined}
        fewerLabel={de ? "Weniger Fragen" : undefined}
        compact
      />
    </div>
  );
}

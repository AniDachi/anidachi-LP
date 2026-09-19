"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Chrome,
  Copy,
  Download,
  EllipsisVertical,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FAQSection } from "@/components/faq-section";
import { trackConversion } from "@/lib/conversion-events";
import {
  formatZipBytes,
  type PublicExtensionArtifact,
} from "@/lib/extension-artifact";
import { extensionInstallFaq } from "@/lib/extension-install-faq";
import {
  CHROME_EXTENSIONS_PAGE,
  CWS_PENDING_LINE,
  EXTENSION_DOWNLOAD_PATH,
  INSTALL_HUB_PATH,
  INSTALL_ZIP_CTA_LABEL,
  isSafeInstallNextPath,
} from "@/lib/install-cta";
import {
  OverlayBubbleMock,
  OverlayCreateRoomMock,
  OverlayInterfaceMock,
  OverlayInviteMock,
  OverlayLayoutMock,
  OverlayMessageMock,
  OverlayReactionsMock,
  OverlayRoomMock,
  OverlaySeatsMock,
  OverlayVoiceMock,
} from "@/components/overlay-using-mocks";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";
import { isMobileUserAgent } from "@/lib/mobile-user-agent";
import { shareOrCopyUrl } from "@/lib/use-mobile-device";
import { AnidachiLogo } from "@/components/anidachi-logo";

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

function InstallStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-4">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-ani-line bg-ani-hover font-mono text-sm font-semibold text-ani-text">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-ani-text">
          {title}
        </h2>
        {children}
      </div>
    </li>
  );
}

function OverlayUsingGuide() {
  return (
    <section id={EXTENSION_USING_HASH} className="scroll-mt-24 pt-12">
      <h2 className="text-balance text-4xl font-semibold tracking-[-0.035em] text-ani-text md:text-[2.75rem] md:leading-[1.08]">
        How to Watch Together
      </h2>
      <p className="mt-3 text-sm text-ani-muted">
        Live sync on Crunchyroll or YouTube. Try the settings below — changes stay in these examples.
      </p>
      <ol className="mt-6 space-y-8">
        <InstallStep n={1} title="Open the bubble">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            On a Crunchyroll title or a full YouTube watch page, look at the{" "}
            <span className="text-ani-text">top-right of the player</span>. Click
            the AniDachi bubble — logo, green dot, and a number.
          </p>
          <div className="mt-3">
            <OverlayBubbleMock />
          </div>
        </InstallStep>
        <InstallStep n={2} title="Create a room">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            AniDachi detects the title. Click{" "}
            <span className="text-ani-text">Create room</span> — the orange
            button under your name. After the room starts, click the{" "}
            <span className="text-ani-text">copy</span> icon next to End room
            and send that invite. Friends open it on their own player.
          </p>
          <div className="mt-3">
            <OverlayCreateRoomMock />
          </div>
        </InstallStep>
        <InstallStep n={3} title="Invite a friend">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Next to End room, click the{" "}
            <span className="text-ani-text">person-plus</span> icon.{" "}
            <span className="text-ani-text">Friends & groups</span> opens —
            tap <span className="text-ani-text">Invite</span> on a friend or a
            group. Copy invite still works for one-off links.
          </p>
          <div className="mt-3">
            <OverlayInviteMock />
          </div>
        </InstallStep>
        <InstallStep n={4} title="Media seats">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            In <span className="text-ani-text">People</span>, hosts tap the
            round <span className="text-ani-text">radio</span> button on a
            person. <span className="text-ani-text">White</span> means they have
            a media seat for microphone and camera access. Grey means listening
            and chat only. Tap to give or take a seat. Up to four cameras
            can be on at once.
          </p>
          <div className="mt-3">
            <OverlaySeatsMock />
          </div>
        </InstallStep>
        <InstallStep n={5} title="Reactions">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Reactions</span>.
            Turn <span className="text-ani-text">Quick reactions</span> on.
            Keys <span className="text-ani-text">1–0</span> each map to an
            emoji — click a slot to change it. In a room, press that number to
            send it.
          </p>
          <div className="mt-3">
            <OverlayReactionsMock />
          </div>
        </InstallStep>
        <InstallStep n={6} title="Send a message">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            While watching in a room, press <kbd className="font-semibold text-ani-text">Enter</kbd>{" "}
            to open the message field. Type your message, then press{" "}
            <kbd className="font-semibold text-ani-text">Enter</kbd> again to send it.
          </p>
          <div className="mt-3"><OverlayMessageMock /></div>
        </InstallStep>
        <InstallStep n={7} title="Layout">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Layout</span>.
            Drag cameras or chat in the preview to reposition them. Under{" "}
            <span className="text-ani-text">Video</span>, enlarge{" "}
            <span className="text-ani-text">Camera size</span>, then{" "}
            <span className="text-ani-text">Apply</span>.
          </p>
          <div className="mt-3">
            <OverlayLayoutMock />
          </div>
        </InstallStep>
        <InstallStep n={8} title="Voice">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Voice</span>. Leave{" "}
            <span className="text-ani-text">Push to talk</span> selected on the
            left. Hold <span className="text-ani-text">V</span> to speak. Use
            Open mic only if you want the mic live without holding a key.
          </p>
          <div className="mt-3">
            <OverlayVoiceMock />
          </div>
        </InstallStep>
        <InstallStep n={9} title="Interface">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Interface</span>.{" "}
            Both controls are visible by default. Choose{" "}
            <span className="text-ani-text">Auto hide</span> to reveal the main
            control near the player edge, or <span className="text-ani-text">Smart</span>{" "}
            for participant pills that appear when someone speaks or you hover
            the edge. Try the options below the preview.
          </p>
          <div className="mt-3">
            <OverlayInterfaceMock />
          </div>
        </InstallStep>
        <InstallStep n={10} title="Room">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Room</span>.{" "}
            <span className="text-ani-text">Room defaults</span> are your
            starting mic and camera for every room. Microphone: Last used, Push
            to talk, or Open mic. Camera: Last used, Off, or On.
          </p>
          <div className="mt-3">
            <OverlayRoomMock />
          </div>
        </InstallStep>
      </ol>
    </section>
  );
}

export function ExtensionInstallHub({
  artifact,
}: {
  artifact: PublicExtensionArtifact;
}) {
  const searchParams = useSearchParams();
  const nextPath = isSafeInstallNextPath(searchParams.get("next"));
  const [isMobile, setIsMobile] = useState(false);
  const [browser, setBrowser] = useState<BrowserKind>("chrome");
  const [copiedChrome, setCopiedChrome] = useState(false);
  const [linkStatus, setLinkStatus] = useState<"idle" | "copied" | "shared">("idle");

  const sizeLabel = formatZipBytes(artifact.bytes);

  const desktopInstallUrl = useMemo(() => {
    if (typeof window === "undefined") return INSTALL_HUB_PATH;
    return window.location.href;
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(isMobileUserAgent(ua));
    setBrowser(detectBrowser(ua));
  }, []);

  useEffect(() => {
    trackConversion("install_hub_view", {
      page_path: INSTALL_HUB_PATH,
      page_template: "install",
      placement: "install_hub",
      cta_variant: "install_hub",
      zip_available: artifact.available,
    });
  }, [artifact.available]);

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
        page_path: INSTALL_HUB_PATH,
        page_template: "install",
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

  if (isMobile) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <AnidachiLogo size={36} priority aria-hidden />
          <p className="text-lg font-semibold tracking-[-0.04em] text-ani-text">
            AniDachi
          </p>
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] text-ani-text">
          Install AniDachi on desktop Chrome
        </h1>
        <p className="mt-4 text-pretty text-ani-muted">
          Watch parties need desktop Chrome. Copy this page and open it on your
          computer.
        </p>
        <p className="mt-2 text-sm text-ani-muted">{CWS_PENDING_LINE}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            type="button"
            size="control"
            variant="cream"
            onClick={() => void copyDesktopLink()}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {linkStatus === "shared"
              ? "Shared"
              : linkStatus === "copied"
                ? "Link copied"
                : "Copy desktop install link"}
          </Button>
        </div>
        <OverlayUsingGuide />
      </div>
    );
  }

  const showBrowserNote = browser === "other";

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <AnidachiLogo size={36} priority aria-hidden />
        <p className="text-lg font-semibold tracking-[-0.04em] text-ani-text">
          AniDachi
        </p>
      </div>
      <h1 className="text-balance text-4xl font-semibold tracking-[-0.035em] text-ani-text md:text-[2.75rem] md:leading-[1.08]">
        Install AniDachi on Chrome
      </h1>
      <p className="mt-3 text-sm text-ani-muted">{CWS_PENDING_LINE}</p>

      {showBrowserNote ? (
        <p className="mt-4 rounded-[12px] border border-ani-line bg-ani-panel px-4 py-3 text-sm text-ani-text">
          Open this page in desktop Chrome or Edge.
        </p>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        {artifact.available ? (
          <Button asChild size="control" variant="cream">
            <a href={EXTENSION_DOWNLOAD_PATH} onClick={onDownloadClick}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {INSTALL_ZIP_CTA_LABEL}
            </a>
          </Button>
        ) : (
          <Button size="control" variant="creamOutline" disabled>
            Zip publishing shortly
          </Button>
        )}
        <p className="text-sm text-ani-muted">
          v{artifact.version}
          {sizeLabel ? ` · ${sizeLabel}` : ""}
        </p>
      </div>

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
            — it fills in when it is pinned. Then open Crunchyroll or YouTube
            and sign in when AniDachi asks.
            {nextPath ? " Then return to your watchroom invite." : ""}
          </p>
          <div className="mt-3">
            <ChromePinMock />
          </div>
          {nextPath ? (
            <Button asChild size="control" variant="cream" className="mt-3">
              <Link href={nextPath}>Open the watchroom</Link>
            </Button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="creamOutline" size="control">
                <a href="https://www.crunchyroll.com" rel="noopener noreferrer">
                  <Chrome className="h-4 w-4" aria-hidden="true" />
                  Crunchyroll
                </a>
              </Button>
              <Button asChild variant="creamOutline" size="control">
                <a href="https://www.youtube.com" rel="noopener noreferrer">
                  YouTube
                </a>
              </Button>
            </div>
          )}
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

      <OverlayUsingGuide />

      <FAQSection
        title="Questions"
        questions={extensionInstallFaq}
        compact
      />
    </div>
  );
}

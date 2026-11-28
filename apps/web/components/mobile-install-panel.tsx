"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Chrome, Share2, X } from "lucide-react";
import { MobileInstallEmail } from "./mobile-install-email";
import { InstallPlatformMarks } from "@/components/install-platform-marks";
import { CHROME_WEB_STORE_URL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { inferPageTemplateFromPath, trackConversion, trackStoreClick } from "@/lib/conversion-events";
import { desktopInstallUrl } from "@/lib/mobile-install";
import { redactAttributionPath } from "@/lib/seo-landing-path";
import { MobileInstallContext } from "@/components/install-link";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { shareOrCopyUrl } from "@/lib/use-mobile-device";
import styles from "./mobile-install-panel.module.css";

function panelEventContext() {
  const path = redactAttributionPath(window.location.pathname || "/");
  return { page_path: path, page_template: inferPageTemplateFromPath(path), placement: "mobile_install_panel" };
}

export function MobileInstallProvider({ children, mobilePreview = false }: { children: ReactNode; mobilePreview?: boolean }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "busy" | "copied" | "manual">("idle");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const shareAttempt = useRef(0);
  const sharing = useRef(false);
  const open = useCallback((href = INSTALL_HUB_PATH) => {
    shareAttempt.current += 1;
    sharing.current = false;
    setShareState("idle");
    setShareUrl(desktopInstallUrl(href, window.location.origin));
    trackConversion("mobile_install_panel_view", panelEventContext());
  }, []);
  const close = useCallback(() => {
    shareAttempt.current += 1;
    sharing.current = false;
    setShareUrl(null);
  }, []);
  const context = useMemo(() => ({ open, mobilePreview }), [open, mobilePreview]);

  useBodyScrollLock(shareUrl !== null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (shareUrl && !element.open) element.showModal();
    else if (!shareUrl && element.open) element.close();
  }, [shareUrl]);

  useEffect(() => () => { shareAttempt.current += 1; }, []);

  async function shareLink() {
    if (!shareUrl || sharing.current) return;
    const attempt = ++shareAttempt.current;
    sharing.current = true;
    setShareState("busy");
    try {
      const result = await shareOrCopyUrl(shareUrl, { title: "Install AniDachi", text: "Watch together with friends in Chrome on your computer." });
      if (attempt === shareAttempt.current) setShareState(result === "copied" ? "copied" : "idle");
      trackConversion("desktop_install_link_copied", { ...panelEventContext(), cta_variant: result });
    } catch (error) {
      if (attempt === shareAttempt.current) setShareState(error instanceof Error && error.name === "AbortError" ? "idle" : "manual");
    } finally {
      if (attempt === shareAttempt.current) sharing.current = false;
    }
  }

  return <MobileInstallContext.Provider value={context}>
    {children}
    <dialog ref={dialog} className={styles.panel} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { if (!dialog.current?.open) close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      {shareUrl ? <div className={styles.body} data-scroll-lock-scrollable>
        <button type="button" className={styles.close} aria-label="Close install panel" onClick={close} autoFocus>
          <X size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <MobileInstallEmail titleId={titleId} descriptionId={descriptionId} />
        <div className={styles.actions}>
          <a className={styles.secondary} href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer"
            onClick={() => trackStoreClick("mobile_install_panel")}>
            <Chrome size={16} aria-hidden="true" /> Chrome Store<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" className={styles.secondary} onClick={() => void shareLink()} disabled={shareState === "busy"}>
            {shareState === "copied" ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
            {shareState === "copied" ? "Link copied" : "Share link"}
          </button>
        </div>
        <div role="status" aria-live="polite">
          {shareState === "copied" ? <span className="sr-only">Desktop install link copied.</span> : null}
          {shareState === "manual" ? <div className={styles.manual}>
            <label htmlFor={`${titleId}-link`}>Copy this link to open it on your computer</label>
            <input id={`${titleId}-link`} readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
          </div> : null}
        </div>
        <div className={styles.marks}><InstallPlatformMarks compact /></div>
      </div> : null}
    </dialog>
  </MobileInstallContext.Provider>;
}

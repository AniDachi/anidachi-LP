import { ArrowUpRight, BookOpen, Inbox, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { WEB_HTTP_BASE } from "./constants";

// The previous seen flag was set on display, so it cannot prove acknowledgement.
const WELCOME_ACKNOWLEDGED_KEY = "anidachi.welcomeAcknowledged.v1";

// Informational until acknowledged on this installation; never authorizes recording.
export function PopupWelcome({ active, onOpenSettings, onDismiss }: {
  active: boolean;
  onOpenSettings: () => void;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const stored = await chrome.storage.local.get(WELCOME_ACKNOWLEDGED_KEY);
        if (current) setVisible(stored[WELCOME_ACKNOWLEDGED_KEY] !== true);
      } catch {
        // A read failure is not an acknowledgement; the notice remains dismissible.
        if (current) setVisible(true);
      }
    })();
    return () => { current = false; };
  }, []);

  const acknowledge = () => {
    setVisible(false);
    onDismiss?.();
    // A failed save must not block the popup; the next opening can show it again.
    void (async () => {
      try {
        await chrome.storage.local.set({ [WELCOME_ACKNOWLEDGED_KEY]: true });
      } catch { /* No recording preferences are changed by this notice. */ }
    })();
  };

  if (!active || !visible) return null;
  return (
    <section className="popup-welcome" aria-label="Welcome to AniDachi">
      <style>{styles}</style>
      <h2>Welcome to <span>AniDachi</span></h2>
      <p className="popup-welcome-intro">Here’s how to watch with friends.</p>
      <ol className="popup-welcome-steps">
        <li>
          <span className="popup-welcome-number" aria-hidden="true">1</span>
          <div><h3>Open a video</h3><p>On YouTube, Crunchyroll or Netflix.</p></div>
        </li>
        <li>
          <span className="popup-welcome-number" aria-hidden="true">2</span>
          <div><h3>Click the AniDachi capsule</h3><p>Find it at the top-right of the player.</p></div>
        </li>
        <li>
          <span className="popup-welcome-number" aria-hidden="true">3</span>
          <div><h3>Create a room &amp; invite friends</h3><p>Share the room link to watch together.</p></div>
        </li>
      </ol>
      <a className="popup-welcome-guide" href={new URL("/extension#using", WEB_HTTP_BASE).toString()} target="_blank" rel="noopener noreferrer">
        View setup guide <ArrowUpRight size={14} strokeWidth={1.7} aria-hidden="true" />
      </a>
      <div className="popup-welcome-overview">
        <h3>In this popup</h3>
        <dl className="popup-welcome-tabs">
          <div><dt><BookOpen size={16} strokeWidth={1.7} aria-hidden="true" />Watch</dt><dd>Track your viewing progress.</dd></div>
          <div><dt><Users size={16} strokeWidth={1.7} aria-hidden="true" />People</dt><dd>Manage friends and groups.</dd></div>
          <div><dt><Inbox size={16} strokeWidth={1.7} aria-hidden="true" />Inbox</dt><dd>View and respond to room invites.</dd></div>
        </dl>
        <p className="popup-welcome-note">Manage history recording in <button type="button" className="popup-welcome-settings" onClick={onOpenSettings}>Settings</button>.</p>
      </div>
      <button type="button" className="popup-welcome-done" onClick={acknowledge}>Got it</button>
    </section>
  );
}

const styles = `
.popup-welcome { margin: 4px 0 18px; padding: 20px 18px 16px; border: 1px solid var(--ad-border, #302a24); border-radius: 14px; background: var(--ad-panel-strong, #15120f); color: var(--ad-text, #efe6db); }
.popup-welcome h2 { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 650; letter-spacing: -.8px; }
.popup-welcome h2 span { color: var(--ad-accent-strong, #ff9650); }
.popup-welcome h3 { margin: 0 0 5px; font-size: 14px; line-height: 21px; font-weight: 600; }
.popup-welcome p { margin: 0; font-size: 12px; line-height: 1.65; color: var(--ad-text-secondary, #b9afa3); }
.popup-welcome .popup-welcome-intro { margin: 10px 0 20px; font-size: 13px; }
.popup-welcome-steps { display: grid; gap: 16px; list-style: none; margin: 0; padding: 0; }
.popup-welcome-steps li { display: grid; grid-template-columns: 19px minmax(0, 1fr); gap: 12px; }
.popup-welcome-number { font-size: 13px; line-height: 21px; font-weight: 600; color: #ffac70; }
.popup-welcome-guide { display: flex; align-items: center; gap: 8px; width: fit-content; min-height: 32px; margin: 10px 0 0 31px; color: #e1b48e; font-size: 12px; text-decoration: none; }
.popup-welcome-guide:hover { color: #ffd5b2; }
.popup-welcome-overview { margin-top: 18px; padding-top: 17px; border-top: 1px solid var(--ad-border, #302a24); }
.popup-welcome-overview > h3 { margin: 0 0 14px; font-size: 13px; line-height: 1.4; }
.popup-welcome-tabs { display: grid; gap: 13px; margin: 0; }
.popup-welcome-tabs > div { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 10px; align-items: start; }
.popup-welcome-tabs dt { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.55; font-weight: 550; }
.popup-welcome-tabs svg { flex-shrink: 0; color: #dba77e; }
.popup-welcome-tabs dd { margin: 0; font-size: 12px; line-height: 1.55; color: var(--ad-text-secondary, #b9afa3); }
.popup-welcome .popup-welcome-note { margin-top: 16px; font-size: 11px; line-height: 1.7; color: var(--ad-text-muted, #92908d); }
.popup-welcome-settings { border: 0; padding: 0; background: transparent; color: var(--ad-text, #efe6db); font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.popup-welcome-settings:hover { color: #fff; }
.popup-welcome-done { display: block; width: 100%; min-height: 43px; margin-top: 18px; border: 0; border-radius: 999px; padding: 10px 16px; background: #f1e9da; color: #211b15; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.popup-welcome-done:hover { background: #fff5e8; }
.popup-welcome button:focus-visible, .popup-welcome a:focus-visible { outline: 2px solid #ff9d54; outline-offset: 3px; }
`;

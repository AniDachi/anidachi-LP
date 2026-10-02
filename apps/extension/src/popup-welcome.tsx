import { Bookmark, Users } from "lucide-react";
import { useEffect, useState } from "react";

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
      <h2>Welcome to AniDachi</h2>
      <div className="popup-welcome-item">
        <Users size={20} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <h3>Watch with friends</h3>
          <p>Open a video on Crunchyroll or YouTube, then create a room in AniDachi with Plus or Pro. Joining a friend’s room is free.</p>
        </div>
      </div>
      <div className="popup-welcome-item">
        <Bookmark size={20} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <h3>Pick up where you left off</h3>
          <p>With Plus or Pro, video titles, links and playback progress are saved to your AniDachi account and appear here. You can turn this off in <button type="button" className="popup-welcome-settings" onClick={onOpenSettings}>Settings</button>.</p>
        </div>
      </div>
      <button type="button" className="popup-welcome-done" onClick={acknowledge}>Got it</button>
    </section>
  );
}

const styles = `
.popup-welcome { margin: 4px 0 18px; padding: 20px 18px 18px; border: 1px solid var(--ad-border, #302a24); border-radius: 8px; background: var(--ad-panel-strong, #15120f); color: var(--ad-text, #efe6db); }
.popup-welcome h2 { margin: 0 0 23px; font-size: 23px; line-height: 1.2; font-weight: 650; letter-spacing: -.7px; }
.popup-welcome-item { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; }
.popup-welcome-item + .popup-welcome-item { margin-top: 22px; }
.popup-welcome-item > svg { color: var(--ad-accent-strong, #ff9650); margin-top: 1px; }
.popup-welcome h3 { margin: 0 0 7px; font-size: 13px; line-height: 1.5; font-weight: 600; }
.popup-welcome p { margin: 0; font-size: 12px; line-height: 1.65; color: var(--ad-text-secondary, #b9afa3); }
.popup-welcome-settings { border: 0; padding: 0; background: transparent; color: var(--ad-text, #efe6db); font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.popup-welcome-done { display: block; width: 100%; min-height: 38px; margin-top: 24px; border: 1px solid #efe6db; border-radius: 5px; padding: 9px 16px; background: #efe6db; color: #211910; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.popup-welcome-done:hover { background: #fff5e8; }
.popup-welcome button:focus-visible { outline: 2px solid #ff9d54; outline-offset: 3px; }
`;

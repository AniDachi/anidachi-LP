import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { WEB_HTTP_BASE } from "./constants";
import welcomeChalkPath from "./assets/welcome-chalk-path.png";
import welcomeChalkNumbers from "./assets/welcome-chalk-numbers.png";

// The previous seen flag was set on display, so it cannot prove acknowledgement.
const WELCOME_ACKNOWLEDGED_KEY = "anidachi.welcomeAcknowledged.v1";

// Informational until acknowledged on this installation; never authorizes recording.
export function PopupWelcome({ active, onDismiss }: {
  active: boolean;
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
      <p className="popup-welcome-intro">Watch together in three steps.</p>
      <ol className="popup-welcome-steps">
        <li>
          <span className="popup-welcome-number" aria-hidden="true" />
          <div className="popup-welcome-step-copy"><h3>Open a video</h3><p>YouTube, Crunchyroll or Netflix</p></div>
          <span className="popup-welcome-art" aria-hidden="true" />
        </li>
        <li>
          <span className="popup-welcome-number" aria-hidden="true" />
          <div className="popup-welcome-step-copy"><h3>Click the capsule</h3><p>Top-right of the player</p></div>
          <span className="popup-welcome-art" aria-hidden="true" />
        </li>
        <li>
          <span className="popup-welcome-number" aria-hidden="true" />
          <div className="popup-welcome-step-copy"><h3>Create a room</h3><p>Share the link with your friends</p></div>
          <span className="popup-welcome-art" aria-hidden="true" />
        </li>
      </ol>
      <div className="popup-welcome-footer">
        <button type="button" className="popup-welcome-done" onClick={acknowledge}>Got it</button>
        <a className="popup-welcome-guide" href={new URL("/extension#using", WEB_HTTP_BASE).toString()} target="_blank" rel="noopener noreferrer">
          Guide <ArrowUpRight size={7} viewBox="6 6 12 12" strokeWidth={1.7} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

const styles = `
.popup-welcome { margin: 0; padding: 18px 8px 0; color: var(--ad-text, #efe6db); }
/* Keep the first-run screen self-contained; the retained library returns on acknowledgement. */
.popup-welcome ~ .popup-watch-content { display: none; }
.popup-welcome h2 { margin: 0; font-size: 23px; line-height: 1.2; font-weight: 700; letter-spacing: -.9px; }
.popup-welcome h2 span { color: var(--ad-accent-strong, #ff9650); }
.popup-welcome h3 { margin: 0 0 5px; font-size: 15px; line-height: 19px; font-weight: 650; letter-spacing: -.25px; }
.popup-welcome p { margin: 0; font-size: 12px; line-height: 17px; color: var(--ad-muted, #b9afa3); }
.popup-welcome .popup-welcome-intro { margin: 7px 0 18px; font-size: 12px; line-height: 18px; }
.popup-welcome-steps { display: grid; grid-template-rows: repeat(3, 1fr); height: 260px; list-style: none; margin: 0; padding: 0; }
.popup-welcome-steps li { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) 132px; align-items: center; gap: 9px; }
.popup-welcome-number { width: 36px; height: 36px; background: url("${welcomeChalkNumbers}") 0 50% / 300% 100% no-repeat; }
.popup-welcome-steps li:nth-child(2) .popup-welcome-number { background-position-x: 50%; }
.popup-welcome-steps li:nth-child(3) .popup-welcome-number { background-position-x: 100%; }
/* Each artwork slice shares a grid row with its copy, independent of line wrapping. */
.popup-welcome-art { display: block; width: 132px; height: 62px; background: url("${welcomeChalkPath}") center -28px / 132px 264px no-repeat; pointer-events: none; }
/* Exclude the next arrow's tail on the left while retaining the full pointer on the right. */
.popup-welcome-steps li:nth-child(2) .popup-welcome-art { height: 52px; background-position-y: -119px; clip-path: polygon(0 0, 100% 0, 100% 100%, 62% 100%, 62% 84%, 0 84%); }
.popup-welcome-steps li:nth-child(3) .popup-welcome-art { height: 46px; background-position-y: -192px; }
.popup-welcome-steps li:not(:last-child)::after { content: ""; position: absolute; right: 86px; top: calc(100% - 14px); width: 46px; height: 28px; background: url("${welcomeChalkPath}") left -91px / 132px 264px no-repeat; pointer-events: none; }
.popup-welcome-steps li:nth-child(2)::after { background-position-y: -164px; }
.popup-welcome-footer { display: grid; gap: 6px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ad-border, #302a24); }
/* Balance the leading glyph's side bearing against the tightly cropped arrow. */
.popup-welcome-guide { display: flex; justify-self: center; align-items: center; gap: 6px; padding-right: 1px; min-height: 30px; color: var(--ad-accent, #ff8a3d); font-size: 12px; text-decoration: none; }
.popup-welcome-guide:hover { color: #ffc18e; }
.popup-welcome-done { display: block; width: 100%; min-height: 42px; border: 0; border-radius: 999px; padding: 10px 16px; background: #f1e9da; color: #211b15; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
.popup-welcome-done:hover { background: #fff5e8; }
.popup-welcome button:focus-visible, .popup-welcome a:focus-visible { outline: 2px solid #ff9d54; outline-offset: 3px; }
@media (max-width: 359px) {
  .popup-welcome { padding-inline: 2px; }
  .popup-welcome h2 { font-size: 21px; }
  .popup-welcome-steps li { grid-template-columns: 32px minmax(0, 1fr) 112px; gap: 5px; }
  .popup-welcome-number { width: 32px; height: 32px; }
  .popup-welcome-art { width: 112px; }
  .popup-welcome-steps li:not(:last-child)::after { right: 76px; }
}
`;

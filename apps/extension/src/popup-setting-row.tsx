import { useId } from "react";

export function PopupSettingRow({ label, description, checked, disabled = false, busy = false, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
}) {
  const descriptionId = useId();
  return (
    <div className="popup-setting-row">
      <div className="popup-setting-copy">
        <strong>{label}</strong>
        <p id={descriptionId}>{description}</p>
      </div>
      <button type="button" role="switch" aria-label={label} aria-describedby={descriptionId}
        aria-checked={checked} aria-busy={busy} disabled={disabled || busy}
        className="popup-setting-switch" onClick={onChange}>
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

export const popupSettingsStyles = `
  .popup-local-settings { margin-top: 22px; padding: 0 6px 16px; color: var(--ad-text); }
  .popup-local-settings-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
  .popup-local-settings-heading h2 { margin: 0; font-size: 23px; font-weight: 600; letter-spacing: -.6px; line-height: 1.25; }
  .popup-local-settings-close { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 4px; color: var(--ad-muted); background: transparent; cursor: pointer; }
  .popup-local-settings-close:hover { color: var(--ad-text); background: var(--ad-surface); }
  .popup-settings-group + .popup-settings-group { margin-top: 24px; padding-top: 24px; border-top: 1px solid #3a342e; }
  .popup-settings-group h3 { display: flex; align-items: center; gap: 9px; margin: 0 0 7px; color: var(--ad-text); font-size: 15px; line-height: 1.4; font-weight: 600; letter-spacing: -.2px; }
  .popup-settings-group h3 svg { flex: 0 0 18px; color: var(--ad-accent); }
  .popup-setting-row { display: flex; align-items: center; gap: 20px; min-height: 78px; padding: 16px 0; }
  .popup-setting-row ~ .popup-setting-row { border-top: 1px solid var(--ad-border); }
  .popup-setting-copy { flex: 1; min-width: 0; }
  .popup-setting-copy strong { display: block; font-size: 13px; line-height: 1.4; font-weight: 500; }
  .popup-setting-copy p { margin: 5px 0 0; color: #aaa6a1; font-size: 11px; line-height: 1.6; }
  .popup-setting-switch { flex: 0 0 40px; width: 40px; height: 24px; padding: 3px; border: 1px solid #5d5955; border-radius: 14px; background: #302e2c; cursor: pointer; }
  .popup-setting-switch > span { display: block; width: 16px; height: 16px; border-radius: 50%; background: #d9d2ca; transition: transform 140ms ease; }
  .popup-setting-switch[aria-checked="true"] { background: #ff8a3d; border-color: #ff8a3d; }
  .popup-setting-switch[aria-checked="true"] > span { transform: translateX(16px); background: #20160e; }
  .popup-setting-switch:disabled { opacity: .5; cursor: default; }
  .popup-setting-switch[aria-busy="true"] { cursor: wait; }
  .popup-setting-switch:focus-visible, .popup-local-settings-close:focus-visible { outline: 2px solid var(--ad-accent); outline-offset: 4px; }
  .popup-settings-note { margin: 3px 0 0; color: var(--ad-muted); font-size: 10px; line-height: 1.6; }
  .popup-local-settings-error { margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: #ff9aa8; }
  @media (prefers-reduced-motion: reduce) { .popup-setting-switch > span { transition: none; } }
`;

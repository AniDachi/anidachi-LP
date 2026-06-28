export const popupStyles = `
  :root {
    color-scheme: dark;
    background: transparent;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    width: 382px;
    min-height: 440px;
    max-height: 560px;
    overflow: hidden;
    background: #070813;
    color: rgba(255, 255, 255, 0.94);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  button {
    font: inherit;
  }

  .popup-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    white-space: nowrap;
    border: 0;
    clip: rect(0 0 0 0);
  }

  .popup-shell {
    position: relative;
    min-height: 440px;
    max-height: 560px;
    overflow: auto;
    padding: 12px;
    background:
      radial-gradient(circle at 5% 2%, rgba(244, 114, 182, 0.18), transparent 30%),
      radial-gradient(circle at 96% 8%, rgba(59, 130, 246, 0.17), transparent 34%),
      radial-gradient(circle at 52% 102%, rgba(124, 58, 237, 0.24), transparent 44%),
      linear-gradient(145deg, #0a0715 0%, #070813 46%, #0b1020 100%);
  }

  .popup-shell::before {
    content: "";
    position: fixed;
    inset: 0 auto 0 0;
    width: 72px;
    pointer-events: none;
    background:
      radial-gradient(circle at 42% 14%, rgba(255, 132, 71, 0.28), transparent 22%),
      radial-gradient(circle at 46% 88%, rgba(167, 139, 250, 0.18), transparent 26%),
      linear-gradient(180deg, rgba(49, 46, 129, 0.26), rgba(10, 8, 20, 0.02));
    mask-image: linear-gradient(90deg, black 0%, black 54%, transparent 100%);
    opacity: 0.65;
  }

  .popup-shell::-webkit-scrollbar {
    width: 0;
  }

  .popup-header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    padding: 1px 1px 0;
  }

  .popup-header-actions {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .popup-brand {
    font-size: 22px;
    line-height: 1.05;
    font-weight: 820;
    letter-spacing: 0;
  }

  .popup-subtitle {
    margin-top: 3px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }

  .popup-icon-button {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .popup-account-button {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(196, 181, 253, 0.24);
    background: rgba(124, 58, 237, 0.16);
    color: rgba(255, 255, 255, 0.88);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 20px rgba(79, 70, 229, 0.18);
  }

  .popup-account-button:hover {
    background: rgba(124, 58, 237, 0.25);
    border-color: rgba(196, 181, 253, 0.36);
    color: rgba(255, 255, 255, 0.98);
  }

  .popup-account-button .popup-social-avatar {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }

  .popup-icon-button:hover {
    color: rgba(255, 255, 255, 0.96);
    background: rgba(255, 255, 255, 0.12);
  }

  .popup-icon-button:disabled {
    cursor: default;
    opacity: 0.38;
  }

  .popup-icon-button:disabled:hover {
    color: rgba(255, 255, 255, 0.78);
    background: rgba(255, 255, 255, 0.08);
  }

  .popup-section {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 8px;
  }

  .popup-section-title {
    padding-left: 2px;
    font-size: 10px;
    font-weight: 780;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.46);
  }

  .popup-tabs {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
    margin-bottom: 10px;
    padding: 3px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    background: rgba(255, 255, 255, 0.045);
  }

  .popup-tab {
    min-height: 32px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    cursor: pointer;
    font-size: 11px;
    font-weight: 780;
  }

  .popup-tab span {
    margin-left: 5px;
    color: rgba(255, 255, 255, 0.36);
  }

  .popup-tab[data-active="true"] {
    background: rgba(139, 92, 246, 0.22);
    color: rgba(255, 255, 255, 0.95);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .popup-tab[data-active="true"] span {
    color: #c4b5fd;
  }

  .popup-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .popup-mini-button {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .popup-mini-button:disabled {
    cursor: default;
    opacity: 0.42;
  }

  .popup-mini-button-danger {
    color: rgba(254, 202, 202, 0.92);
  }

  .popup-resource-list {
    display: grid;
    gap: 8px;
  }

  .popup-library-filter-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
    padding: 3px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    background: rgba(255, 255, 255, 0.045);
  }

  .popup-library-filter-row button {
    min-height: 30px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    cursor: pointer;
    font-size: 11px;
    font-weight: 780;
  }

  .popup-library-filter-row button span {
    margin-left: 5px;
    color: rgba(255, 255, 255, 0.36);
  }

  .popup-library-filter-row button[data-active="true"] {
    background: rgba(139, 92, 246, 0.22);
    color: rgba(255, 255, 255, 0.95);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .popup-library-filter-row button[data-active="true"] span {
    color: #c4b5fd;
  }

  .popup-companion-filter {
    min-width: 0;
    display: grid;
    gap: 5px;
  }

  .popup-companion-filter-label {
    padding-left: 2px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 10px;
    font-weight: 760;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .popup-companion-scroll {
    min-width: 0;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 1px;
    scrollbar-width: none;
  }

  .popup-companion-scroll::-webkit-scrollbar {
    display: none;
  }

  .popup-companion-chip {
    min-width: 0;
    flex: 0 0 auto;
    max-width: 142px;
    min-height: 29px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.66);
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 760;
  }

  .popup-companion-chip span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-companion-chip[data-active="true"] {
    border-color: rgba(167, 139, 250, 0.28);
    background: rgba(139, 92, 246, 0.18);
    color: rgba(255, 255, 255, 0.94);
  }

  .popup-companion-avatar {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.96);
    font-size: 7px;
    font-weight: 850;
    flex: 0 0 auto;
  }

  .popup-social-list {
    display: grid;
    gap: 8px;
  }

  .popup-social-block {
    display: grid;
    gap: 6px;
  }

  .popup-social-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    font-weight: 760;
  }

  .popup-social-row {
    min-height: 48px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(120deg, rgba(255, 255, 255, 0.048), rgba(255, 255, 255, 0.016)),
      rgba(14, 16, 30, 0.76);
  }

  .popup-social-notice-slot {
    min-height: 36px;
    display: grid;
    align-items: stretch;
  }

  .popup-social-notice {
    min-height: 36px;
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.72);
    font-size: 11.5px;
    line-height: 1.35;
  }

  .popup-social-notice[data-tone="success"] {
    border-color: rgba(74, 222, 128, 0.2);
    background: rgba(34, 197, 94, 0.1);
    color: rgba(187, 247, 208, 0.92);
  }

  .popup-social-notice[data-tone="error"] {
    border-color: rgba(248, 113, 113, 0.24);
    background: rgba(239, 68, 68, 0.1);
    color: rgba(254, 202, 202, 0.92);
  }

  .popup-group-create-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
  }

  .popup-group-name-input,
  .popup-group-select {
    min-width: 0;
    width: 100%;
    min-height: 34px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.92);
    outline: 0;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .popup-group-name-input::placeholder {
    color: rgba(255, 255, 255, 0.36);
  }

  .popup-group-name-input:focus,
  .popup-group-select:focus {
    border-color: rgba(167, 139, 250, 0.72);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
  }

  .popup-group-name-input:disabled,
  .popup-group-select:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .popup-group-card {
    display: grid;
    gap: 9px;
    padding: 9px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at 0 0, rgba(139, 92, 246, 0.12), transparent 42%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.052), rgba(255, 255, 255, 0.018)),
      rgba(14, 16, 30, 0.78);
  }

  .popup-group-header {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
  }

  .popup-group-actions,
  .popup-group-edit-form {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 6px;
  }

  .popup-group-edit-form {
    width: 100%;
  }

  .popup-group-member-list {
    display: grid;
    gap: 5px;
  }

  .popup-group-member-row {
    min-width: 0;
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.76);
    font-size: 11.5px;
    font-weight: 720;
  }

  .popup-group-member-row .popup-social-avatar {
    width: 26px;
    height: 26px;
    font-size: 9px;
  }

  .popup-group-member-row span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-group-empty {
    padding: 4px 1px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 11.5px;
  }

  .popup-group-add-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .popup-inbox-card {
    display: grid;
    gap: 8px;
    padding: 9px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at 0 0, rgba(139, 92, 246, 0.13), transparent 42%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.054), rgba(255, 255, 255, 0.018)),
      rgba(14, 16, 30, 0.78);
  }

  .popup-inbox-main {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
  }

  .popup-inbox-message {
    margin: 0;
    padding: 8px 9px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.68);
    font-size: 11.5px;
    line-height: 1.35;
  }

  .popup-inbox-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .popup-social-avatar,
  .popup-social-group-icon {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(139, 92, 246, 0.22);
    color: rgba(255, 255, 255, 0.9);
    font-size: 11px;
    font-weight: 820;
  }

  img.popup-social-avatar {
    object-fit: cover;
    display: block;
  }

  .popup-social-main {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .popup-social-main span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-social-main span:first-child {
    font-size: 12.5px;
    font-weight: 780;
  }

  .popup-social-main span:last-child {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.52);
  }

  .popup-social-empty {
    display: grid;
    gap: 9px;
    place-items: center;
    padding: 18px 12px;
    border-radius: 15px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 255, 255, 0.62);
    text-align: center;
    font-size: 12px;
  }

  .popup-social-empty[data-tone="error"] {
    border-color: rgba(248, 113, 113, 0.24);
    background: rgba(239, 68, 68, 0.1);
    color: rgba(254, 202, 202, 0.92);
  }

  .popup-primary-button,
  .popup-secondary-button,
  .popup-dashboard-button {
    min-height: 34px;
    border-radius: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    background: #7c3aed;
    color: white;
    cursor: pointer;
    font-size: 12px;
    font-weight: 780;
  }

  .popup-primary-button {
    padding: 0 15px;
  }

  .popup-secondary-button {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.075);
    color: rgba(255, 255, 255, 0.82);
    padding: 0 12px;
  }

  .popup-dashboard-button {
    width: 100%;
  }

  .popup-primary-button:hover,
  .popup-dashboard-button:hover {
    background: #8b5cf6;
  }

  .popup-secondary-button:hover {
    background: rgba(255, 255, 255, 0.11);
  }

  .popup-primary-button:disabled,
  .popup-secondary-button:disabled {
    cursor: default;
    opacity: 0.48;
  }

  .popup-provider {
    position: relative;
    overflow: visible;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    background:
      linear-gradient(130deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
      rgba(8, 10, 22, 0.88);
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
  }

  .popup-provider-row,
  .popup-watch-row {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .popup-provider-row {
    min-height: 58px;
    padding: 11px 12px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 32px;
    align-items: center;
    gap: 10px;
  }

  .resource-provider-logo {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
    font-weight: 840;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 18px rgba(0, 0, 0, 0.28);
  }

  .resource-provider-logo.crunchyroll {
    background: #10101b;
  }

  .resource-provider-logo.crunchyroll > span {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 5px solid #ff7a1a;
    border-right-color: transparent;
    transform: rotate(-22deg);
    box-shadow: 0 0 14px rgba(249, 115, 22, 0.22);
  }

  .resource-provider-logo.netflix {
    color: #ef4444;
  }

  .resource-provider-logo.youtube {
    color: #f43f5e;
  }

  .resource-provider-logo.amazon {
    color: #38bdf8;
  }

  .popup-provider-main {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .popup-provider-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    line-height: 1.1;
    font-weight: 820;
  }

  .popup-provider-meta,
  .popup-watch-meta {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 11.5px;
    line-height: 1.25;
    color: rgba(255, 255, 255, 0.56);
  }

  .popup-provider-chevron,
  .popup-watch-chevron {
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.82);
    transition: transform 160ms ease, background 160ms ease;
  }

  .popup-provider-chevron {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    justify-self: end;
  }

  .popup-provider-chevron[data-open="false"],
  .popup-watch-chevron[data-open="false"] {
    transform: rotate(-90deg);
  }

  .popup-provider-body {
    display: grid;
    gap: 7px;
    padding: 9px 10px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popup-kind-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    padding: 2px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.075);
  }

  .popup-kind-tab {
    height: 28px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    cursor: pointer;
    font-size: 11px;
    font-weight: 760;
    letter-spacing: 0;
  }

  .popup-kind-tab span {
    color: rgba(255, 255, 255, 0.38);
    font-weight: 680;
  }

  .popup-kind-tab[data-active="true"] {
    background: rgba(139, 92, 246, 0.2);
    color: rgba(255, 255, 255, 0.94);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .popup-kind-tab[data-active="true"] span {
    color: #c4b5fd;
  }

  .popup-empty {
    padding: 11px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 255, 255, 0.52);
    font-size: 12px;
  }

  .popup-empty-syncing {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
  }

  .popup-empty-syncing svg {
    color: #ffbf5f;
    animation: popup-spin 900ms linear infinite;
  }

  @keyframes popup-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .popup-session-summary {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    margin-top: -2px;
  }

  .popup-session-summary-main {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.56);
    font-size: 10.5px;
    font-weight: 720;
  }

  .popup-session-summary-main > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-session-summary-action {
    min-height: 25px;
    border: 1px solid rgba(167, 139, 250, 0.18);
    border-radius: 999px;
    padding: 0 9px;
    background: rgba(139, 92, 246, 0.16);
    color: #c4b5fd;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 800;
  }

  .popup-session-summary-action:hover {
    background: rgba(139, 92, 246, 0.24);
    color: rgba(255, 255, 255, 0.96);
  }

  .popup-session-summary-action:disabled {
    cursor: default;
    opacity: 0.56;
  }

  .popup-watch-item {
    display: grid;
    gap: 7px;
  }

  .popup-watch-row {
    min-height: 42px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 20px;
    gap: 9px;
    align-items: center;
    padding: 7px 8px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.035);
  }

  .popup-watch-row:hover {
    background: rgba(255, 255, 255, 0.055);
  }

  .popup-watch-item[data-kind="series"] .popup-watch-row {
    background: transparent;
    min-height: 56px;
    padding: 5px 4px;
  }

  .popup-watch-item[data-kind="series"] .popup-watch-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .popup-watch-item[data-kind="movie"] {
    position: relative;
  }

  .popup-movie-card {
    position: relative;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 68px;
    padding: 7px 8px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at 8% 20%, rgba(236, 72, 153, 0.1), transparent 38%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.048), rgba(255, 255, 255, 0.016)),
      rgba(14, 16, 30, 0.76);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
    cursor: pointer;
  }

  .popup-card-link {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 0;
    border-radius: inherit;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .popup-movie-card:hover {
    border-color: rgba(251, 113, 133, 0.22);
    background:
      radial-gradient(circle at 10% 25%, rgba(236, 72, 153, 0.16), transparent 34%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.068), rgba(255, 255, 255, 0.024)),
      rgba(14, 16, 30, 0.82);
  }

  .popup-card-link:focus-visible {
    outline: 2px solid rgba(167, 139, 250, 0.58);
    outline-offset: 2px;
  }

  .popup-movie-artwork {
    color: rgba(251, 113, 133, 0.92);
  }

  .popup-watch-artwork {
    width: 34px;
    height: 48px;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      radial-gradient(circle at 18% 22%, rgba(251, 113, 133, 0.18), transparent 44%),
      rgba(255, 255, 255, 0.055);
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.48);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 18px rgba(0, 0, 0, 0.2);
  }

  .popup-watch-artwork img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .popup-watch-artwork[data-has-artwork="true"] {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.13);
  }

  .popup-watch-main {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .popup-watch-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 1.18;
    font-weight: 780;
    letter-spacing: 0;
  }

  .popup-watch-chevron {
    justify-self: end;
  }

  .popup-episode-list {
    display: grid;
    gap: 6px;
    padding-left: 4px;
  }

  .popup-episode-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    min-height: 66px;
    padding: 8px 9px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(120deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(14, 16, 30, 0.76);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
    cursor: pointer;
  }

  .popup-episode-row[data-selected="true"] {
    min-height: 70px;
    border-color: rgba(139, 92, 246, 0.32);
    background:
      radial-gradient(circle at 8% 20%, rgba(124, 58, 237, 0.12), transparent 38%),
      linear-gradient(120deg, rgba(139, 92, 246, 0.082), rgba(59, 130, 246, 0.035)),
      rgba(14, 16, 30, 0.82);
    box-shadow:
      0 10px 22px rgba(46, 16, 101, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }

  .popup-episode-main {
    min-width: 0;
    display: grid;
    gap: 4px;
    position: relative;
    z-index: 2;
  }

  .popup-episode-header {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 7px;
  }

  .popup-episode-number {
    color: #b794ff;
    font-size: 13px;
    font-weight: 850;
    letter-spacing: 0;
  }

  .popup-episode-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 740;
  }

  .shared-progress {
    position: relative;
    z-index: 4;
    padding-top: 4px;
    padding-bottom: 0;
  }

  .shared-progress.compact {
    padding-top: 4px;
    padding-bottom: 0;
  }

  .shared-progress-track {
    position: relative;
    display: block;
    width: 100%;
    height: 36px;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: visible;
  }

  .shared-progress.compact .shared-progress-track {
    height: 34px;
  }

  .shared-progress-track::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 8px;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.11);
  }

  .shared-progress.compact .shared-progress-track::before {
    top: 8px;
    height: 5px;
  }

  .shared-progress-base,
  .shared-progress-segment {
    position: absolute;
    left: 0;
    top: 0;
    height: 22px;
    border-radius: 999px;
    background: transparent;
  }

  .shared-progress.compact .shared-progress-base,
  .shared-progress.compact .shared-progress-segment {
    top: 0;
    height: 21px;
  }

  .shared-progress-base {
    z-index: 1;
    pointer-events: none;
  }

  .shared-progress-segment {
    pointer-events: auto;
  }

  .shared-progress-base::before,
  .shared-progress-segment::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 8px;
    height: 5px;
    border-radius: 999px;
  }

  .shared-progress-base::before {
    background: linear-gradient(90deg, rgba(167, 139, 250, 0.42), rgba(91, 108, 255, 0.46));
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.14);
  }

  .shared-progress-segment.friends::before {
    background: linear-gradient(90deg, #a78bfa, #5b6cff);
    box-shadow: 0 0 14px rgba(91, 108, 255, 0.28);
  }

  .shared-progress-segment.date::before {
    background: linear-gradient(90deg, #fb7185, #a78bfa);
    box-shadow: 0 0 14px rgba(251, 113, 133, 0.26);
  }

  .shared-progress-segment.solo::before {
    background: linear-gradient(90deg, #7dd3fc, #5b6cff);
    box-shadow: 0 0 14px rgba(125, 211, 252, 0.2);
  }

  .shared-progress-segment::after,
  .shared-progress-marker::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 30px;
    left: 100%;
    z-index: 180;
    max-width: 190px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(9, 10, 20, 0.95);
    color: rgba(255, 255, 255, 0.9);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.42);
    font-size: 10px;
    font-weight: 720;
    line-height: 1.25;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 4px);
    transition: opacity 120ms ease, transform 120ms ease;
    white-space: nowrap;
  }

  .shared-progress-segment:hover::after,
  .shared-progress-marker:hover::after {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .shared-progress-marker[aria-expanded="true"]::after {
    display: none;
  }

  .shared-progress-track[data-active="true"] .shared-progress-segment::after {
    display: none;
  }

  .shared-progress-marker {
    position: absolute;
    top: 27px;
    z-index: 80;
    transform: translate(-50%, -50%);
    border: 0;
    background: transparent;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }

  .shared-progress.compact .shared-progress-marker {
    top: 25px;
  }

  .shared-progress-marker::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -16px;
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.24);
    transform: translateX(-50%);
    z-index: -1;
  }

  .shared-progress-marker:hover .shared-avatar {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.64);
  }

  .avatar-stack {
    display: inline-flex;
    align-items: center;
    position: relative;
    isolation: isolate;
  }

  .avatar-stack.compact {
    padding: 1px;
    margin: -1px;
    border-radius: 999px;
    background: rgba(7, 8, 19, 0.92);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 7px 18px rgba(0, 0, 0, 0.34);
  }

  .avatar-stack .shared-avatar:not(:first-child) {
    margin-left: -7px;
  }

  .avatar-stack.compact .shared-avatar {
    position: relative;
  }

  .avatar-stack.compact .shared-avatar:not(:first-child) {
    margin-left: -16px;
  }

  .avatar-stack.compact .shared-avatar:nth-child(1) {
    z-index: 1;
  }

  .avatar-stack.compact .shared-avatar:nth-child(2) {
    z-index: 2;
  }

  .avatar-stack.compact .shared-avatar:nth-child(3) {
    z-index: 3;
  }

  .avatar-stack.compact .shared-avatar:nth-child(4) {
    z-index: 4;
  }

  .avatar-stack.compact .shared-avatar:nth-child(5) {
    z-index: 5;
  }

  .shared-avatar {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid rgba(7, 8, 19, 0.96);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.34);
    color: rgba(255, 255, 255, 0.96);
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    font-size: 7px;
    line-height: 1;
    font-weight: 850;
    transition: transform 140ms ease, border-color 140ms ease;
  }

  .shared-progress.compact .shared-avatar {
    width: 18px;
    height: 18px;
  }

  .shared-progress-marker.friends .shared-avatar:first-child {
    box-shadow: 0 0 0 1px rgba(91, 108, 255, 0.68), 0 6px 15px rgba(0, 0, 0, 0.34);
  }

  .shared-progress-marker.date .shared-avatar:first-child {
    box-shadow: 0 0 0 1px rgba(244, 114, 182, 0.74), 0 6px 15px rgba(0, 0, 0, 0.34);
  }

  .shared-progress-marker.solo .shared-avatar:first-child {
    box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.72), 0 6px 15px rgba(0, 0, 0, 0.34);
  }

  .shared-session-popover {
    position: absolute;
    bottom: 41px;
    z-index: 170;
    width: min(218px, calc(100% - 12px));
    padding: 10px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    background: rgba(9, 10, 20, 0.96);
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    display: grid;
    gap: 8px;
    pointer-events: auto;
  }

  .shared-progress.compact .shared-session-popover {
    bottom: 39px;
  }

  .shared-session-popover[data-align="left"] {
    transform: translateX(0);
  }

  .shared-session-popover[data-align="center"] {
    transform: translateX(-50%);
  }

  .shared-session-popover[data-align="right"] {
    transform: translateX(-100%);
  }

  .shared-session-popover::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 50%;
    width: 10px;
    height: 10px;
    transform: translateX(-50%) rotate(45deg);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(9, 10, 20, 0.96);
  }

  .shared-session-popover[data-align="right"]::after {
    left: auto;
    right: 22px;
    transform: rotate(45deg);
  }

  .shared-session-popover[data-align="left"]::after {
    left: 22px;
    transform: rotate(45deg);
  }

  .shared-session-topline {
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 10px;
    line-height: 1.25;
  }

  .shared-session-topline span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.94);
    font-weight: 820;
  }

  .shared-session-topline span:last-child {
    flex: 0 0 auto;
  }

  .shared-session-friends {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .shared-session-friend {
    min-width: 0;
    max-width: 88px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px 3px 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.86);
    font-size: 10px;
    font-weight: 680;
  }

  .shared-session-friend .shared-avatar {
    width: 17px;
    height: 17px;
    font-size: 6px;
  }

  .shared-session-friend span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shared-session-action {
    width: 100%;
    border: 0;
    border-radius: 10px;
    padding: 7px 10px;
    background: linear-gradient(135deg, #8b5cf6, #2563eb);
    color: rgba(255, 255, 255, 0.97);
    cursor: pointer;
    font-size: 11px;
    font-weight: 820;
  }

  .shared-session-action:hover {
    filter: brightness(1.08);
  }

  .shared-session-action:disabled {
    cursor: default;
    opacity: 0.56;
    filter: none;
  }

  .resource-progress {
    width: 100%;
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .resource-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #a78bfa, #5b6cff);
  }

  body {
    width: 430px;
    min-height: 620px;
    max-height: 680px;
    background: #070b0f;
    color: rgba(255, 255, 255, 0.94);
  }

  .popup-shell {
    min-height: 620px;
    max-height: 680px;
    padding: 12px;
    background:
      radial-gradient(circle at 7% 0%, rgba(255, 136, 48, 0.2), transparent 28%),
      radial-gradient(circle at 92% 4%, rgba(88, 166, 255, 0.11), transparent 32%),
      radial-gradient(circle at 78% 92%, rgba(255, 159, 45, 0.08), transparent 34%),
      linear-gradient(145deg, #080d12 0%, #0b1117 47%, #080c11 100%);
  }

  .popup-shell::before {
    display: none;
  }

  .popup-topbar {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
    margin-bottom: 10px;
  }

  .popup-profile-button {
    min-width: 0;
    min-height: 58px;
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .popup-profile-avatar {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #b87253, #d89a6f);
    color: rgba(255, 255, 255, 0.96);
    box-shadow:
      0 11px 28px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    font-size: 19px;
    font-weight: 850;
  }

  .popup-profile-avatar[data-signed-in="false"] {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.72);
  }

  .popup-profile-avatar .popup-social-avatar {
    width: 48px;
    height: 48px;
    border-color: rgba(255, 255, 255, 0.16);
    background: transparent;
    font-size: 17px;
  }

  .popup-presence-dot {
    position: absolute;
    right: -1px;
    bottom: 3px;
    width: 13px;
    height: 13px;
    border-radius: 999px;
    border: 2px solid #0b1117;
    background: #4ade80;
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.4);
  }

  .popup-profile-avatar[data-signed-in="false"] .popup-presence-dot {
    background: rgba(255, 255, 255, 0.28);
    box-shadow: none;
  }

  .popup-profile-copy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .popup-brand {
    font-size: 22px;
    line-height: 1.05;
    font-weight: 860;
  }

  .popup-subtitle {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
    line-height: 1.2;
  }

  .popup-subtitle strong {
    color: #ffc453;
  }

  .popup-subtitle span {
    color: rgba(255, 255, 255, 0.34);
  }

  .popup-header-actions {
    display: grid;
    grid-template-columns: repeat(3, 58px);
    gap: 8px;
  }

  .popup-command-button {
    width: 58px;
    min-height: 58px;
    display: grid;
    place-items: center;
    gap: 3px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
      rgba(16, 22, 29, 0.86);
    color: rgba(255, 255, 255, 0.82);
    box-shadow:
      0 11px 24px rgba(0, 0, 0, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    cursor: pointer;
    font-size: 9.5px;
    line-height: 1;
  }

  .popup-command-button:hover {
    border-color: rgba(255, 178, 75, 0.28);
    color: #fff;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035)),
      rgba(22, 28, 35, 0.94);
  }

  .popup-command-button:disabled {
    opacity: 0.48;
    cursor: default;
  }

  .popup-tabs {
    margin-bottom: 10px;
    padding: 4px;
    gap: 4px;
    border-radius: 14px;
    border-color: rgba(255, 255, 255, 0.09);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025)),
      rgba(15, 21, 28, 0.84);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .popup-tab {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 11px;
    color: rgba(255, 255, 255, 0.64);
    font-size: 12px;
    font-weight: 790;
  }

  .popup-tab span {
    min-width: 20px;
    height: 20px;
    display: inline-grid;
    place-items: center;
    margin-left: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
  }

  .popup-tab[data-active="true"] {
    border: 1px solid rgba(255, 180, 69, 0.2);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
      rgba(255, 159, 45, 0.11);
    color: #ffc453;
  }

  .popup-tab[data-active="true"] span {
    background: rgba(255, 159, 45, 0.18);
    color: #ffc453;
  }

  .popup-watch-screen {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
  }

  .popup-card-heading {
    color: rgba(255, 255, 255, 0.58);
    font-size: 10px;
    font-weight: 830;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .popup-now-card,
  .popup-continue-card,
  .popup-filter-card,
  .popup-invite-composer,
  .popup-people-tray {
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 16px;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.022)),
      rgba(11, 17, 23, 0.86);
    box-shadow:
      0 16px 34px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }

  .popup-now-card {
    display: grid;
    gap: 12px;
    padding: 13px;
  }

  .popup-now-main {
    min-width: 0;
    display: grid;
    grid-template-columns: 43px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }

  .popup-now-copy {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .popup-now-copy > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 810;
  }

  .popup-now-copy > span:first-child span {
    color: rgba(255, 255, 255, 0.34);
  }

  .popup-now-copy > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    font-weight: 650;
  }

  .popup-tracking-pill {
    min-height: 26px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.12);
    color: rgba(209, 250, 229, 0.9);
    font-size: 10.5px;
    font-weight: 760;
    white-space: nowrap;
  }

  .popup-tracking-pill span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #4ade80;
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.45);
  }

  .popup-tracking-pill[data-active="false"] {
    border-color: rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.58);
  }

  .popup-tracking-pill[data-active="false"] span {
    background: rgba(255, 255, 255, 0.34);
    box-shadow: none;
  }

  .popup-now-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .popup-secondary-action,
  .popup-primary-action,
  .popup-start-room-button {
    min-height: 42px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 820;
  }

  .popup-secondary-action {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.88);
  }

  .popup-primary-action,
  .popup-start-room-button,
  .popup-primary-button,
  .popup-dashboard-button {
    border: 0;
    background: linear-gradient(135deg, #ff7a1a, #ffb02e);
    color: #fff8ed;
    box-shadow:
      0 12px 22px rgba(255, 122, 26, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.28);
  }

  .popup-secondary-action:disabled,
  .popup-primary-action:disabled,
  .popup-start-room-button:disabled {
    cursor: default;
    opacity: 0.46;
    box-shadow: none;
  }

  .popup-continue-card {
    padding: 10px;
  }

  .popup-continue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .popup-see-all-button {
    border: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
  }

  .popup-continue-list {
    display: grid;
    gap: 7px;
  }

  .popup-continue-row {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 112px) auto 24px;
    align-items: center;
    gap: 8px;
    min-height: 74px;
    padding: 7px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.035);
  }

  .popup-continue-open {
    min-width: 0;
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .popup-continue-poster,
  .popup-tray-poster {
    overflow: hidden;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.46);
  }

  .popup-continue-poster {
    width: 54px;
    height: 60px;
    border-radius: 10px;
  }

  .popup-continue-poster img,
  .popup-tray-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .popup-continue-info {
    min-width: 0;
    display: grid;
    gap: 5px;
  }

  .popup-continue-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 830;
  }

  .popup-continue-meta {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 11px;
    font-weight: 660;
    white-space: nowrap;
  }

  .popup-mode-badge {
    min-height: 20px;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
  }

  .popup-mode-badge[data-mode="solo"] {
    background: rgba(52, 211, 153, 0.14);
    color: #a7f3d0;
  }

  .popup-mode-badge[data-mode="together"] {
    background: rgba(255, 159, 45, 0.14);
    color: #ffc453;
  }

  .popup-mode-badge[data-mode="group"] {
    background: rgba(96, 165, 250, 0.14);
    color: #93c5fd;
  }

  .popup-continue-progress {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.56);
    font-size: 11px;
    font-weight: 680;
  }

  .popup-progress-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.11);
    overflow: hidden;
  }

  .popup-progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff7a1a, #ffb02e);
  }

  .popup-continue-social {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 10.5px;
    font-weight: 700;
  }

  .popup-continue-social > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-continue-time {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10.5px;
    white-space: nowrap;
  }

  .popup-row-menu {
    width: 24px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: transparent;
    color: rgba(255, 255, 255, 0.54);
    cursor: pointer;
  }

  .popup-row-menu:disabled {
    opacity: 0.36;
    cursor: default;
  }

  .popup-continue-empty {
    padding: 18px 10px;
    color: rgba(255, 255, 255, 0.56);
    text-align: center;
    font-size: 12px;
  }

  .popup-filter-card {
    padding: 8px;
    display: grid;
    gap: 8px;
  }

  .popup-library-filter-row {
    border-radius: 12px;
    border-color: rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.035);
  }

  .popup-library-filter-row button[data-active="true"],
  .popup-kind-tab[data-active="true"] {
    border: 1px solid rgba(255, 180, 69, 0.22);
    background: rgba(255, 159, 45, 0.13);
    color: #ffc453;
  }

  .popup-library-filter-row button[data-active="true"] span,
  .popup-kind-tab[data-active="true"] span {
    color: #ffc453;
  }

  .popup-filter-chip-row {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .popup-filter-chip-row::-webkit-scrollbar {
    display: none;
  }

  .popup-companion-chip[data-active="true"] {
    border-color: rgba(255, 180, 69, 0.24);
    background: rgba(255, 159, 45, 0.13);
    color: #ffc453;
  }

  .popup-invite-composer {
    padding: 10px;
    display: grid;
    gap: 9px;
  }

  .popup-invite-topline {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }

  .popup-invite-tabs {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popup-invite-tabs button {
    min-width: 0;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    font-size: 11px;
    font-weight: 740;
  }

  .popup-invite-tabs button[data-active="true"] {
    background: rgba(255, 159, 45, 0.14);
    color: #ffc453;
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.18);
  }

  .popup-invite-target {
    min-width: 0;
    min-height: 40px;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 255, 255, 0.86);
    cursor: pointer;
    text-align: left;
    font-size: 12px;
    font-weight: 780;
  }

  .popup-invite-target span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-room-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 1.45fr;
    gap: 7px;
  }

  .popup-room-toggle {
    min-height: 40px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 255, 255, 0.68);
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 770;
  }

  .popup-room-toggle[data-active="true"] {
    border-color: rgba(255, 180, 69, 0.26);
    background: rgba(255, 159, 45, 0.12);
    color: #ffc453;
  }

  .popup-people-tray {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 76px;
    gap: 7px;
    padding: 8px;
  }

  .popup-tray-column {
    min-width: 0;
    min-height: 52px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14px;
    grid-template-rows: auto 1fr;
    align-items: center;
    gap: 2px 5px;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0 5px 0 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .popup-tray-label {
    min-width: 0;
    color: rgba(255, 255, 255, 0.78);
    font-size: 11px;
    font-weight: 740;
  }

  .popup-tray-label span {
    margin-left: 5px;
    color: rgba(255, 255, 255, 0.46);
  }

  .popup-tray-preview {
    min-width: 0;
    grid-column: 1 / -1;
  }

  .popup-tray-avatar-row,
  .popup-tray-group-row,
  .popup-tray-poster-row {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  .popup-tray-avatar-row .popup-social-avatar {
    width: 23px;
    height: 23px;
    font-size: 8px;
    border: 2px solid #0d141b;
  }

  .popup-tray-avatar-row .popup-social-avatar:not(:first-child) {
    margin-left: -9px;
  }

  .popup-tray-group-thumb,
  .popup-tray-poster {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.56);
  }

  .popup-tray-group-thumb:not(:first-child),
  .popup-tray-poster:not(:first-child) {
    margin-left: -5px;
  }

  .popup-manage-button {
    min-width: 0;
    min-height: 52px;
    display: grid;
    place-items: center;
    gap: 3px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.76);
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 760;
  }

  .popup-quiet-danger {
    justify-self: center;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    cursor: pointer;
    font-size: 10.5px;
  }

  .popup-quiet-danger:disabled {
    opacity: 0.28;
    cursor: default;
  }

  .resource-provider-logo {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.055);
  }

  .resource-provider-logo.crunchyroll {
    background: rgba(255, 122, 26, 0.08);
  }

  .resource-provider-logo.crunchyroll > span {
    width: 26px;
    height: 26px;
    border-width: 6px;
    border-color: #ff7a1a;
    border-right-color: transparent;
  }

  .popup-social-row,
  .popup-group-card,
  .popup-inbox-card,
  .popup-social-empty,
  .popup-empty {
    border-color: rgba(255, 255, 255, 0.1);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02)),
      rgba(11, 17, 23, 0.84);
  }

  .popup-social-group-icon,
  .popup-social-avatar {
    background: linear-gradient(135deg, #b87253, #d89a6f);
  }

  .popup-secondary-button,
  .popup-mini-button {
    border-color: rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.055);
  }

  .popup-primary-button:hover,
  .popup-dashboard-button:hover,
  .popup-primary-action:hover,
  .popup-start-room-button:hover {
    filter: brightness(1.05);
  }

  /* Compact resource-library redesign. Keep this block last so it intentionally
     overrides the earlier exploratory dashboard pass. */
  body {
    width: 392px;
    min-height: 480px;
    max-height: 580px;
    background: #080c10;
  }

  .popup-shell {
    min-height: 480px;
    max-height: 580px;
    padding: 10px;
    background:
      radial-gradient(circle at 0% 0%, rgba(255, 122, 26, 0.14), transparent 28%),
      linear-gradient(145deg, #090e13 0%, #0d1319 50%, #080c10 100%);
  }

  .popup-topbar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .popup-profile-button {
    min-height: 42px;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 9px;
  }

  .popup-profile-avatar,
  .popup-profile-avatar .popup-social-avatar {
    width: 40px;
    height: 40px;
    font-size: 15px;
  }

  .popup-presence-dot {
    right: -1px;
    bottom: 2px;
    width: 11px;
    height: 11px;
  }

  .popup-brand {
    font-size: 19px;
  }

  .popup-subtitle {
    font-size: 11px;
  }

  .popup-header-actions {
    grid-template-columns: repeat(3, 34px);
    gap: 6px;
  }

  .popup-command-button {
    width: 34px;
    min-height: 34px;
    border-radius: 10px;
    gap: 0;
  }

  .popup-command-button span {
    display: none;
  }

  .popup-tabs {
    margin-bottom: 8px;
    padding: 3px;
    border-radius: 12px;
  }

  .popup-tab {
    min-height: 33px;
    border-radius: 9px;
    gap: 6px;
    font-size: 11.5px;
  }

  .popup-tab span {
    min-width: 18px;
    height: 18px;
    font-size: 9.5px;
  }

  .popup-watch-screen {
    gap: 7px;
  }

  .popup-watch-controls {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 30px;
  }

  .popup-watch-mode-switch {
    width: 176px;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
      rgba(8, 13, 18, 0.64);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
  }

  .popup-watch-mode-switch button {
    min-height: 25px;
    border: 0;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.52);
    cursor: pointer;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .popup-watch-mode-switch button strong {
    min-width: 16px;
    height: 16px;
    display: inline-grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.46);
    font-size: 8.8px;
    line-height: 1;
  }

  .popup-watch-mode-switch button[data-active="true"] {
    background:
      linear-gradient(135deg, rgba(255, 159, 45, 0.13), rgba(255, 122, 26, 0.06)),
      rgba(255, 159, 45, 0.055);
    color: #ffc453;
    box-shadow:
      inset 0 0 0 1px rgba(255, 180, 69, 0.12),
      0 4px 10px rgba(255, 122, 26, 0.045);
  }

  .popup-watch-mode-switch button[data-active="true"] strong {
    background: rgba(255, 159, 45, 0.14);
    color: #ffc453;
  }

  .popup-together-filter {
    position: relative;
    z-index: 10;
    flex: 0 0 auto;
    justify-self: end;
  }

  .popup-filter-trigger {
    max-width: 136px;
    min-height: 30px;
    border: 1px solid rgba(255, 180, 69, 0.12);
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 9px;
    background:
      linear-gradient(135deg, rgba(255, 159, 45, 0.085), rgba(255, 255, 255, 0.014)),
      rgba(11, 16, 22, 0.66);
    color: #ffc453;
    cursor: pointer;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .popup-filter-trigger span {
    min-width: 0;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .popup-filter-trigger strong {
    min-width: 16px;
    height: 16px;
    display: inline-grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    font-size: 8.8px;
    line-height: 1;
  }

  .popup-filter-menu {
    position: absolute;
    top: calc(100% + 7px);
    right: 0;
    width: min(292px, calc(100vw - 28px));
    max-height: 320px;
    overflow-y: auto;
    padding: 7px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(145deg, rgba(21, 28, 37, 0.99), rgba(8, 12, 18, 0.99)),
      #10151d;
    box-shadow:
      0 18px 42px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }

  .popup-filter-section {
    display: grid;
    gap: 4px;
  }

  .popup-filter-section + .popup-filter-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .popup-filter-section-title {
    padding: 2px 6px 4px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 9.5px;
    font-weight: 860;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .popup-filter-option {
    min-width: 0;
    min-height: 42px;
    width: 100%;
    border: 0;
    border-radius: 11px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 8px;
    padding: 6px 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
    text-align: left;
  }

  .popup-filter-option:hover,
  .popup-filter-option:focus-visible {
    background: rgba(255, 255, 255, 0.045);
    outline: none;
  }

  .popup-filter-option[data-active="true"] {
    background: rgba(255, 159, 45, 0.12);
    color: #ffc453;
  }

  .popup-filter-option > svg:last-child {
    opacity: 0;
    color: #ffc453;
  }

  .popup-filter-option[data-active="true"] > svg:last-child {
    opacity: 1;
  }

  .popup-filter-option-icon,
  .popup-companion-avatar {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .popup-filter-option-icon {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.64);
  }

  .popup-filter-option-copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .popup-filter-option-copy span,
  .popup-filter-option-copy small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-filter-option-copy span {
    font-size: 11px;
    font-weight: 820;
  }

  .popup-filter-option-copy small {
    color: rgba(255, 255, 255, 0.46);
    font-size: 9.5px;
    font-weight: 680;
  }

  .popup-filter-empty {
    padding: 7px 6px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 10.5px;
    font-weight: 680;
  }

  .popup-resource-list {
    gap: 7px;
  }

  .popup-provider {
    overflow: hidden;
    border-radius: 14px;
    border-color: rgba(255, 255, 255, 0.085);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.012)),
      rgba(9, 14, 20, 0.92);
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.045);
  }

  .popup-provider-row {
    min-height: 54px;
    grid-template-columns: 36px minmax(0, 1fr) 28px;
    gap: 9px;
    padding: 9px 10px;
  }

  .resource-provider-logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .resource-provider-logo.crunchyroll > span {
    width: 24px;
    height: 24px;
    border-width: 6px;
  }

  .popup-provider-name {
    font-size: 15px;
  }

  .popup-provider-meta,
  .popup-watch-meta {
    font-size: 10.8px;
    color: rgba(255, 255, 255, 0.56);
  }

  .popup-provider-chevron {
    width: 28px;
    height: 28px;
  }

  .popup-provider-body {
    gap: 4px;
    padding: 6px 8px 8px;
  }

  .popup-watch-row {
    min-height: 68px;
    grid-template-columns: 42px minmax(0, 1fr) 22px;
    gap: 9px;
    padding: 7px 6px;
    border-radius: 11px;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
  }

  .popup-watch-item[data-kind="series"] .popup-watch-row {
    min-height: 72px;
    padding: 7px 6px;
    background: transparent;
  }

  .popup-watch-row:hover,
  .popup-watch-item[data-kind="series"] .popup-watch-row:hover {
    border-color: rgba(255, 255, 255, 0.075);
    background: rgba(255, 255, 255, 0.035);
    transform: none;
  }

  .popup-watch-artwork {
    width: 42px;
    height: 58px;
    border-radius: 9px;
  }

  .popup-watch-title {
    font-size: 13px;
  }

  .popup-watch-main {
    gap: 5px;
  }

  .popup-series-summary {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    align-items: center;
    gap: 8px;
  }

  .popup-series-progress {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 31px;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 10.5px;
    font-weight: 720;
  }

  .popup-progress-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.11);
    overflow: hidden;
  }

  .popup-progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff7a1a, #ffb02e);
  }

  .popup-series-context {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 10.5px;
    font-weight: 720;
  }

  .popup-series-context > span:last-child {
    max-width: 92px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-mode-badge {
    min-height: 18px;
    padding: 0 7px;
    font-size: 9.5px;
  }

  .popup-episode-list {
    gap: 5px;
    padding-left: 0;
  }

  .popup-episode-row {
    min-height: 62px;
    padding: 7px 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.032);
  }

  .popup-episode-row[data-selected="true"] {
    min-height: 64px;
    border-color: rgba(255, 159, 45, 0.3);
    background:
      linear-gradient(120deg, rgba(255, 159, 45, 0.08), rgba(255, 255, 255, 0.026)),
      rgba(14, 18, 24, 0.88);
  }

  .popup-episode-number {
    color: #ffc453;
    font-size: 12px;
  }

  .popup-episode-title {
    font-size: 11.5px;
  }

  .shared-progress-track {
    height: 28px;
  }

  .shared-progress.compact .shared-progress-track {
    height: 28px;
  }

  .shared-progress-marker {
    top: 23px;
  }

  .shared-progress.compact .shared-progress-marker {
    top: 23px;
  }

  .shared-progress-base::before {
    background: linear-gradient(90deg, rgba(255, 122, 26, 0.42), rgba(255, 176, 46, 0.5));
  }

  .shared-progress-segment.friends::before {
    background: linear-gradient(90deg, #ff7a1a, #ffb02e);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.22);
  }

  .shared-progress-segment.solo::before {
    background: linear-gradient(90deg, #34d399, #60a5fa);
  }

  .popup-session-summary {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }

  .popup-session-summary-action {
    border-color: rgba(255, 180, 69, 0.2);
    background: rgba(255, 159, 45, 0.12);
    color: #ffc453;
  }

  .popup-quiet-danger {
    margin-top: 2px;
  }

  /*
   * Final compact-library pass.
   * Keep controls obvious, but stop treating every row as a large capsule.
   * Active state = text color + subtle fill; content = flat lists.
   */
  body {
    width: 392px;
    height: 600px;
    min-height: 600px;
    max-height: 600px;
    background: #070b0f;
  }

  .popup-shell {
    height: 600px;
    min-height: 600px;
    max-height: 600px;
    padding: 12px 12px 10px;
    background:
      radial-gradient(circle at -8% -7%, rgba(255, 122, 26, 0.16), transparent 30%),
      radial-gradient(circle at 108% 10%, rgba(87, 145, 255, 0.08), transparent 34%),
      linear-gradient(150deg, #080d12 0%, #0c1218 48%, #070b0f 100%);
  }

  .popup-topbar {
    margin-bottom: 10px;
  }

  .popup-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    justify-items: stretch;
    gap: 0;
    margin: 0 0 14px;
    padding: 0 2px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .popup-tab {
    position: relative;
    min-height: 32px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    box-shadow: none;
    gap: 6px;
    padding: 0 8px;
    font-size: 11.5px;
    font-weight: 780;
    letter-spacing: 0;
    transition:
      color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .popup-tab::after {
    display: none;
  }

  .popup-tab:first-child::after {
    display: none;
  }

  .popup-tab:first-child {
    border-radius: 9px;
  }

  .popup-tab:last-child {
    border-radius: 9px;
  }

  .popup-tab:hover,
  .popup-tab:focus-visible {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.014)),
      rgba(255, 255, 255, 0.018);
    color: rgba(255, 255, 255, 0.82);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
    outline: none;
  }

  .popup-tab[data-active="true"] {
    border: 0;
    background: transparent;
    color: #ffc453;
    box-shadow: none;
    font-weight: 860;
  }

  .popup-tab[data-active="true"]:hover,
  .popup-tab[data-active="true"]:focus-visible {
    background: rgba(255, 159, 45, 0.055);
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.13);
  }

  .popup-tab[data-active="true"]::after {
    display: none;
  }

  .popup-tab:first-child[data-active="true"]::after {
    display: none;
  }

  .popup-tab span {
    display: none;
  }

  .popup-tab[data-active="true"] span {
    display: none;
  }

  .popup-watch-screen {
    gap: 8px;
  }

  .popup-watch-controls {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-height: 34px;
    padding: 5px 0 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  }

  .popup-watch-mode-switch {
    width: 160px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-self: start;
    gap: 0;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.022);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .popup-watch-mode-switch button {
    position: relative;
    min-height: 28px;
    border: 0;
    border-radius: 0;
    gap: 5px;
    padding: 0 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.52);
    box-shadow: none;
    font-size: 11px;
    font-weight: 800;
    transition:
      color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .popup-watch-mode-switch button:first-child {
    border-radius: 7px 0 0 7px;
  }

  .popup-watch-mode-switch button:last-child {
    border-left: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 0 7px 7px 0;
  }

  .popup-watch-mode-switch button::after {
    display: none;
  }

  .popup-watch-mode-switch button:hover,
  .popup-watch-mode-switch button:focus-visible {
    background: rgba(255, 255, 255, 0.035);
    color: rgba(255, 255, 255, 0.82);
    box-shadow: none;
    outline: none;
  }

  .popup-watch-mode-switch button[data-active="true"] {
    background: rgba(255, 159, 45, 0.075);
    color: #ffc453;
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.09);
    font-weight: 880;
  }

  .popup-watch-mode-switch button[data-active="true"]:hover,
  .popup-watch-mode-switch button[data-active="true"]:focus-visible {
    background: rgba(255, 159, 45, 0.105);
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.14);
  }

  .popup-watch-mode-switch button[data-active="true"]::after {
    display: none;
  }

  .popup-watch-mode-switch button strong {
    display: none;
  }

  .popup-watch-mode-switch button[data-active="true"] strong {
    display: none;
  }

  .popup-filter-trigger {
    width: 74px;
    max-width: 74px;
    min-height: 28px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 9px;
    padding: 0 8px;
    background: rgba(255, 255, 255, 0.022);
    color: rgba(255, 255, 255, 0.68);
    box-shadow: none;
    font-size: 10px;
    transition:
      color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .popup-filter-trigger:hover,
  .popup-filter-trigger:focus-visible,
  .popup-filter-trigger[aria-expanded="true"] {
    border-color: rgba(255, 180, 69, 0.13);
    background: rgba(255, 159, 45, 0.06);
    color: #ffc453;
    box-shadow: none;
    outline: none;
  }

  .popup-filter-trigger strong {
    display: none;
  }

  .popup-filter-menu {
    width: min(300px, calc(100vw - 24px));
    border-radius: 10px;
    background:
      linear-gradient(180deg, rgba(18, 25, 33, 0.99), rgba(8, 12, 17, 0.99)),
      #0d1218;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.48);
  }

  .popup-filter-option {
    min-height: 40px;
    border-radius: 8px;
  }

  .popup-filter-option[data-active="true"] {
    background: rgba(255, 159, 45, 0.09);
  }

  .popup-resource-list {
    gap: 7px;
  }

  .popup-provider {
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.026), rgba(255, 255, 255, 0.01)),
      rgba(9, 14, 20, 0.84);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  }

  .popup-provider-row {
    min-height: 54px;
    grid-template-columns: 34px minmax(0, 1fr) 26px;
    gap: 9px;
    padding: 9px 9px;
    background: transparent;
  }

  .popup-provider-row:hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .resource-provider-logo {
    width: 34px;
    height: 34px;
    border-radius: 8px;
  }

  .resource-provider-logo.crunchyroll > span {
    width: 23px;
    height: 23px;
  }

  .popup-provider-chevron {
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .popup-provider-body {
    position: relative;
    gap: 0;
    padding: 0 9px 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.065);
  }

  .popup-provider-body::before {
    display: none;
  }

  .popup-kind-tabs {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 142px;
    gap: 0;
    margin: 8px 0 2px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.022);
  }

  .popup-kind-tab {
    min-height: 24px;
    border: 0;
    border-radius: 0;
    padding: 0 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.48);
    font-size: 10px;
    font-weight: 760;
    transition:
      color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .popup-kind-tab:first-child {
    border-radius: 6px 0 0 6px;
  }

  .popup-kind-tab:last-child {
    border-left: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 0 6px 6px 0;
  }

  .popup-kind-tab:hover,
  .popup-kind-tab:focus-visible {
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.78);
    box-shadow: none;
    outline: none;
  }

  .popup-kind-tab[data-active="true"] {
    border: 0;
    background: rgba(255, 159, 45, 0.075);
    color: #ffc453;
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.09);
    font-weight: 840;
  }

  .popup-kind-tab[data-active="true"]:hover,
  .popup-kind-tab[data-active="true"]:focus-visible {
    background: rgba(255, 159, 45, 0.105);
    box-shadow: inset 0 0 0 1px rgba(255, 180, 69, 0.13);
  }

  .popup-kind-tab span,
  .popup-kind-tab[data-active="true"] span {
    display: none;
  }

  .popup-watch-item {
    position: relative;
    border-top: 1px solid rgba(255, 255, 255, 0.045);
  }

  .popup-watch-item::before,
  .popup-watch-item::after {
    display: none;
  }

  .popup-watch-item::before {
    top: 35px;
    left: -12px;
    width: 12px;
    height: 1px;
    background: rgba(255, 255, 255, 0.11);
  }

  .popup-watch-item::after {
    top: 32px;
    left: -15px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    box-shadow: 0 0 0 3px rgba(9, 14, 20, 0.92);
  }

  .popup-watch-item:has(.popup-episode-list)::after {
    background: rgba(255, 159, 45, 0.72);
    box-shadow:
      0 0 0 3px rgba(9, 14, 20, 0.92),
      0 0 12px rgba(255, 122, 26, 0.22);
  }

  .popup-watch-item:first-of-type {
    border-top: 0;
  }

  .popup-provider-body > .popup-watch-item:first-child,
  .popup-kind-tabs + .popup-watch-item {
    border-top: 0;
  }

  .popup-watch-row,
  .popup-watch-item[data-kind="series"] .popup-watch-row {
    min-height: 70px;
    grid-template-columns: 42px minmax(0, 1fr) 20px;
    gap: 10px;
    padding: 8px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .popup-watch-row:hover,
  .popup-watch-item[data-kind="series"] .popup-watch-row:hover {
    border: 0;
    background: rgba(255, 255, 255, 0.025);
    box-shadow: 0 0 0 999px rgba(255, 255, 255, 0.025);
    clip-path: inset(0 -9px);
  }

  .popup-watch-artwork {
    width: 42px;
    height: 58px;
    border-radius: 7px;
  }

  .popup-watch-title {
    font-size: 13px;
    line-height: 1.18;
  }

  .popup-watch-meta,
  .popup-provider-meta {
    font-size: 10.5px;
  }

  .popup-series-summary {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
  }

  .popup-mode-badge {
    min-height: auto;
    border-radius: 0;
    padding: 0;
    background: transparent;
    font-size: 9.5px;
    box-shadow: none;
  }

  .popup-mode-badge[data-mode="solo"],
  .popup-mode-badge[data-mode="together"],
  .popup-mode-badge[data-mode="group"] {
    background: transparent;
  }

  .popup-season-list {
    display: grid;
    gap: 0;
    padding: 0 0 4px;
  }

  .popup-season-group {
    position: relative;
    display: grid;
    gap: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.045);
  }

  .popup-season-group:first-child {
    border-top: 0;
  }

  .popup-season-header {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    min-height: 32px;
    padding: 6px 4px 5px 36px;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.76);
    cursor: pointer;
    text-align: left;
  }

  .popup-season-header:hover {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.032), transparent 68%);
  }

  .popup-season-main {
    display: flex;
    align-items: baseline;
    min-width: 0;
    gap: 8px;
  }

  .popup-season-title {
    color: #ffc453;
    font-size: 11.5px;
    font-weight: 900;
    line-height: 1.1;
  }

  .popup-season-meta {
    overflow: hidden;
    color: rgba(255, 255, 255, 0.42);
    font-size: 10px;
    font-weight: 800;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popup-season-chevron {
    display: inline-grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.5);
    transition: transform 140ms ease, color 140ms ease;
  }

  .popup-season-chevron[data-open="true"] {
    color: rgba(255, 196, 83, 0.86);
    transform: rotate(180deg);
  }

  .popup-episode-list,
  .popup-season-episode-list {
    --series-artwork-size: 42px;
    --episode-tree-axis: calc(var(--series-artwork-size) / 2);
    --episode-branch-size: 14px;
    position: relative;
    display: grid;
    gap: 0;
    margin-left: 0;
    padding: 1px 0 4px calc(var(--episode-tree-axis) + var(--episode-branch-size));
  }

  .popup-episode-list::before,
  .popup-season-episode-list::before {
    content: "";
    position: absolute;
    top: 8px;
    bottom: 12px;
    left: var(--episode-tree-axis);
    width: 1px;
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 0.095) 14%,
        rgba(255, 255, 255, 0.1) 72%,
        rgba(255, 255, 255, 0)
      );
    pointer-events: none;
  }

  .popup-episode-row {
    position: relative;
    min-height: 44px;
    padding: 6px 0;
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.042);
    border-radius: 0;
    background: transparent;
  }

  .popup-episode-row::before,
  .popup-episode-row::after {
    content: "";
    position: absolute;
    pointer-events: none;
  }

  .popup-episode-row::before {
    top: 21px;
    left: calc(0px - var(--episode-branch-size));
    width: var(--episode-branch-size);
    height: 1px;
    background: rgba(255, 255, 255, 0.09);
  }

  .popup-episode-row::after {
    display: block;
    top: 19px;
    left: calc(0px - var(--episode-branch-size) - 2px);
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 0 2px rgba(9, 14, 20, 0.92);
  }

  .popup-episode-row:hover {
    background: rgba(255, 255, 255, 0.025);
    box-shadow: 0 0 0 999px rgba(255, 255, 255, 0.025);
    clip-path: inset(0 -9px 0 calc(0px - var(--episode-branch-size) - 3px));
  }

  .popup-episode-row[data-selected="true"] {
    min-height: 46px;
    border-color: rgba(255, 159, 45, 0.2);
    background:
      linear-gradient(90deg, rgba(255, 159, 45, 0.045), transparent 38%),
      transparent;
  }

  .popup-episode-row[data-selected="true"]::before {
    height: 2px;
    background: rgba(255, 159, 45, 0.62);
  }

  .popup-episode-row[data-selected="true"]::after {
    display: block;
    top: 18px;
    left: calc(0px - var(--episode-branch-size) - 3px);
    width: 6px;
    height: 6px;
    background: #ff9f2d;
    box-shadow:
      0 0 0 2px rgba(9, 14, 20, 0.94),
      0 0 9px rgba(255, 122, 26, 0.28);
  }

  .popup-episode-row[data-selected="true"] .popup-episode-number,
  .popup-episode-row[data-selected="true"] .popup-episode-title {
    color: #ffc453;
  }

  .popup-episode-main {
    gap: 3px;
  }

  .popup-episode-header {
    gap: 6px;
  }

  .popup-episode-number {
    min-width: 20px;
    color: #ffc453;
    font-size: 11.5px;
    line-height: 1.05;
  }

  .popup-episode-title {
    font-size: 11.5px;
    line-height: 1.1;
  }

  .popup-episode-row .shared-progress,
  .popup-episode-row .shared-progress.compact {
    padding-top: 1px;
  }

  .popup-episode-row .shared-progress-track,
  .popup-episode-row .shared-progress.compact .shared-progress-track {
    height: 18px;
  }

  .popup-episode-row .shared-progress-track::before,
  .popup-episode-row .shared-progress.compact .shared-progress-track::before,
  .popup-episode-row .shared-progress-base::before,
  .popup-episode-row .shared-progress-segment::before {
    top: 6px;
    height: 4px;
  }

  .popup-episode-row .shared-progress-base,
  .popup-episode-row .shared-progress-segment,
  .popup-episode-row .shared-progress.compact .shared-progress-base,
  .popup-episode-row .shared-progress.compact .shared-progress-segment {
    height: 16px;
  }

  .popup-episode-row .shared-progress-marker,
  .popup-episode-row .shared-progress.compact .shared-progress-marker {
    top: 16px;
  }

  .popup-episode-row .shared-progress-marker.solo {
    display: none;
  }

  .popup-episode-row .shared-progress-marker::before {
    top: -12px;
    height: 10px;
    background: rgba(255, 255, 255, 0.18);
  }

  .popup-episode-row .shared-progress.compact .shared-avatar {
    width: 15px;
    height: 15px;
    border-width: 1.5px;
    font-size: 6px;
  }

  .popup-session-summary-action {
    border-radius: 8px;
    box-shadow: none;
  }

  .popup-section {
    gap: 10px;
  }

  .popup-section-header {
    min-height: 32px;
    margin: 0;
    padding: 0 2px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.085);
  }

  .popup-section-title {
    color: rgba(255, 255, 255, 0.62);
    font-size: 10.5px;
    font-weight: 840;
    letter-spacing: 0.12em;
  }

  .popup-social-list {
    gap: 10px;
  }

  .popup-social-block {
    overflow: hidden;
    gap: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(10, 15, 21, 0.76);
  }

  .popup-social-heading {
    min-height: 34px;
    padding: 0 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.065);
  }

  .popup-social-row,
  .popup-inbox-card {
    min-height: 54px;
    border: 0;
    border-radius: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
    background: transparent;
    box-shadow: none;
  }

  .popup-social-heading + .popup-social-row,
  .popup-social-heading + .popup-empty,
  .popup-social-heading + .popup-group-create-form {
    border-top: 0;
  }

  .popup-social-row:hover,
  .popup-inbox-card:hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .popup-group-create-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 9px 10px;
    border-top: 0;
    background: transparent;
  }

  .popup-group-name-input,
  .popup-group-select {
    min-height: 34px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
    box-shadow: none;
  }

  .popup-group-card {
    border: 0;
    border-radius: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: transparent;
    box-shadow: none;
  }

  .popup-group-header {
    min-height: 58px;
    padding: 9px 10px;
  }

  .popup-social-group-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(255, 159, 45, 0.13);
    color: #ffc453;
  }

  .popup-group-actions {
    gap: 5px;
  }

  .popup-group-member-list {
    margin: 0 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .popup-group-member-row {
    min-height: 38px;
    border: 0;
    border-radius: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.045);
    background: transparent;
  }

  .popup-group-member-row:first-child {
    border-top: 0;
  }

  .popup-group-add-row {
    padding: 8px 10px 10px;
  }

  .popup-mini-button {
    width: 30px;
    min-height: 30px;
    border-radius: 8px;
    box-shadow: none;
  }

  .popup-primary-button,
  .popup-secondary-button,
  .popup-dashboard-button {
    min-height: 34px;
    border-radius: 8px;
    box-shadow: none;
  }

  .popup-dashboard-button {
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.72);
  }

  .popup-social-empty,
  .popup-empty {
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.035);
    box-shadow: none;
  }

  .popup-quiet-danger {
    min-height: 24px;
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.32);
  }

  .popup-quiet-danger:disabled {
    display: none;
  }
`;

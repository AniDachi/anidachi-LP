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

  .popup-resource-list {
    display: grid;
    gap: 8px;
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

  .popup-invite-footer {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    margin-top: 1px;
    padding: 9px 4px 1px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popup-invite-icon {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #b794ff;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popup-invite-copy {
    min-width: 0;
    display: grid;
    gap: 1px;
  }

  .popup-invite-copy span:first-child {
    color: #b794ff;
    font-size: 12px;
    font-weight: 780;
  }

  .popup-invite-copy span:last-child {
    color: rgba(255, 255, 255, 0.52);
    font-size: 10.5px;
  }

  .popup-copy-button {
    height: 30px;
    border: 1px solid rgba(167, 139, 250, 0.18);
    border-radius: 9px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(139, 92, 246, 0.16);
    color: #c4b5fd;
    cursor: pointer;
    font-size: 11px;
    font-weight: 760;
  }

  .popup-copy-button:hover {
    background: rgba(139, 92, 246, 0.24);
    color: rgba(255, 255, 255, 0.96);
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
`;

// Watch-only layout. Keep the tree independent of the title artwork column.
export const popupWatchHistoryStyles = `
  .popup-watch-screen { gap: 10px; min-width: 0; }

  .popup-watch-screen .popup-watch-controls {
    grid-template-columns: 112px minmax(0, 1fr) 32px;
    gap: 10px;
    border: 0;
    padding: 4px 0 0;
    min-height: 36px;
  }
  .popup-watch-screen .popup-watch-mode-switch { width: 112px; }
  .popup-watch-screen .popup-watch-mode-segment { font-size: 10px; }
  .popup-watch-screen .popup-watch-search { width: 100%; height: 32px; }
  .popup-watch-screen .popup-watch-search input { font-size: 11px; }
  .popup-watch-screen .popup-watch-refresh { width: 32px; min-height: 32px; padding: 0; }
  .popup-watch-screen .popup-watch-refresh > span { display: none; }
  .popup-watch-screen .popup-watch-preferences { margin: 0; min-height: 34px; }
  .popup-watch-screen .popup-watch-youtube-switch { width: 100%; padding: 0; font-size: 10.5px; font-weight: 500; }
  .popup-watch-screen .popup-watch-youtube-label { margin-right: auto; }
  .popup-watch-screen .popup-resource-list { gap: 0; }

  .popup-watch-screen .popup-provider {
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }
  .popup-watch-screen .popup-provider-row {
    min-height: 48px;
    padding: 8px 2px;
    grid-template-columns: 30px minmax(0, 1fr) 20px;
    gap: 10px;
  }
  .popup-watch-screen .resource-provider-logo { width: 30px; height: 30px; }
  .popup-watch-screen .popup-provider-main { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .popup-watch-screen .popup-provider-name { font-size: 15px; line-height: 1.25; font-weight: 700; }
  .popup-watch-screen .popup-provider-meta { font-size: 10.5px; line-height: 1.4; }
  .popup-watch-screen .popup-provider-body { padding: 0; border: 0; }
  .popup-watch-screen .popup-watch-item {
    --popup-watch-artwork-width: 40px;
    min-width: 0;
    gap: 0;
  }

  .popup-watch-screen .popup-watch-row,
  .popup-watch-screen .popup-watch-item[data-kind="series"] .popup-watch-row {
    position: relative;
    grid-template-columns: minmax(0, 1fr);
    padding: 10px 0;
    gap: 2px;
    min-height: 78px;
    background: transparent;
    box-shadow: none;
    clip-path: none;
  }
  .popup-watch-title-toggle {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 10px;
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ad-text);
    text-align: left;
    cursor: pointer;
  }
  .popup-watch-screen .popup-watch-artwork {
    width: var(--popup-watch-artwork-width);
    height: 56px;
    border-radius: 6px;
    background: var(--ad-surface);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: none;
    font-size: 18px;
    font-weight: 600;
    color: var(--ad-muted);
  }
  .popup-watch-screen .popup-watch-main { min-width: 0; gap: 4px; padding-right: 24px; }
  .popup-watch-screen .popup-watch-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: normal;
    font-size: 13px;
    line-height: 1.35;
    font-weight: 650;
  }
  .popup-watch-screen .popup-watch-meta {
    font-size: 10px;
    line-height: 1.35;
    font-weight: 450;
    color: var(--ad-muted);
  }
  .popup-watch-screen .popup-watch-overall {
    display: grid;
    gap: 4px;
    min-width: 0;
    max-width: 190px;
  }
  .popup-watch-screen .popup-watch-overall-track {
    display: block;
    width: 100%;
    height: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
  }
  .popup-watch-screen .popup-watch-overall-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--ad-accent);
  }
  .popup-watch-disclosure-icon {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.45);
    transform: rotate(-90deg);
    transition: transform 180ms ease, color 180ms ease;
  }
  [aria-expanded="true"] > .popup-watch-disclosure-icon { transform: rotate(0); }
  .popup-watch-title-toggle:hover .popup-watch-title { color: #ffcfab; }
  .popup-watch-screen .popup-watch-delete {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    opacity: 0;
    transition: opacity 140ms ease, background-color 140ms ease, color 140ms ease;
  }
  .popup-watch-row:hover > .popup-watch-delete,
  .popup-watch-row:focus-within > .popup-watch-delete,
  .popup-episode-row:hover .popup-episode-delete,
  .popup-episode-row:focus-within .popup-episode-delete { opacity: 1; }
  .popup-watch-screen .popup-watch-delete:hover { color: var(--ad-danger); background: rgba(248, 113, 113, 0.09); }
  .popup-watch-screen .popup-watch-delete:disabled { opacity: 0.3; cursor: default; }
  .popup-watch-row > .popup-watch-delete { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); }
  .popup-watch-screen button:focus-visible {
    outline: 2px solid var(--ad-accent);
    outline-offset: 2px;
  }

  .popup-watch-tree {
    min-width: 0;
    padding: 0 0 10px calc(var(--popup-watch-artwork-width) / 2);
  }
  .popup-watch-screen .popup-season-group {
    position: relative;
    border: 0;
    padding-left: 16px;
  }
  .popup-season-group::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.12);
    pointer-events: none;
  }
  .popup-season-group:last-of-type::before { bottom: auto; height: 17px; }
  .popup-watch-screen .popup-season-header {
    min-width: 0;
    min-height: 34px;
    padding: 6px 4px;
    gap: 8px;
    border-radius: 6px;
    color: var(--ad-text);
  }
  .popup-season-header::before {
    content: "";
    position: absolute;
    left: -16px;
    top: 7px;
    width: 14px;
    height: 10px;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0 0 0 7px;
    pointer-events: none;
  }
  .popup-watch-screen .popup-season-main { gap: 7px; flex-wrap: wrap; }
  .popup-watch-screen .popup-season-title {
    color: rgba(255, 255, 255, 0.82);
    font-size: 11.5px;
    line-height: 1.4;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .popup-watch-screen .popup-season-meta {
    font-size: 10px;
    line-height: 1.4;
    font-weight: 450;
    color: var(--ad-muted);
  }
  .popup-watch-screen .popup-season-episode-list {
    margin: 0 0 4px 5px;
    padding: 0 0 0 13px;
  }
  .popup-watch-screen .popup-season-episode-list::before { display: none; }
  .popup-watch-screen .popup-episode-row,
  .popup-watch-screen .popup-episode-row[data-selected="true"] {
    position: relative;
    display: block;
    min-width: 0;
    min-height: 44px;
    padding: 8px 29px 8px 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    box-shadow: none;
    clip-path: none;
    cursor: default;
  }
  .popup-watch-screen .popup-episode-row::before {
    top: 0;
    bottom: 0;
    left: -13px;
    width: 1px;
    height: auto;
    background: rgba(255, 255, 255, 0.1);
  }
  .popup-watch-screen .popup-episode-row:last-child::before { bottom: auto; height: 18px; }
  .popup-watch-screen .popup-episode-row::after {
    top: 8px;
    left: -13px;
    width: 14px;
    height: 10px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0 0 0 7px;
    background: transparent;
    box-shadow: none;
  }
  .popup-watch-screen .popup-episode-row:hover { background: rgba(255, 255, 255, 0.025); }
  .popup-watch-screen .popup-episode-row[data-selected="true"]:not([data-completed="true"]) {
    background: rgba(249, 115, 22, 0.045);
  }
  .popup-watch-screen .popup-episode-main { position: static; display: grid; gap: 6px; min-width: 0; }
  .popup-watch-screen .popup-episode-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 13px;
    align-items: baseline;
    gap: 6px;
  }
  .popup-watch-screen .popup-episode-number {
    flex: 0 0 auto;
    min-width: 17px;
    color: var(--ad-muted);
    font-size: 10.5px;
    line-height: 1.4;
    font-weight: 500;
  }
  .popup-watch-screen .popup-episode-title {
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.4;
  }
  .popup-watch-screen .popup-episode-row[data-selected="true"]:not([data-completed="true"]) .popup-episode-number {
    color: #ffad73;
  }
  .popup-watch-screen .popup-episode-row[data-selected="true"] .popup-episode-title { color: var(--ad-text); }
  .popup-watch-screen .popup-series-progress {
    grid-template-columns: minmax(0, 1fr) 7ch;
    font-size: 9px;
    line-height: 1;
    font-weight: 450;
    font-variant-numeric: tabular-nums;
  }
  .popup-watch-screen .popup-progress-track { height: 3px; background: rgba(255, 255, 255, 0.09); }
  .popup-watch-screen .popup-series-progress > span:last-child { text-align: right; }
  .popup-watch-screen .popup-progress-track > span {
    background: linear-gradient(90deg, #f97316, #ffad63);
    transition: width 180ms linear, background-color 180ms ease;
  }
  .popup-watch-screen [data-completed="true"] .popup-progress-track > span { background: rgba(255, 255, 255, 0.28); }
  .popup-episode-complete {
    display: inline-flex;
    align-self: center;
    width: 13px;
    height: 13px;
    color: var(--ad-muted);
    opacity: 0;
    transition: opacity 140ms ease;
  }
  .popup-episode-complete[data-visible="true"] { opacity: 1; }
  .popup-watch-screen .popup-episode-delete { position: absolute; top: 5px; right: 0; }
  .popup-watch-screen .popup-session-summary-action { justify-self: start; font-size: 10px; }
  .popup-watch-screen .popup-watch-slice-note { margin: 8px 4px 0 20px; color: var(--ad-muted); font-size: 10px; line-height: 1.5; }
  .popup-watch-screen > .popup-quiet-danger {
    justify-self: center;
    padding: 10px 12px;
    color: rgba(248, 113, 113, 0.7);
    font-size: 10.5px;
  }
  @media (hover: none) { .popup-watch-screen .popup-watch-delete { opacity: 0.65; } }
  @media (prefers-reduced-motion: reduce) {
    .popup-watch-screen *, .popup-watch-screen *::before, .popup-watch-screen *::after { transition: none; }
  }
`;

// Production Watch drawer: one outer scroll, cover-centered hierarchy.
export const popupWatchHistoryStyles = `
  .popup-watch-screen { gap: 8px; min-width: 0; color-scheme: dark; }
  .popup-watch-screen .popup-watch-controls { display: grid; grid-template-columns: 122px minmax(0, 1fr) auto; gap: 8px; padding: 4px 0 0; border: 0; min-height: 32px; }
  .popup-watch-screen .popup-watch-mode-switch { display: flex; width: auto; height: 32px; padding: 2px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; }
  .popup-watch-mode-switch button { min-width: 0; flex: 1; padding: 3px 7px; border: 0; border-radius: 5px; background: transparent; color: var(--ad-muted); font: inherit; font-size: 10.5px; cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
  .popup-watch-mode-switch button[aria-pressed="true"] { background: rgba(255,255,255,.1); color: var(--ad-text); }
  .popup-watch-screen .popup-watch-search { width: 100%; height: 32px; min-width: 0; }
  .popup-watch-screen .popup-watch-search input { min-width: 0; font-size: 11px; }
  .popup-watch-filter-button { display: flex; align-items: center; gap: 5px; padding: 0 8px; height: 32px; border: 1px solid rgba(255,255,255,.1); border-radius: 7px; background: transparent; color: var(--ad-text); font: inherit; font-size: 10.5px; cursor: pointer; }
  .popup-watch-filter-button[aria-expanded="true"] { background: rgba(255,255,255,.07); }
  .popup-watch-filters, .popup-watch-conditions { grid-column: 1 / -1; min-width: 0; }
  .popup-watch-filters { display: grid; gap: 9px; padding: 10px; border: 1px solid rgba(255,255,255,.09); border-radius: 8px; background: var(--ad-surface); animation: watch-filter-reveal 140ms ease-out; }
  .popup-watch-filter-fields { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; }
  .popup-watch-filters label { display: grid; min-width: 0; gap: 5px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-filters select, .popup-watch-filters input { box-sizing: border-box; width: 100%; min-width: 0; height: 30px; padding: 4px 7px; border: 1px solid rgba(255,255,255,.12); border-radius: 5px; background: #202020; color: var(--ad-text); font: inherit; font-size: 11px; }
  .popup-watch-filters p { margin: 0; color: var(--ad-muted); font-size: 10px; line-height: 1.5; }
  .popup-watch-conditions { display: flex; flex-wrap: wrap; gap: 5px; }
  .popup-watch-conditions button { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 5px; background: transparent; color: var(--ad-muted); font: inherit; font-size: 10px; cursor: pointer; }
  .popup-watch-conditions button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .popup-watch-conditions svg { flex: 0 0 auto; }
  .popup-watch-conditions .popup-watch-clear-conditions { border-color: transparent; }
  .popup-watch-status { display: flex; align-items: center; justify-content: space-between; min-height: 20px; gap: 8px; color: var(--ad-muted); font-size: 10px; }
  .popup-watch-screen .popup-watch-refresh { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; width: auto; padding: 2px 4px; font-size: 10px; }
  .popup-watch-screen .popup-resource-list { gap: 0; }
  .popup-watch-screen .popup-provider { border: 0; border-top: 1px solid rgba(255,255,255,.07); border-radius: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
  .popup-watch-screen .popup-provider-row { min-height: 42px; padding: 7px 0; grid-template-columns: 24px minmax(0,1fr) 16px; gap: 8px; }
  .popup-watch-screen .resource-provider-logo { width: 24px; height: 24px; }
  .popup-watch-screen .popup-provider-main { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; min-width: 0; }
  .popup-watch-screen .popup-provider-name { font-size: 12px; line-height: 1.4; font-weight: 650; }
  .popup-watch-screen .popup-provider-meta { font-size: 10px; line-height: 1.4; }
  .popup-watch-screen .popup-provider-body { padding: 0; border: 0; }
  .popup-watch-screen .popup-watch-item { --popup-watch-artwork-width: 44px; min-width: 0; gap: 0; border: 0; background: transparent; }
  .popup-watch-screen .popup-watch-row, .popup-watch-screen .popup-watch-item[data-kind="series"] .popup-watch-row { position: relative; display: block; padding: 10px 0; min-height: 86px; background: transparent; border: 0; box-shadow: none; clip-path: none; }
  .popup-watch-title-toggle { display: grid; grid-template-columns: var(--popup-watch-artwork-width) minmax(0,1fr) 16px; align-items: center; gap: 10px; min-width: 0; width: 100%; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--ad-text); text-align: left; cursor: pointer; }
  .popup-watch-screen .popup-watch-artwork { width: var(--popup-watch-artwork-width); height: 66px; aspect-ratio: 2 / 3; border-radius: 5px; background: var(--ad-surface); border: 1px solid rgba(255,255,255,.08); box-shadow: none; font-size: 18px; font-weight: 600; color: var(--ad-muted); align-self: end; box-sizing: border-box; }
  .popup-watch-screen .popup-watch-artwork img { width: 100%; height: 100%; object-fit: cover; }
  .popup-watch-screen .popup-watch-main { min-width: 0; gap: 5px; padding: 0; }
  .popup-watch-screen .popup-watch-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; white-space: normal; font-size: 13px; line-height: 1.35; font-weight: 650; }
  .popup-watch-screen .popup-watch-meta { font-size: 10px; line-height: 1.35; font-weight: 450; color: var(--ad-muted); }
  .popup-watch-screen .popup-watch-overall { display: grid; gap: 4px; min-width: 0; width: 100%; max-width: none; }
  .popup-watch-overall-label { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
  .popup-watch-percent { flex-shrink: 0; font-size: 10px; color: var(--ad-muted); font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-watch-overall-track { display: block; width: 100%; height: 2px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.09); }
  .popup-watch-screen .popup-watch-overall-track > span { display: block; height: 100%; border-radius: inherit; background: var(--ad-accent); }
  .popup-watch-date { color: var(--ad-muted); font-size: 9.5px; font-variant-numeric: tabular-nums; }
  .popup-watch-disclosure-icon { flex: 0 0 auto; color: rgba(255,255,255,.45); transform: rotate(-90deg); transition: transform 140ms ease; }
  [aria-expanded="true"] > .popup-watch-disclosure-icon { transform: rotate(0); }
  .popup-watch-title-toggle:hover .popup-watch-title { color: #ffcfab; }
  .popup-watch-screen button:focus-visible, .popup-watch-screen a:focus-visible, .popup-watch-screen input:focus-visible, .popup-watch-screen select:focus-visible, .popup-history-settings button:focus-visible { outline: 2px solid var(--ad-accent); outline-offset: 2px; }
  .popup-watch-tree { position: relative; min-width: 0; margin-left: calc(var(--popup-watch-artwork-width) / 2); padding: 0 0 10px 0; }
  .popup-watch-tree::before { content: ""; position: absolute; left: 0; top: -10px; bottom: 10px; width: 1px; background: rgba(255,255,255,.12); pointer-events: none; }
  .popup-watch-screen .popup-season-group { position: relative; border: 0; padding-left: 14px; }
  .popup-watch-screen .popup-season-group::before { display: none; }
  .popup-watch-screen .popup-season-header { display: flex; position: relative; align-items: center; min-width: 0; min-height: 44px; width: 100%; padding: 6px 0 6px 6px; gap: 8px; border: 0; border-radius: 5px; color: var(--ad-text); background: transparent; text-align: left; cursor: pointer; }
  .popup-season-header::before { content: ""; position: absolute; left: -14px; top: 21px; width: 14px; height: 1px; border: 0; background: rgba(255,255,255,.12); pointer-events: none; }
  .popup-watch-screen .popup-season-main { display: grid; flex: 1; grid-template-columns: auto minmax(0,1fr); align-items: baseline; min-width: 0; gap: 4px 8px; }
  .popup-season-main > .popup-watch-overall-track { grid-column: 1 / -1; }
  .popup-watch-screen .popup-season-title { color: rgba(255,255,255,.82); font-size: 11px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
  .popup-watch-screen .popup-season-meta { font-size: 9.5px; line-height: 1.4; font-weight: 450; color: var(--ad-muted); }
  .popup-watch-screen .popup-season-episode-list { margin: 0; padding: 0 0 0 6px; overflow: visible; max-height: none; }
  .popup-watch-screen .popup-season-episode-list::before { display: none; }
  .popup-watch-screen .popup-episode-row, .popup-watch-screen .popup-episode-row[data-selected="true"] { position: relative; display: block; min-width: 0; min-height: 64px; padding: 7px 0 9px 6px; border: 0; border-radius: 4px; background: transparent; box-shadow: none; clip-path: none; cursor: default; }
  .popup-watch-screen .popup-episode-row::before, .popup-watch-screen .popup-episode-row::after { display: none; }
  .popup-watch-screen .popup-episode-main { display: grid; width: 100%; min-width: 0; gap: 5px; }
  .popup-watch-screen .popup-episode-header { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .popup-watch-screen .popup-episode-number { flex: 0 0 auto; min-width: 20px; color: var(--ad-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-episode-title { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 1.4; font-weight: 450; }
  .popup-episode-complete { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; flex: 0 0 15px; color: var(--ad-muted); }
  .popup-watch-screen .popup-series-progress { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 9.5px; color: var(--ad-muted); font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-progress-track { flex: 1; height: 2px; min-width: 0; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
  .popup-watch-screen .popup-progress-track > span { display: block; height: 100%; background: var(--ad-accent); }
  .popup-episode-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
  .popup-episode-actions button, .popup-episode-actions a, .popup-watch-sessions button, .popup-watch-filters button, .popup-watch-footer button, .popup-watch-footer a, .popup-watch-slice-note button, .popup-watch-load-more { border: 0; padding: 2px 0; background: transparent; color: var(--ad-muted); font: inherit; font-size: 10px; text-decoration: none; cursor: pointer; }
  .popup-episode-actions button:first-child, .popup-episode-actions a:first-child { color: var(--ad-accent); }
  .popup-watch-pending { font-size: 9px; color: var(--ad-muted); }
  .popup-watch-sessions { display: grid; gap: 10px; padding: 8px 0 3px; }
  .popup-watch-session { display: grid; min-width: 0; gap: 4px; border-left: 1px solid rgba(255,255,255,.1); padding-left: 8px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-participants { overflow-wrap: anywhere; }
  .popup-watch-session .popup-session-summary-action { justify-self: start; color: var(--ad-text); }
  .popup-watch-slice-note { margin: 6px 0 6px 14px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-load-more { display: block; min-height: 28px; margin: 4px auto; }
  .popup-watch-footer { border-top: 1px solid rgba(255,255,255,.08); padding-top: 7px; text-align: center; }
  .popup-watch-screen button:disabled { cursor: default; opacity: .5; }
  .popup-history-settings h3, .popup-settings-section-title { margin: 4px 0 8px; color: var(--ad-text); font-size: 11px; font-weight: 600; }
  .popup-history-settings p { margin: 8px 0 12px; color: var(--ad-muted); font-size: 10px; line-height: 1.5; }
  .popup-history-settings .popup-notification-setting { width: 100%; grid-template-columns: minmax(0,1fr) 38px; }
  @keyframes watch-filter-reveal { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 350px) { .popup-watch-screen .popup-watch-controls { grid-template-columns: 112px minmax(0,1fr) 30px; gap: 6px; } .popup-watch-filter-button { padding: 0; justify-content: center; } .popup-watch-filter-button > span { display: none; } .popup-watch-screen .popup-season-main { grid-template-columns: minmax(0,1fr); } }
  @media (prefers-reduced-motion: reduce) { .popup-watch-screen *, .popup-watch-screen *::before, .popup-watch-screen *::after, .popup-history-settings * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;

// Watch drawer: compact title list and a bounded episode picker.
export const popupWatchHistoryStyles = `
  .popup-watch-screen [hidden] { display: none !important; }
  .popup-watch-screen { gap: 8px; min-width: 0; align-content: start; color-scheme: dark; }
  .popup-watch-screen .popup-watch-controls { display: grid; grid-template-columns: minmax(0, 1fr) 34px; align-items: center; gap: 8px; padding: 4px 0 8px; border: 0; min-height: 34px; }
  .popup-watch-screen .popup-watch-search { grid-template-columns: 15px minmax(0,1fr) 16px; gap: 7px; box-sizing: border-box; width: 100%; height: 34px; min-width: 0; padding: 0 10px; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; background: rgba(255,255,255,.025); box-shadow: none; color: rgba(255,255,255,.5); }
  .popup-watch-screen .popup-watch-search:hover { border-color: rgba(255,255,255,.24); }
  .popup-watch-screen .popup-watch-search:focus-within { border-color: rgba(255,174,106,.5); color: var(--ad-accent); box-shadow: 0 0 0 2px rgba(255,174,106,.08); }
  .popup-watch-screen .popup-watch-search input { min-width: 0; font-size: 11px; line-height: 1.4; }
  .popup-watch-screen .popup-watch-search input::placeholder { color: rgba(255,255,255,.45); }
  .popup-watch-screen .popup-watch-search input:focus-visible { outline: none; }
  .popup-watch-filter-button { position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 999px; background: transparent; box-shadow: none; color: rgba(255,255,255,.68); cursor: pointer; transition: color 140ms ease; }
  .popup-watch-filter-button:hover, .popup-watch-filter-button[aria-expanded="true"] { color: var(--ad-text); }
  .popup-watch-filter-button[data-active="true"] { color: var(--ad-accent); }
  .popup-watch-filter-button[data-active="true"]::after { content: ""; position: absolute; top: 5px; right: 5px; width: 4px; height: 4px; border-radius: 50%; background: var(--ad-accent); pointer-events: none; }
  .popup-watch-filters { position: fixed; z-index: 100; display: grid; box-sizing: border-box; width: 304px; min-width: 0; max-height: 360px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; gap: 10px; margin: 0; padding: 10px; border: 1px solid rgba(255,255,255,.13); border-radius: 14px; background: #181818; box-shadow: 0 14px 32px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.24); transform-origin: top right; animation: watch-filter-reveal 160ms cubic-bezier(.22, 1, .36, 1); }
  .popup-watch-filters[data-side="top"] { transform-origin: bottom right; }
  .popup-watch-filter-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .popup-watch-filter-heading strong { color: var(--ad-text); font-size: 12px; font-weight: 600; line-height: 1.4; }
  .popup-watch-filter-actions { display: flex; align-items: center; gap: 12px; }
  .popup-watch-filters .popup-watch-filter-reset { padding: 2px 0; color: var(--ad-muted); font-size: 10px; }
  .popup-watch-filters .popup-watch-filter-reset:hover:not(:disabled) { color: var(--ad-text); }
  .popup-watch-filters .popup-watch-filter-close { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--ad-muted); transition: color 140ms ease, background-color 140ms ease; }
  .popup-watch-filters .popup-watch-filter-close:hover { color: var(--ad-text); background: rgba(255,255,255,.06); }
  .popup-watch-period { min-width: 0; margin: 0; padding: 0; border: 0; }
  .popup-watch-period legend { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .popup-watch-period-options { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
  .popup-watch-filters .popup-watch-period-option { position: relative; display: block; grid-column: span 2; cursor: pointer; }
  .popup-watch-period-option:nth-last-child(-n+2) { grid-column: span 3; }
  .popup-watch-period-option input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .popup-watch-period-option span { display: flex; align-items: center; justify-content: center; box-sizing: border-box; min-height: 28px; padding: 4px 7px; border-radius: 999px; color: rgba(255,255,255,.65); background: transparent; font-size: 11px; font-weight: 500; line-height: 1.4; white-space: nowrap; transition: background-color 160ms ease, color 160ms ease; }
  .popup-watch-period-option:hover span { color: var(--ad-text); background: rgba(255,255,255,.07); }
  .popup-watch-period-option input:checked + span { color: #171411; background: #eee6dc; font-weight: 600; }
  .popup-watch-period-option input:focus-visible + span { outline: 2px solid var(--ad-accent); outline-offset: 2px; }
  .popup-watch-filter-people { display: grid; gap: 6px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.08); }
  .popup-watch-filter-fields { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; }
  .popup-watch-filters label { display: grid; min-width: 0; gap: 6px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-filter-select { position: relative; display: block; min-width: 0; }
  .popup-watch-filter-select > svg { position: absolute; top: 9px; right: 10px; pointer-events: none; color: var(--ad-muted); }
  .popup-watch-filters select, .popup-watch-filters input:not([type="radio"]) { box-sizing: border-box; width: 100%; min-width: 0; height: 32px; padding: 5px 9px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(255,255,255,.035); color: var(--ad-text); font: inherit; font-size: 11px; transition: border-color 140ms ease, background-color 140ms ease; }
  .popup-watch-filters select { appearance: none; padding-right: 28px; text-overflow: ellipsis; cursor: pointer; }
  .popup-watch-filters select option { background: #202020; color: var(--ad-text); }
  .popup-watch-filters select:hover, .popup-watch-filters input:not([type="radio"]):hover { border-color: rgba(255,255,255,.2); }
  .popup-watch-filters input[aria-invalid="true"] { border-color: #d58c82; }
  .popup-watch-filters p { margin: 0; color: var(--ad-muted); font-size: 10px; line-height: 1.5; }
  .popup-watch-filters p[role="alert"] { color: #e8a69c; }
  .popup-watch-status { display: flex; align-items: center; justify-content: space-between; min-height: 20px; gap: 8px; color: var(--ad-muted); font-size: 10px; }
  .popup-watch-screen .popup-watch-refresh { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; width: auto; padding: 2px 4px; font-size: 10px; }
  .popup-watch-screen .popup-resource-list { gap: 6px; }
  .popup-watch-screen .popup-provider { overflow: visible; border: 0; border-radius: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
  .popup-watch-screen .popup-provider-row { min-height: 48px; padding: 8px 0; grid-template-columns: 44px minmax(0,1fr) 24px; gap: 10px; border-radius: 10px; background: transparent; transition: background-color 160ms ease; }
  .popup-watch-screen .popup-provider-row:hover { background: rgba(255,255,255,.035); }
  .popup-watch-screen .popup-provider-row:focus-visible { outline: 2px solid var(--ad-accent); outline-offset: -2px; }
  .popup-watch-screen .resource-provider-logo { display: grid; place-items: center; justify-self: center; width: 38px; height: 38px; }
  .popup-watch-screen .resource-provider-logo svg { width: 36px; height: 36px; filter: none; }
  .popup-watch-screen .popup-provider-main { display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; min-width: 0; }
  .popup-watch-screen .popup-provider-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; line-height: 1.4; font-weight: 600; }
  .popup-watch-screen .popup-provider-count { flex: 0 0 auto; align-self: flex-start; margin-top: 1px; margin-left: -3px; color: var(--ad-accent); font-size: 10px; line-height: 1; font-weight: 600; font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-provider-body { gap: 8px; padding: 0; border: 0; }
  .popup-watch-screen .popup-provider-body > .popup-watch-item { --popup-watch-artwork-width: 52px; min-width: 0; gap: 0; border: 1px solid rgba(238,230,220,.065); border-radius: 14px; background: transparent; transition: border-color 180ms ease; }
  .popup-watch-screen .popup-watch-item[data-open="true"] { border-color: rgba(238,230,220,.11); }
  .popup-watch-screen .popup-watch-item:focus-within { border-color: rgba(238,230,220,.18); }
  .popup-watch-screen .popup-watch-row, .popup-watch-screen .popup-watch-item[data-kind="series"] .popup-watch-row { position: relative; display: block; box-sizing: border-box; padding: 10px; min-height: 0; background: transparent; border: 0; box-shadow: none; clip-path: none; }
  .popup-watch-title-toggle { display: grid; grid-template-columns: var(--popup-watch-artwork-width) minmax(0,1fr) 24px; align-items: start; gap: 10px; min-width: 0; width: 100%; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--ad-text); text-align: left; cursor: pointer; }
  .popup-watch-screen .popup-watch-artwork { width: var(--popup-watch-artwork-width); height: 78px; aspect-ratio: 2 / 3; border-radius: 6px; background: var(--ad-surface); border: 1px solid rgba(255,255,255,.08); box-shadow: none; font-size: 18px; font-weight: 600; color: var(--ad-muted); align-self: start; box-sizing: border-box; }
  .popup-watch-screen .popup-watch-artwork img { width: 100%; height: 100%; object-fit: cover; }
  .popup-watch-screen .popup-watch-main { display: flex; flex-direction: column; min-width: 0; gap: 6px; padding: 0; }
  .popup-watch-screen .popup-watch-title { display: block; min-width: 0; overflow-wrap: anywhere; white-space: normal; text-overflow: clip; font-size: 14px; line-height: 1.4; font-weight: 600; }
  .popup-watch-screen .popup-watch-meta { min-width: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; font-size: 11px; line-height: 1.35; font-weight: 450; color: var(--ad-muted); }
  .popup-watch-screen .popup-watch-overall { display: grid; gap: 5px; min-width: 0; width: 100%; max-width: none; }
  .popup-watch-overall-label { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
  .popup-watch-percent { flex-shrink: 0; font-size: 10px; font-weight: 500; color: rgba(238,230,220,.76); font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-watch-overall-track { display: block; width: 100%; height: 3px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.07); }
  .popup-watch-screen .popup-watch-overall-track > span { display: block; height: 100%; border-radius: inherit; background: var(--ad-accent); transition: width 240ms ease; }
  .popup-watch-pending { color: rgba(255,255,255,.48); font-size: 9.5px; line-height: 1.4; }
  .popup-watch-disclosure-icon { flex: 0 0 auto; color: rgba(255,255,255,.45); transform: rotate(-90deg); transition: transform 140ms ease; }
  [aria-expanded="true"] > .popup-watch-disclosure-icon { transform: rotate(0); }
  .popup-watch-title-toggle > .popup-watch-disclosure-icon { justify-self: center; margin-top: 2px; }
  .popup-watch-title-toggle:hover .popup-watch-title { color: var(--ad-text); }
  .popup-watch-title-toggle:hover .popup-watch-disclosure-icon { color: var(--ad-text); }
  .popup-watch-screen button:focus-visible, .popup-watch-screen a:focus-visible, .popup-watch-screen input:focus-visible, .popup-watch-screen select:focus-visible, .popup-history-settings button:focus-visible { outline: 2px solid var(--ad-accent); outline-offset: 2px; }
  .popup-watch-tree { position: relative; min-width: 0; margin-left: calc(var(--popup-watch-artwork-width) / 2); padding: 0 0 4px; }
  .popup-watch-tree::before { display: none; }
  .popup-watch-screen .popup-season-group { position: relative; min-width: 0; border: 0; padding: 0 0 2px 24px; }
  .popup-watch-screen .popup-season-group::before { content: ""; display: block; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: #292929; pointer-events: none; }
  .popup-watch-screen .popup-season-group:last-of-type::before { display: none; }
  .popup-watch-screen .popup-season-header { display: grid; position: relative; grid-template-columns: minmax(0,1fr) 24px; align-items: start; min-width: 0; min-height: 32px; width: 100%; padding: 6px 0; gap: 10px; border: 0; border-radius: 6px; color: var(--ad-text); background: transparent; text-align: left; cursor: pointer; }
  .popup-season-header::before { content: ""; position: absolute; box-sizing: border-box; left: -24px; top: 0; width: 16px; height: 16px; border: 0; border-left: 1px solid #292929; border-bottom: 1px solid #292929; border-bottom-left-radius: 8px; background: transparent; pointer-events: none; }
  .popup-season-group:first-of-type > .popup-season-header::before { top: -8px; height: 24px; }
  .popup-season-header > .popup-watch-disclosure-icon { justify-self: center; margin-top: 2px; }
  .popup-watch-screen .popup-season-main { display: grid; grid-template-columns: minmax(0,1fr); min-width: 0; gap: 4px; }
  .popup-season-progress { display: grid; min-width: 0; gap: 3px; }
  .popup-watch-screen .popup-season-progress .popup-watch-overall-track { height: 2px; }
  .popup-watch-screen .popup-season-title { min-width: 0; color: rgba(255,255,255,.86); font-size: 12px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; white-space: normal; }
  .popup-season-header:hover .popup-season-title, .popup-season-header:hover .popup-watch-disclosure-icon { color: var(--ad-text); }
  .popup-watch-screen .popup-season-meta { min-width: 0; overflow-wrap: anywhere; font-size: 10px; line-height: 1.4; font-weight: 450; font-variant-numeric: tabular-nums; color: var(--ad-muted); }
  .popup-watch-screen .popup-season-episode-list { margin: 0; padding: 0 0 2px; min-width: 0; overflow: visible; max-height: none; }
  .popup-watch-screen .popup-season-episode-list::before { display: none; }
  .popup-watch-screen .popup-episode-row { position: relative; display: block; min-width: 0; min-height: 0; padding: 3px 0 6px 20px; border: 0; border-radius: 4px; background: transparent; box-shadow: none; clip-path: none; cursor: default; }
  .popup-watch-screen .popup-episode-row::before, .popup-watch-screen .popup-episode-row::after { display: none; }
  .popup-watch-tree > .popup-episode-row { margin-left: 24px; }
  .popup-watch-screen .popup-season-episode-list > .popup-episode-row::before { content: ""; display: block; position: absolute; left: 4px; top: 0; bottom: 0; width: 1px; height: auto; background: #292929; pointer-events: none; }
  .popup-watch-screen .popup-season-episode-list > .popup-episode-row:last-child::before { display: none; }
  .popup-watch-screen .popup-season-episode-list > .popup-episode-row::after { content: ""; display: block; position: absolute; box-sizing: border-box; left: 4px; top: 0; width: 10px; height: 16px; border-left: 1px solid #292929; border-bottom: 1px solid #292929; border-radius: 0 0 0 6px; background: transparent; box-shadow: none; pointer-events: none; }
  .popup-watch-screen .popup-season-episode-list > .popup-episode-row[data-selected="true"]::after { border-bottom-color: var(--ad-accent); }
  .popup-watch-screen .popup-episode-main { display: grid; width: 100%; min-width: 0; gap: 1px; }
  .popup-watch-screen .popup-episode-header { display: grid; grid-template-columns: minmax(24px,max-content) minmax(0,1fr) 26px; align-items: start; gap: 6px; min-width: 0; }
  .popup-watch-screen .popup-episode-number { min-width: 0; padding-top: 2px; white-space: nowrap; color: var(--ad-muted); font-size: 10px; line-height: 1.8; font-weight: 550; font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-episode-title { min-width: 0; padding-top: 2px; overflow-wrap: anywhere; white-space: normal; color: rgba(255,255,255,.8); font-size: 12px; line-height: 1.5; font-weight: 450; }
  .popup-watch-screen .popup-episode-row[data-selected="true"] .popup-episode-number { color: var(--ad-accent); }
  .popup-watch-screen .popup-episode-row[data-selected="true"] .popup-episode-title { color: var(--ad-text); }
  .popup-watch-screen .popup-episode-resume { display: grid; place-items: center; width: 26px; height: 26px; min-height: 0; padding: 0; border: 0; border-radius: 6px; background: transparent; color: rgba(238,230,220,.55); cursor: pointer; transition: color 140ms ease; }
  .popup-watch-screen .popup-episode-row[data-selected="true"] .popup-episode-resume { color: var(--ad-accent); }
  .popup-watch-screen .popup-episode-resume:hover, .popup-watch-screen .popup-episode-resume:focus-visible { color: var(--ad-text); }
  .popup-episode-time { display: inline-flex; align-items: center; flex: 0 0 auto; gap: 4px; white-space: nowrap; }
  .popup-episode-complete { display: inline-flex; align-items: center; color: var(--ad-muted); }
  .popup-watch-screen .popup-series-progress { display: flex; align-items: center; gap: 8px; margin: 0 0 0 30px; min-width: 0; font-size: 9.5px; font-weight: 450; color: var(--ad-muted); font-variant-numeric: tabular-nums; }
  .popup-watch-screen .popup-progress-track { flex: 1; height: 2px; min-width: 0; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
  .popup-watch-screen .popup-progress-track > span { display: block; height: 100%; border-radius: inherit; background: var(--ad-accent); transition: width 240ms ease; }
  .popup-watch-screen .popup-episode-row[data-completed="true"] .popup-progress-track > span { background: rgba(238,230,220,.28); }
  .popup-episode-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-left: 30px; min-width: 0; }
  .popup-episode-actions:empty { display: none; }
  .popup-episode-actions button, .popup-episode-actions a, .popup-watch-sessions button, .popup-watch-filters button, .popup-watch-footer button, .popup-watch-footer a, .popup-watch-slice-note button, .popup-watch-load-more { border: 0; padding: 2px 0; background: transparent; color: var(--ad-muted); font: inherit; font-size: 10px; text-decoration: none; cursor: pointer; }
  .popup-watch-screen .popup-episode-actions button, .popup-watch-screen .popup-episode-actions a { display: inline-flex; align-items: center; min-height: 24px; font-weight: 500; }
  .popup-watch-screen .popup-episode-actions button:hover, .popup-watch-screen .popup-episode-actions a:hover { color: var(--ad-text); }
  .popup-watch-pending { font-size: 9px; color: var(--ad-muted); }
  .popup-watch-sessions { display: grid; gap: 10px; padding: 8px 0 3px; }
  .popup-watch-session { display: grid; min-width: 0; gap: 4px; border-left: 1px solid rgba(255,255,255,.1); padding-left: 8px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-participants { overflow-wrap: anywhere; }
  .popup-watch-session .popup-session-summary-action { justify-self: start; color: var(--ad-text); }
  .popup-watch-slice-note { margin: 6px 0 6px 14px; font-size: 10px; color: var(--ad-muted); }
  .popup-watch-load-more { display: block; min-height: 28px; margin: 4px auto; }
  .popup-watch-footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 7px; text-align: center; }
  .popup-watch-screen button:disabled { cursor: default; opacity: .5; }
  .popup-history-settings h3, .popup-settings-section-title { margin: 4px 0 8px; color: var(--ad-text); font-size: 11px; font-weight: 600; }
  .popup-history-settings p { margin: 8px 0 12px; color: var(--ad-muted); font-size: 10px; line-height: 1.5; }
  .popup-history-settings .popup-notification-setting { width: 100%; grid-template-columns: minmax(0,1fr) 38px; }
  .popup-watch-summary { display: block; width: fit-content; max-width: 100%; }
  .popup-watch-special-total { color: rgba(255,255,255,.44); font-size: 10px; }
  .popup-watch-grid-view, .popup-watch-video-list { min-width: 0; margin: 0; padding: 12px 10px 10px; border: 0; border-radius: 0 0 13px 13px; background: rgba(238,230,220,.035); }
  .popup-season-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; margin: 2px 0 11px; }
  .popup-season-picker { min-width: 0; max-width: 70%; }
  .popup-season-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; max-width: 100%; min-height: 32px; padding: 7px 12px; border: 1px solid transparent; border-radius: 999px; background: #eee6dc; color: #171411; font: inherit; font-size: 11px; font-weight: 600; line-height: 1.45; text-align: left; cursor: pointer; }
  .popup-season-trigger > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .popup-season-trigger > svg { flex-shrink: 0; transition: transform 160ms ease; }
  .popup-season-trigger[aria-expanded="true"] > svg { transform: rotate(180deg); }
  .popup-season-trigger:hover { background: #fff4e7; }
  .popup-season-menu { position: fixed; z-index: 100; display: grid; box-sizing: border-box; width: 224px; padding: 5px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; border: 1px solid rgba(255,255,255,.13); border-radius: 13px; background: #1b1b1b; box-shadow: 0 12px 28px rgba(0,0,0,.4); animation: watch-filter-reveal 150ms ease; }
  .popup-season-menu > button { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; min-height: 34px; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--ad-muted); font: inherit; font-size: 11px; line-height: 1.5; text-align: left; cursor: pointer; }
  .popup-season-menu > button > span { min-width: 0; overflow-wrap: anywhere; }
  .popup-season-menu > button > svg { flex-shrink: 0; color: var(--ad-accent); }
  .popup-season-menu > button[aria-selected="true"], .popup-season-menu > button:hover { background: rgba(255,255,255,.06); color: var(--ad-text); }
  .popup-season-menu > button:focus-visible { outline-offset: -2px; }
  .popup-season-menu > button[data-special-start="true"]:not(:first-child) { margin-top: 5px; border-top: 1px solid rgba(255,255,255,.08); border-top-left-radius: 0; border-top-right-radius: 0; }
  .popup-season-counter { flex: 0 0 auto; color: var(--ad-muted); font-size: 10px; line-height: 1.4; font-variant-numeric: tabular-nums; }
  .popup-episode-picker { position: relative; min-width: 0; }
  .popup-episode-picker[data-loading="true"] { min-height: 150px; }
  .popup-episode-picker[data-loading="true"] > .popup-episode-picker-content { visibility: hidden; }
  .popup-episode-picker-loading { position: absolute; top: 8px; left: 2px; margin: 0; color: var(--ad-muted); font-size: 10px; }
  .popup-episode-grid-scroll { --episode-cell-height: 39px; --episode-grid-gap: 6px; --episode-grid-rows: 5; box-sizing: border-box; max-height: calc(var(--episode-cell-height) * var(--episode-grid-rows) + var(--episode-grid-gap) * (var(--episode-grid-rows) - 1) + 4px); padding: 2px; margin: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior-y: contain; scrollbar-width: thin; scrollbar-color: rgba(238,230,220,.25) transparent; scroll-padding: 2px; }
  .popup-episode-grid { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: var(--episode-grid-gap); }
  .popup-episode-cell { position: relative; display: flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box; height: var(--episode-cell-height); min-width: 0; overflow: hidden; padding: 0 3px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.015); color: rgba(238,230,220,.64); font: inherit; font-size: 11px; font-weight: 550; font-variant-numeric: tabular-nums; cursor: pointer; transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; }
  .popup-episode-cell:hover, .popup-special-choice:hover { border-color: rgba(238,230,220,.34); background: rgba(255,255,255,.05); color: var(--ad-text); }
  .popup-episode-cell[data-completed="true"] { border-color: rgba(238,230,220,.14); background: rgba(238,230,220,.11); color: #eee6dc; }
  .popup-episode-cell[data-completed="true"] > svg { flex-shrink: 0; width: 10px; color: rgba(238,230,220,.6); }
  .popup-episode-cell[data-current="true"] .popup-cell-number { color: var(--ad-accent); }
  .popup-episode-cell[aria-pressed="true"], .popup-special-choice[aria-pressed="true"] { border-color: var(--ad-accent); background: rgba(255,149,64,.06); color: var(--ad-text); }
  .popup-episode-cell[data-available="false"] { border-style: dashed; color: rgba(238,230,220,.36); }
  .popup-cell-progress { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--ad-accent); pointer-events: none; }
  .popup-special-choices { display: grid; gap: 6px; }
  .popup-special-choice { display: flex; align-items: center; gap: 9px; box-sizing: border-box; min-height: var(--episode-cell-height); min-width: 0; padding: 8px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: transparent; color: var(--ad-muted); font: inherit; font-size: 11px; line-height: 1.5; text-align: left; cursor: pointer; }
  .popup-special-choice .popup-cell-number { flex: 0 0 auto; min-width: 20px; font-size: 10px; font-variant-numeric: tabular-nums; }
  .popup-special-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .popup-special-choice > svg { flex: 0 0 auto; color: var(--ad-accent); }
  .popup-watch-screen .popup-selected-episode { display: grid; gap: 5px; margin-top: 12px; padding: 11px 0 0; border-top: 1px solid rgba(255,255,255,.08); border-radius: 0; background: transparent; }
  .popup-watch-screen .popup-selected-episode .popup-episode-main { gap: 5px; }
  .popup-selected-episode-heading { display: grid; grid-template-columns: max-content minmax(0,1fr); align-items: baseline; gap: 10px; font-size: 10px; line-height: 1.5; color: var(--ad-muted); }
  .popup-selected-episode-heading > span:last-child { min-width: 0; text-align: right; overflow-wrap: anywhere; }
  .popup-selected-episode-heading > span:first-child { color: #eee6dc; font-weight: 600; }
  .popup-selected-episode-title { min-width: 0; min-height: 36px; overflow-wrap: anywhere; color: var(--ad-text); font-size: 12px; font-weight: 500; line-height: 1.5; }
  .popup-selected-episode-bottom { display: grid; grid-template-columns: minmax(0,1fr) 112px; align-items: center; gap: 12px; min-width: 0; }
  .popup-selected-progress { display: grid; min-width: 0; gap: 9px; margin-top: 3px; }
  .popup-selected-time { min-width: 0; color: rgba(238,230,220,.84); font-size: 11px; font-variant-numeric: tabular-nums; line-height: 1.5; }
  .popup-selected-duration { color: var(--ad-muted); white-space: nowrap; }
  .popup-watch-screen .popup-selected-progress .popup-progress-track { flex: none; width: 100%; height: 4px; background: rgba(255,255,255,.09); }
  .popup-selected-resume { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; width: 100%; min-width: 0; min-height: 34px; padding: 8px 10px; border: 0; border-radius: 999px; background: #eee6dc; color: #171411; font: inherit; font-size: 10px; line-height: 1.5; font-weight: 600; cursor: pointer; }
  .popup-selected-resume > svg { flex-shrink: 0; }
  .popup-selected-resume > span { min-width: 0; overflow-wrap: anywhere; }
  .popup-selected-resume:hover:not(:disabled) { background: #fff4e7; }
  .popup-watch-screen .popup-selected-episode .popup-episode-actions { margin-left: 0; }
  .popup-watch-video-list > .popup-selected-episode { margin: 0; border-top: 0; padding-top: 0; }
  .popup-watch-screen .popup-watch-video-list > .popup-episode-row:not(.popup-selected-episode) { padding-left: 0; }
  .popup-catalog-note { margin: 9px 0 0; color: rgba(255,255,255,.44); font-size: 9px; line-height: 1.6; }
  .popup-catalog-note button { padding: 0; border: 0; background: transparent; color: var(--ad-muted); font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  @media (max-width: 350px) { .popup-episode-grid { grid-template-columns: repeat(5, minmax(0,1fr)); } }
  @media (max-height: 650px) { .popup-episode-grid-scroll { --episode-grid-rows: 4; } }
  @media (pointer: coarse) { .popup-episode-grid-scroll { --episode-cell-height: 44px; } .popup-season-trigger, .popup-season-menu > button, .popup-selected-resume { min-height: 44px; } }
  @keyframes watch-filter-reveal { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 350px) { .popup-watch-screen .popup-watch-controls { gap: 6px; } .popup-watch-screen .popup-watch-search { padding-inline: 8px; gap: 5px; } .popup-watch-screen .popup-season-main { grid-template-columns: minmax(0,1fr); } }
  @media (hover: hover) and (pointer: fine) {
    .popup-watch-screen .popup-watch-item:hover { border-color: rgba(238,230,220,.18); }
    .popup-watch-title-toggle[data-has-progress="true"] .popup-watch-progress-preview,
    .popup-season-header[data-has-progress="true"] .popup-watch-progress-preview { position: fixed; z-index: 110; box-sizing: border-box; top: var(--preview-top, 0px); left: var(--preview-left, 0px); width: var(--preview-width, 224px); padding: 8px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: #1a1a1a; box-shadow: 0 8px 20px rgba(0,0,0,.3); pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 140ms ease, visibility 140ms; }
    .popup-watch-title-toggle[data-has-progress="true"]:focus-visible .popup-watch-progress-preview[data-ready="true"]:not([data-dismissed="true"]),
    .popup-watch-title-toggle[data-has-progress="true"] .popup-watch-summary:hover .popup-watch-progress-preview[data-ready="true"]:not([data-dismissed="true"]),
    .popup-season-header[data-has-progress="true"]:is(:hover, :focus-visible) .popup-watch-progress-preview[data-ready="true"] { opacity: 1; visibility: visible; }
  }
  @media (pointer: coarse) { .popup-watch-screen .popup-episode-header { grid-template-columns: minmax(24px,max-content) minmax(0,1fr) 44px; } .popup-watch-screen .popup-episode-resume { width: 44px; height: 44px; } }
  @media (prefers-reduced-motion: reduce) { .popup-watch-screen *, .popup-watch-screen *::before, .popup-watch-screen *::after, .popup-history-settings * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;

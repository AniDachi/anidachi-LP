export const panelRoomActionsStyles = `
  .panel-account-link { color:inherit; text-decoration:none; cursor:pointer; transition:filter 120ms ease; }
  .panel-account-link:hover { filter:brightness(1.16); }
  .panel-account-link:focus-visible, .panel-plan-link:focus-visible { outline:2px solid #edac72; outline-offset:3px; }
  .panel-account-copy { gap:1px; }
  .panel-account-title-row { min-height:18px; }
  .panel-account-secondary { min-height:14px; display:flex; flex-direction:column; align-items:flex-start; }
  .panel-plan-placeholder { display:block; width:28px; height:7px; flex:none; border-radius:3px; background:rgba(255,255,255,.10); }
  .panel-account-name-placeholder { width:72px; height:12px; border-radius:4px; background:rgba(255,255,255,.10); }
  .panel-people-reveal { display:grid; grid-template-rows:0fr; opacity:0; transition:grid-template-rows 300ms cubic-bezier(.22,.8,.24,1),opacity 180ms ease; }
  .panel-people-reveal[data-visible=true] { grid-template-rows:1fr; opacity:1; }
  .panel-people-reveal > div { min-height:0; overflow:hidden; }
  .panel-plan-link, .panel-account-title-row .plan-badge { animation:panel-content-in 160ms ease-out both; }
  .panel-plan-link { display:inline-flex; align-items:center; gap:3px; align-self:flex-start; padding:3px 0; margin:-3px 0; border-radius:3px; color:#dca575; font-size:11px; font-weight:550; line-height:14px; text-decoration:none; white-space:nowrap; }
  .panel-plan-link:hover { color:#ffc18a; }
  .panel-plan-link svg { flex:none; opacity:.85; }
  .panel-limit-copy { margin:0 1px 13px; }
  .panel-limit-copy strong { color:#f2ede5; font-size:13px; font-weight:650; line-height:1.4; }
  .panel-limit-copy p { margin:5px 0 0; color:#a9a8ac; font-size:11px; line-height:1.55; text-wrap:pretty; }
  .panel-limit-plans { display:flex; align-items:center; gap:7px; text-decoration:none; font-size:14px; }
  .panel-time-counter { display:inline-flex; align-items:center; gap:4px; height:32px; width:max-content; }
  .panel-time-counter svg { width:20px; height:20px; flex:none; color:#c4b9ad; }
  .panel-time-counter strong { display:block; color:#f5f3ef; font-size:28px; line-height:1; font-weight:760; letter-spacing:-.7px; font-variant-numeric:tabular-nums; }
  .panel-time-loading { gap:4px; color:#c4b9ad; }
  .panel-time-placeholder { width:76px; height:17px; border-radius:5px; background:rgba(255,255,255,.10); }
  .panel-idle-time > .panel-time-counter, .panel-action-timer > .panel-time-counter { animation:panel-content-in 160ms ease-out both; }
  .panel-room-actions { position:relative; height:36px; min-height:36px; }
  .panel-room-actions .panel-primary-action { font-size:14px; }
  .panel-room-actions.room-empty .panel-primary-action { position:absolute; top:0; left:0; width:100%; max-width:none; }
  .panel-room-actions[data-timed-layout=true] { display:block; }
  .panel-idle-time { position:absolute; top:0; left:1px; height:36px; display:flex; align-items:center; cursor:default; }
  .panel-room-actions[data-timed-layout=true] .panel-primary-action { position:absolute; top:0; left:126px; width:calc(100% - 126px); max-width:none; transition:background 160ms ease,box-shadow 160ms ease; }
  .panel-room-actions.room-active[data-timed-layout=true] .panel-primary-action { left:0; }
  .panel-room-actions.room-empty .panel-primary-action { transition:left 220ms ease,width 220ms ease,background 160ms ease,box-shadow 160ms ease; }
  .panel-room-actions[data-timed-layout=true] .panel-action-icons { position:absolute; top:0; right:0; }
  .panel-room-actions .panel-action-timer { position:absolute; top:0; left:0; width:calc(100% - 126px); height:36px; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:1; transition:opacity 120ms ease; }
  .panel-room-actions .panel-action-time-pending, .panel-room-actions .panel-action-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; transition:opacity 120ms ease; }
  .panel-action-time-pending { color:#c4b9ad; }
  .panel-room-actions.room-active[data-timed=true] .panel-action-label,
  .panel-room-actions.room-active[data-awaiting-time=true] .panel-action-label { opacity:0; }
  .panel-room-actions .panel-primary-action[data-show-action=true] .panel-action-time-pending,
  .panel-room-actions .panel-primary-action[data-show-action=true] ~ .panel-action-timer { opacity:0; }
  .panel-room-actions .panel-primary-action[data-show-action=true] .panel-action-label { opacity:1; }
  .panel-room-actions .panel-primary-action:focus-visible .panel-action-time-pending,
  .panel-room-actions .panel-primary-action:focus-visible ~ .panel-action-timer { opacity:0; }
  .panel-room-actions .panel-primary-action:focus-visible .panel-action-label { opacity:1; }
  @media(hover:hover) {
    .panel-room-actions .panel-primary-action:hover .panel-action-time-pending,
    .panel-room-actions .panel-primary-action:hover ~ .panel-action-timer { opacity:0; }
    .panel-room-actions .panel-primary-action:hover .panel-action-label { opacity:1; }
  }
  .panel-room-actions[data-room-motion=true][data-timed=true] .panel-action-label,
  .panel-room-actions[data-room-motion=true][data-awaiting-time=true] .panel-action-label { visibility:hidden; }
  .panel-room-actions[data-room-motion=true] .panel-action-time-pending svg { animation:panel-content-in 150ms 110ms ease-out both; }
  .panel-room-actions[data-room-motion=true][data-timed=false][data-awaiting-time=false] .panel-action-label { animation:panel-content-in 120ms ease-out both; }
  .panel-primary-action .panel-start-surface { position:absolute; inset:0; border-radius:inherit; z-index:0; pointer-events:none; }
  .panel-primary-action .panel-start-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .panel-room-actions[data-room-motion=true] .panel-primary-action:not([data-show-action=true]) ~ .panel-action-timer { opacity:1; }
  .panel-action-feedback { right:0; white-space:nowrap; }
  .panel-action-feedback[data-action=copy]::before { right:98px; }
  .panel-action-feedback[data-action=sync]::before { right:14px; }
  .panel-action-feedback[data-visible=true] { opacity:1; visibility:visible; transform:translateY(0); transition-delay:0s; }
  .panel-action-feedback .panel-media-tooltip-icon { color:#83d6a2; }
  .panel-action-feedback[data-error=true] .panel-media-tooltip-icon { color:#f0c4bc; }
  .panel-sync-icon { transform-origin:center; }
  .panel-sync-action[data-syncing=true] .panel-sync-icon { animation:panel-sync-spin 650ms cubic-bezier(.22,.61,.36,1) both; }
  .panel-sync-action[data-syncing=true]:disabled { opacity:1; cursor:pointer; }
  @keyframes panel-sync-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes panel-content-in { from { opacity:0; } to { opacity:1; } }
  @media(prefers-reduced-motion:reduce) {
    .panel-plan-link, .panel-account-title-row .plan-badge, .panel-idle-time > .panel-time-counter, .panel-action-timer > .panel-time-counter,
    .panel-room-actions[data-room-motion=true] .panel-action-time-pending svg,
    .panel-room-actions[data-room-motion=true][data-timed=false][data-awaiting-time=false] .panel-action-label { animation:none; }
    .panel-sync-action[data-syncing=true] .panel-sync-icon { animation:none; }
    .panel-room-actions .panel-action-timer, .panel-room-actions .panel-action-time-pending, .panel-room-actions .panel-action-label { transition:none; }
    .panel-room-actions.room-empty .panel-primary-action { transition:none; }
    .panel-people-reveal { transition:none; }
  }
`;

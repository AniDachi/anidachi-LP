export const capsuleFriendsStyles = `
/* Capsule friends surface: anchored reveal, room invitation states, one-use link. */
.cf-reveal { display: grid; grid-template-rows: 0fr; visibility: hidden; pointer-events: none; transition: grid-template-rows 260ms cubic-bezier(.4,0,.2,1), visibility 0s linear 260ms; }
.cf-reveal[data-open=true] { grid-template-rows: 1fr; visibility: visible; pointer-events: auto; transition: grid-template-rows 360ms cubic-bezier(.22,1,.36,1), visibility 0s; }
.cf-reveal-clip { min-height: 0; overflow: hidden; }
.capsule-friends-panel { position: relative; margin-top: 18px; color: var(--ad-text); isolation: isolate; transform-origin: var(--cf-origin, 80%) -14px; opacity: 0; transform: translateY(-5px) scale(.985); transition: opacity 150ms ease, transform 260ms cubic-bezier(.4,0,.2,1); }
.cf-reveal[data-open=true] .capsule-friends-panel { opacity: 1; transform: none; transition: opacity 180ms ease, transform 360ms cubic-bezier(.22,1,.36,1); }
.cf-window { position: relative; padding: 0 13px 9px; border-radius: 15px; overflow: hidden; opacity: 0; transform: translateY(-3px); transition: opacity 110ms ease, transform 180ms ease; }
.cf-reveal[data-open=true] .cf-window { opacity: 1; transform: none; transition: opacity 220ms ease 65ms, transform 300ms cubic-bezier(.22,1,.36,1) 65ms; }
.cf-frame { position: absolute; left: 0; top: -14px; width: 100%; height: calc(100% + 14px); overflow: visible; pointer-events: none; filter: drop-shadow(0 8px 12px rgba(0,0,0,.22)); }
.mini-panel:has(.capsule-friends-panel[data-open=true]) button[aria-label="Close friends and groups"] { border-color: rgba(255,173,99,.65); background: var(--ad-accent-soft); color: #ffad63; box-shadow: inset 0 1px 0 rgba(255,255,255,.045); }
.cf-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 49px; }
.cf-tabs { display: flex; align-self: stretch; align-items: stretch; gap: 14px; flex-shrink: 0; }
.capsule-friends-panel button { font-family: inherit; cursor: pointer; }
.cf-tabs button { position: relative; padding: 0; border: 0; background: none; color: var(--ad-muted); font-size: 12px; font-weight: 600; }
.cf-tabs button[aria-selected=true] { color: var(--ad-text); font-weight: 650; }
.cf-tabs button::after { position: absolute; content: ''; left: 0; right: 0; bottom: 8px; height: 2px; border-radius: 2px; background: transparent; }
.cf-tabs button[aria-selected=true]::after { background: var(--ad-accent); }
.cf-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cf-add, .cf-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 0; border: 0; background: none; color: #ff9a5c; font-size: 11px; font-weight: 600; white-space: nowrap; }
.cf-add:hover { color: #ffd1a5; }
.cf-back { color: var(--ad-text); font-size: 12px; gap: 8px; }
.cf-search { display: flex; align-items: center; gap: 7px; height: 32px; margin: 1px 0 8px; padding: 0 10px; border: 1px solid var(--ad-border); border-radius: 10px; color: var(--ad-muted); background: var(--ad-surface-inset); box-shadow: inset 0 1px 2px rgba(0,0,0,.15); }
.cf-search:focus-within { border-color: rgba(255,138,61,.55); }
.cf-search svg { flex: none; }
.cf-search input { display: block; width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: none; color: var(--ad-text); font: inherit; font-size: 11px; line-height: 20px; }
.cf-search input::placeholder { color: var(--ad-muted); opacity: 1; }
.cf-list { min-height: 150px; max-height: 210px; overflow-y: auto; scrollbar-width: thin; }
.cf-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 50px; padding: 8px 0; }
.cf-person { display: flex; align-items: center; min-width: 0; gap: 10px; }
.capsule-friends-panel .cf-avatar { width: 29px; height: 29px; min-width: 29px; flex: 0 0 29px; font-size: 11px; font-weight: 600; }
.capsule-friends-panel .cf-group { background: var(--ad-surface); color: var(--ad-muted); }
.cf-copy { display: grid; gap: 3px; min-width: 0; }
.cf-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ad-text); font-size: 12px; line-height: 15px; font-weight: 650; }
.cf-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ad-muted); font-size: 10px; line-height: 12px; }
.cf-invite { position: relative; flex: 0 0 82px; width: 82px; min-width: 82px; height: 28px; padding: 4px 7px; border: 1px solid var(--ad-border); border-radius: 99px; background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.025)); color: var(--ad-text); box-shadow: inset 0 1px 0 rgba(255,255,255,.025); font-size: 10.5px; line-height: 18px; font-weight: 650; transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
.cf-action-content { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; animation: cf-action-enter 180ms ease both; }
.cf-action-content svg { flex: none; }
.cf-sending-icon { animation: cf-action-spin 900ms linear infinite; }
@keyframes cf-action-enter { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cf-action-spin { to { transform: rotate(360deg); } }
.cf-invite:not(:disabled):hover { color: #ffbf88; background: rgba(249,115,22,.08); border-color: rgba(255,173,99,.4); }
.cf-invite:disabled { cursor: default; }
.cf-invite[data-state=sending] { color: var(--ad-muted); background: rgba(255,255,255,.025); border-color: var(--ad-border); box-shadow: none; }
.cf-invite[data-state=sent] { color: rgba(255,255,255,.78); background: rgba(255,255,255,.035); border-color: var(--ad-border); box-shadow: none; }
.cf-invite[data-state=in-room] { color: var(--ad-success); background: rgba(125,211,167,.055); border-color: rgba(125,211,167,.14); box-shadow: none; }
.cf-invite[data-state=accepted], .cf-invite[data-state=declined], .cf-invite[data-state=expired] { color: var(--ad-muted); background: transparent; border-color: transparent; box-shadow: none; }
.cf-invite[data-state=accepted] { color: rgba(255,255,255,.76); }
.cf-invite[data-state=error] { color: #efb8ae; border-color: rgba(248,113,113,.2); background: rgba(248,113,113,.045); }
.cf-copy small[data-error=true] { color: #d6a69d; }
@media(prefers-reduced-motion:reduce) { .cf-action-content, .cf-sending-icon { animation: none; } .cf-invite { transition: none; } }
.cf-empty { min-height: 150px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; }
.cf-empty strong { color: var(--ad-muted); font-size: 11px; font-weight: 450; }
.cf-empty button { display: inline-flex; align-items: center; gap: 6px; border: 0; padding: 4px; background: none; color: #ff9a5c; font: inherit; font-size: 11px; }
.cf-add-screen { display: flex; flex-direction: column; gap: 12px; padding: 1px 0 5px; animation: cf-action-enter 180ms ease both; }
.cf-add-screen p { margin: 0; color: var(--ad-muted); font-size: 11px; line-height: 1.6; }
.cf-link-field { display: flex; align-items: center; padding: 9px 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: rgba(0,0,0,.12); }
.cf-link-field input { width: 100%; min-width: 0; border: 0; outline: 0; background: none; color: var(--ad-muted); font: inherit; font-size: 10px; line-height: 16px; text-overflow: ellipsis; }
.cf-link-field:focus-within input { color: var(--ad-text); }
.cf-primary { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border: 0; border-radius: 99px; background: linear-gradient(135deg,#ffb15f,var(--ad-accent-strong)); color: rgba(28,17,9,.96); font-size: 12px; font-weight: 700; }
.cf-primary:hover { background: linear-gradient(135deg,#ffc07a,#fb7c24); }
.cf-primary .cf-action-content { gap: 7px; }
.cf-link-footer { display: flex; justify-content: center; margin-top: -4px; }
.cf-new-link { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 4px 12px; border: 0; background: none; color: var(--ad-muted); font-size: 11px; line-height: 18px; font-weight: 500; }
.cf-new-link:hover { color: #ffc087; }
.cf-add-screen .cf-error { color: #e8b09a; }
@media(prefers-reduced-motion:reduce) { .cf-add-screen { animation: none; } }
@media(prefers-reduced-motion:reduce) { .cf-reveal, .cf-reveal[data-open=true], .cf-reveal .capsule-friends-panel, .cf-reveal[data-open=true] .capsule-friends-panel, .cf-reveal .cf-window, .cf-reveal[data-open=true] .cf-window { transition: none; transform: none; } }
.capsule-friends-panel button:focus-visible, .cf-list:focus-visible, .cf-link-field:focus-within { outline: 2px solid #ffad63; outline-offset: 3px; }
.cf-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media(max-width: 359px) { .cf-header { gap: 5px; } .cf-tabs { gap: 10px; } .cf-header-actions { gap: 3px; } .cf-window { padding-inline: 10px; } }

.cf-list-notice { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; font-size:11px; line-height:1.5; color:var(--ad-muted); }
.cf-list-notice button { flex:none; border:0; background:none; color:var(--ad-text); font-size:11px; padding:6px; }
.cf-avatar { position:relative; overflow:hidden; }
.cf-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.cf-invite[data-state=accepted]:not(:disabled) { color:var(--ad-text); background:rgba(255,255,255,.035); border-color:var(--ad-border); }
.cf-loading { min-height:150px; display:grid; align-content:center; gap:12px; }
.cf-skeleton { display:flex; align-items:center; gap:10px; height:38px; }
.cf-skeleton span { width:29px; height:29px; border-radius:50%; background:rgba(255,255,255,.05); }
.cf-skeleton i { width:90px; height:10px; border-radius:5px; background:rgba(255,255,255,.05); }
.cf-primary { min-height:36px; }
.cf-primary:disabled { cursor:default; opacity:.65; }
.cf-link-field input::placeholder { color:var(--ad-muted); }
`;

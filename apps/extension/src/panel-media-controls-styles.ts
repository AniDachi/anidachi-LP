export const panelMediaControlStyles = `
/* The corner surface shares the Settings material without adding header height. */
.panel-header:has(.panel-media-dock) { column-gap:20px; }
/* 91px surface aligns with the invite/sync pair plus the drawer's 13px edge inset. */
.panel-header-actions:has(.panel-media-dock) { position:relative; z-index:5; align-self:stretch; transform:translate(2.5px,-4px); }
.panel-header-actions:has(.panel-media-dock)::before { content:""; position:absolute; inset:-10px -11.5px; border-radius:0 18px 0 14px; background:rgba(255,255,255,.045); pointer-events:none; }
.panel-media-actions { align-self:center; }
.panel-media-dock { position:relative; display:flex; align-items:center; gap:8px; height:32px; padding:0; border:0; background:transparent; box-shadow:none; }
.panel-media-button { --media-color:#ffdc70; --media-rgb:255,220,112; position:relative; display:grid; place-items:center; flex:0 0 30px; width:30px; height:30px; margin:0; padding:2px; border:0; border-radius:50%; background:#08090a; color:var(--media-color); cursor:pointer; -webkit-tap-highlight-color:transparent; }
.panel-media-button::before { content:""; position:absolute; inset:0; border:1px solid var(--media-color); border-radius:inherit; opacity:.8; box-shadow:0 0 4px rgba(var(--media-rgb),.16),inset 0 0 3px rgba(var(--media-rgb),.12); pointer-events:none; transition:opacity 140ms ease,box-shadow 140ms ease,border-color 140ms ease; }
.panel-media-mic[data-mode="open-mic"],.panel-media-camera[data-enabled="true"] { --media-color:#a3edbb; --media-rgb:163,237,187; }
.panel-media-camera[data-enabled="false"] { --media-color:#90949b; --media-rgb:144,148,155; }
.panel-media-camera[data-enabled="false"]::before { opacity:.35; box-shadow:none; }
.panel-media-cap { position:relative; display:flex; align-items:center; justify-content:center; width:100%; height:100%; border:1px solid #ffffff0d; border-radius:50%; background:linear-gradient(150deg,#37393d 0%,#282a2e 38%,#191b1e 100%); box-shadow:inset 0 1px 1px #ffffff22,inset 0 -2px 3px #0008,0 2px 3px #000c; transform:translateY(-.5px); transition:transform 120ms ease,box-shadow 120ms ease,background 120ms ease; pointer-events:none; }
.panel-media-symbol { display:grid; place-items:center; position:relative; filter:drop-shadow(0 1px 1px #0008); }
.panel-media-button:not(:disabled):hover::before { opacity:1; box-shadow:0 0 6px rgba(var(--media-rgb),.25); }
.panel-media-button:not(:disabled):hover .panel-media-cap { background:linear-gradient(150deg,#414348 0%,#2c2e32 38%,#1d1f22 100%); }
.panel-media-button:not(:disabled):active .panel-media-cap { transform:translateY(1px) scale(.96); box-shadow:inset 0 2px 4px #000a,inset 0 -1px 1px #ffffff0b; }
.panel-media-button:focus-visible { outline:2px solid #f0e7db; outline-offset:2px; box-shadow:none; }
@media(prefers-reduced-motion:reduce){.panel-media-button::before,.panel-media-cap{transition:none}}

.panel-media-button:disabled { --media-color:#74777d; --media-rgb:116,119,125; cursor:not-allowed; }
.panel-media-button:disabled::before { opacity:.3; box-shadow:none; }
.panel-media-feedback { margin:0 0 10px; font-size:11px; line-height:1.45; color:#edb29f; }

.panel-media-mic-hint { position:relative; display:flex; flex:0 0 30px; width:30px; height:30px; }
.panel-media-tooltip { position:absolute; z-index:60; top:calc(100% + 11px); right:-38px; display:grid; grid-template-columns:18px minmax(0,1fr); align-items:center; gap:8px; width:max-content; max-width:220px; padding:7px 14px; border:1px solid #ffffff0c; border-radius:999px; background:linear-gradient(145deg,#25272b,#1b1d20); box-shadow:0 8px 22px #0006,inset 0 1px 0 #ffffff05; color:#f2ede5; text-align:center; cursor:default; opacity:0; visibility:hidden; pointer-events:none; transform:translateY(-3px); transition:opacity 140ms ease,transform 140ms ease,visibility 0s linear 140ms; }
.panel-media-tooltip::before { content:""; position:absolute; top:-5px; right:48px; width:8px; height:8px; border-top:1px solid #ffffff0c; border-left:1px solid #ffffff0c; border-radius:2px 0 0 0; background:#222428; transform:rotate(45deg); }
.panel-media-mic-hint[data-visible="true"] .panel-media-tooltip { opacity:1; visibility:visible; transform:translateY(0); transition-delay:0s; }
.panel-media-tooltip-icon { display:grid; place-items:center; width:18px; height:24px; color:#ffd165; }
.panel-media-tooltip[data-mode="open-mic"] .panel-media-tooltip-icon { color:#83d6a2; }
.panel-media-tooltip-copy kbd { display:inline-grid; place-items:center; vertical-align:middle; width:22px; height:24px; margin:0 3px; border:1px solid #ffffff18; border-bottom:2px solid #0006; border-radius:5px; background:#17191c; box-shadow:inset 0 1px 1px #ffffff0d,0 1px 2px #0003; color:#f2ede5; font-family:inherit; font-size:12px; font-weight:650; }
.panel-media-tooltip-copy { display:grid; min-width:0; }
.panel-media-tooltip-copy strong { color:#f2ede5; font-size:12px; line-height:1.3; font-weight:650; }
@media(prefers-reduced-motion:reduce){.panel-media-tooltip{transform:none;transition:none}}
`;

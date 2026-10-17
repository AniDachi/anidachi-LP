export const playerOnboardingStyles = `
.anidachi-overlay[data-introduction-active] > :not(.player-introduction):not(style) { visibility:hidden; pointer-events:none; }
/* Player auto-hide can set cursor:none on our Shadow DOM host. */
.player-introduction { color:#f0e7db; container-type:size; cursor:default; }
.player-introduction * { box-sizing:border-box; }
.tour-scene { position:absolute; inset:0; }
.player-introduction.tour-exiting { overflow:hidden; }
/* The wipe edge and rolling mark share the same timing and center line. */
.tour-exiting .tour-scene { animation:tour-wipe var(--tour-exit-duration) cubic-bezier(.42,0,.58,1) both; pointer-events:none; }
.tour-exit-roll { position:absolute; z-index:60; left:calc(-1 * var(--tour-roll-size)); top:50%; width:var(--tour-roll-size); height:var(--tour-roll-size); pointer-events:none; animation:tour-roll var(--tour-exit-duration) cubic-bezier(.42,0,.58,1) both; will-change:transform; }
.tour-exit-logo { display:block; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 10px 18px #0005); }
@keyframes tour-wipe { from { clip-path:inset(0 0 0 calc(-.5 * var(--tour-roll-size))); } to { clip-path:inset(0 0 0 calc(100% + .5 * var(--tour-roll-size))); } }
@keyframes tour-roll { from { transform:translate3d(0,-50%,0) rotate(0deg); } to { transform:translate3d(calc(100cqw + var(--tour-roll-size)),-50%,0) rotate(var(--tour-roll-angle)); } }
@keyframes tour-fade-out { to { opacity:0; } }
@media(prefers-reduced-motion:reduce){.tour-exiting .tour-scene{animation:tour-fade-out 160ms ease-out both}.tour-exit-roll{display:none;animation:none}}
.player-introduction .top-bubble { opacity:1; transform:none; pointer-events:auto; transition:none; }
.player-introduction .panel-primary-action { transition:none; }
/* Dim the video and inactive controls while leaving the action itself clear. */
.tour-backdrop { position:absolute; inset:0; z-index:29; background:rgba(4,5,9,.86); pointer-events:none; }
.tour-mask { position:absolute; z-index:40; background:rgba(4,5,9,.28); pointer-events:none; }
.tour-ring { position:absolute; z-index:41; border:1.5px solid #ffe0bc; border-radius:999px; box-shadow:0 0 0 1px #ffbc7a26,0 0 10px #ffb87566,0 0 28px #ff984f38,inset 0 0 9px #ffbc7a24; pointer-events:none; }
/* The label ends beside the first point of the stroke, at y=16 (or 46
   for the upward pointer). One aspect ratio keeps the geometry consistent. */
.tour-sketch-cue { position:absolute; z-index:41; width:96px; height:auto; aspect-ratio:112/88; color:#ffcc9a; pointer-events:none; }
.tour-sketch-label { position:absolute; right:calc(100% + 8px); top:18.1818%; margin-top:-4px; font:400 22px/1.2 "Chalkboard SE","Comic Sans MS","Comic Sans",cursive; letter-spacing:.01em; white-space:nowrap; transform:translateY(-50%) rotate(-3deg); transform-origin:right center; text-shadow:0 2px 10px #0008; }
.tour-sketch-cue svg { position:absolute; inset:0; width:100%; height:100%; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; filter:drop-shadow(0 0 5px #ff984f33); }
.tour-sketch-up-right .tour-sketch-label { top:52.2727%; }
.tour-cue-camera { width:80px; }
.tour-sketch-down-right .tour-sketch-label { top:9.0909%; }
.tour-cue-invite { width:120px; }
.tour-cue-camera .tour-sketch-label,.tour-cue-invite .tour-sketch-label { font-size:21px; }
.tour-tip { position:absolute; z-index:42; width:min(640px,calc(100cqw - 430px)); max-width:calc(100% - 40px); max-height:calc(100% - 106px); overflow:auto; padding:0; border:0; background:none; box-shadow:none; pointer-events:auto; animation:tour-enter 180ms ease-out; text-shadow:0 2px 14px #0005; }
.tour-tip h2 { margin:0 0 28px; font-size:clamp(36px,5.4cqw,90px); line-height:.94; letter-spacing:-.035em; font-weight:700; font-family:Arial,"Helvetica Neue",sans-serif; color:#f0e7db; }
.tour-tip h2 em { color:#ff984f; font-style:normal; }
.tour-tip p { color:#c6baaa; margin:0; line-height:1.4; font-size:clamp(16px,1.55cqw,26px); white-space:pre-line; }
.player-introduction button:focus-visible, .player-introduction a:focus-visible { outline:2px solid #ffcc9a; outline-offset:3px; box-shadow:0 0 12px #ff984f33; }
.player-introduction .tour-close { position:absolute; left:18px; top:18px; z-index:43; display:grid; place-items:center; width:36px; height:36px; border:0; border-radius:50%; background:transparent; color:#b7afa5; cursor:pointer; }
.player-introduction .tour-close:hover { background:#ffffff0c; color:#fff; }
.tour-eyebrow { color:#f0e7db; font-size:clamp(11px,1cqw,16px); line-height:1.5; text-transform:uppercase; font-weight:650; letter-spacing:.25em; margin-bottom:26px; }
.tour-plan-link { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; gap:20px; min-width:min(220px,100%); min-height:46px; margin-top:24px; padding:11px 22px; border:1px solid #eee5d96b; border-radius:999px; color:#f0e7db; background:#eee5d908; font:600 15px/1.3 Arial,sans-serif; text-decoration:none; text-shadow:none; transition:background 150ms ease,border-color 150ms ease; }
.tour-plan-link:not(:disabled):hover { background:#eee5d918; border-color:#eee5d9; }
.tour-plan-spinner { width:16px; height:16px; box-sizing:border-box; border:2px solid #eee5d933; border-top-color:currentColor; border-radius:50%; animation:tour-plan-spin 800ms linear infinite; }
@keyframes tour-plan-spin { to { transform:rotate(360deg); } }
.tour-tip .tour-practice-note { margin-top:20px; font-size:clamp(12px,1.1cqw,16px); color:#a69c90; }
.tour-invite-actions { display:flex; gap:inherit; }
/* Keep one shared ring; keyboard focus uses a fill within the paired controls. */
.player-introduction .tour-invite-actions button:focus-visible { outline:none; box-shadow:none; background:#ffcc9a26; color:#fff1df; }
.tour-invite-options { display:grid; gap:22px; max-width:470px; }
.tour-invite-option { display:flex; align-items:flex-start; gap:14px; }
.tour-invite-option > svg { flex:0 0 auto; margin-top:2px; color:#ffba88; }
.tour-invite-option h3 { margin:0 0 6px; font-size:clamp(16px,1.5cqw,22px); line-height:1.3; color:#f0e7db; font-weight:600; }
.tour-invite-option p { font-size:clamp(15px,1.3cqw,20px); line-height:1.45; }
.tour-invite-option strong { color:#ddd2c5; font-weight:500; }
.tour-settings-ring { border-radius:999px; }
.player-introduction [data-tour-target="settings"] { padding-inline:9px; }
/* Reserve the finish action even when a short player constrains the copy.
   Only the settings list may scroll; the heading and action remain visible. */
.tour-step-settings { --tour-frame-width:min(460px,36cqw,100%); width:min(600px,calc(100cqw - 430px)); display:flex; flex-direction:column; overflow:visible; }
.tour-step-settings > h2,.tour-step-settings > .tour-settings-subtitle,.tour-step-settings > .tour-finish { flex:none; }
.tour-step-settings .tour-eyebrow { display:none; }
.tour-step-settings h2 { font-size:clamp(32px,min(4.5cqw,7.2cqh),72px); line-height:1.05; margin-bottom:12px; }
.tour-step-settings .tour-settings-subtitle { font-size:clamp(15px,min(1.6cqw,2.5cqh),23px); color:#e2d9cd; }
.tour-settings-note { display:flex; flex-direction:column; min-height:0; position:relative; width:var(--tour-frame-width); margin-top:clamp(12px,3cqh,24px); padding:clamp(16px,3cqh,27px) 29px; }
/* The freehand frame follows the existing launcher-hint artwork. */
.tour-settings-outline { position:absolute; inset:0; width:100%; height:100%; color:#ffcc9a; pointer-events:none; overflow:visible; }
.tour-settings-outline path { stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
.tour-settings-overview { display:grid; gap:clamp(10px,2.8cqh,21px); margin:0; min-height:0; overflow:auto; }
.tour-settings-overview > div { position:relative; padding-left:51px; font-size:clamp(14px,min(1.35cqw,2.1cqh),20px); line-height:1.4; }
.tour-settings-overview dt { color:#f0e7db; font-weight:600; margin-bottom:3px; }
.tour-settings-overview dt svg { position:absolute; left:0; top:1px; width:33px; height:33px; color:#ffcc9a; stroke-width:1.8; }
.tour-settings-overview dd { color:#c9c1b8; margin:0; font-size:.9em; }
.tour-step-settings .tour-finish { display:flex; align-items:center; justify-content:center; gap:14px; width:var(--tour-frame-width); min-height:54px; margin-top:clamp(14px,3cqh,24px); padding:12px 24px; border:1px solid #fff4e3; border-radius:999px; background:#f3eadc; color:#171513; font:600 clamp(16px,1.55cqw,23px)/1.25 Arial,"Helvetica Neue",sans-serif; text-shadow:none; cursor:pointer; transition:background 140ms ease; }
.tour-step-settings .tour-finish svg { width:21px; height:21px; flex:none; }
.tour-step-settings .tour-finish:hover { background:#fff6e9; }
.tour-step-settings .tour-finish:active { background:#e3d8c7; }
.tour-footer-final .tour-progress { border-right:0; padding-right:0; }
.tour-cue-settings .tour-sketch-label { right:calc(100% + 2px); margin-top:0; font-size:20px; }
@container(max-width:1049px){.tour-cue-settings .tour-sketch-label{font-size:18px}}
.tour-chat-ring { border-radius:23px; }
.tour-camera-ring { border-radius:999px; }
.tour-media-states { display:grid; gap:12px; margin:22px 0 0; padding:0; list-style:none; }
.tour-media-states li { display:flex; align-items:center; gap:12px; color:#e4dace; font-size:clamp(15px,1.5cqw,22px); line-height:1.35; }
.tour-media-state-icon { display:grid; place-items:center; flex:0 0 30px; width:30px; height:30px; border:1px solid currentColor; border-radius:50%; background:#15171bcc; }
.tour-media-state-icon svg { width:16px; height:16px; }
.tour-media-state-ptt { color:#ffdc70; }
.tour-media-state-on { color:#a3edbb; }
.tour-media-state-off { color:#90949b; border-color:#90949b66; }
.tour-media-states kbd { display:inline-grid; place-items:center; min-width:23px; height:25px; padding:0 4px; margin:0 2px; border:1px solid #eee5d933; border-radius:5px; color:#f0e7db; background:#eee5d90a; font-family:inherit; font-size:.85em; font-weight:600; line-height:1; }
.tour-tip .tour-camera-note { color:#a69c90; font-size:clamp(11px,1cqw,14px); }
/* Fade in without the native composer's 8px entrance shift: the measured
   spotlight and send arrow stay aligned throughout the tour transition. */
.player-introduction .tour-practice-composer { z-index:44; bottom:clamp(82px,24cqh,175px); animation:tour-enter 120ms ease-out both; }
.tour-practice-composer .message-composer-send { position:relative; }
.tour-chat-send-cue { left:50%; bottom:calc(100% + 6px); width:clamp(76px,9cqw,112px); height:auto; aspect-ratio:112/88; transform:translateX(-89.286%); }
.tour-practice-composer .message-composer-emoji-popover { max-height:min(224px,calc(100cqh - 190px)); }
.tour-chat-trigger { position:absolute; z-index:42; left:50%; bottom:clamp(82px,24cqh,175px); transform:translateX(-50%); display:flex; align-items:center; gap:18px; border:0; border-radius:16px; padding:8px 18px 8px 8px; color:#eee5d9; background:#161516; font:inherit; cursor:pointer; }
.tour-chat-trigger > span { color:#c6baaa; font-size:14px; }
.tour-chat-trigger.tour-chat-retry { padding:10px 16px; background:transparent; text-decoration:underline; text-underline-offset:5px; }
.tour-step-chat { width:min(580px,52cqw); }
@container(max-width:949px){.tour-step-chat{width:calc(100cqw - 60px)}.tour-step-chat .tour-eyebrow{display:none}.tour-step-chat h2{font-size:32px;margin-bottom:12px}.tour-progress li:not([aria-current]){display:none}.tour-progress li[aria-current]::before{display:none}.tour-progress::after{content:attr(data-total);color:#82796d;font-weight:400}}
@container(max-height:430px){.tour-step-chat h2{font-size:28px;margin-bottom:10px}.tour-step-chat .tour-practice-note{font-size:11px;margin-top:8px}.player-introduction .tour-practice-composer,.tour-chat-trigger{bottom:70px}.tour-chat-trigger{gap:12px}}
.tour-hide-hint { position:absolute; z-index:42; width:252px; max-width:calc(100% - 40px); padding:12px 14px; color:#ddd2c3; pointer-events:none; }
.tour-hide-hint-outline { position:absolute; top:-12px; left:0; width:100%; height:calc(100% + 12px); overflow:visible; color:#ffcc9a; pointer-events:none; }
.tour-hide-hint p { display:flex; align-items:center; justify-content:center; gap:7px; margin:0 0 8px; font-size:13px; font-weight:450; line-height:1.5; }
.tour-hide-hint p > svg { flex:none; color:#ffcc9a; }
.tour-settings-path { display:flex; align-items:center; justify-content:center; gap:5px; font-size:11.5px; line-height:1.4; color:#a69c90; white-space:nowrap; }
.tour-settings-path > svg { flex:none; opacity:.65; }
.tour-settings-path strong { padding:4px 10px; border:0; border-radius:999px; background:#eee5d9; font-weight:600; color:#171514; text-shadow:none; }
.tour-footer { position:absolute; z-index:42; left:5.7cqw; bottom:15cqh; display:flex; align-items:center; gap:30px; pointer-events:auto; }
.tour-footer .tour-skip { border:0; background:none; color:#a69c90; padding:8px 0; font:inherit; font-size:16px; cursor:pointer; }
.tour-footer .tour-skip:hover { color:#eee5db; }
.tour-progress { display:flex; align-items:center; gap:14px; list-style:none; padding:0 30px 0 0; margin:0; border-right:1px solid #eee5db40; color:#82796d; font-size:16px; }
.tour-progress li { display:flex; align-items:center; gap:14px; }
.tour-progress li + li::before { content:''; width:18px; border-top:1px solid #82796d; }
.tour-progress li[aria-current] { color:#ff984f; font-weight:650; }
@container(max-width:949px){.tour-tip{width:calc(100cqw - 378px)}.tour-tip h2{font-size:clamp(32px,5.4cqw,48px);line-height:1.04;letter-spacing:-.035em;margin-bottom:20px}.tour-tip p{font-size:15px;line-height:1.5}.tour-eyebrow{font-size:11px;margin-bottom:16px}.tour-footer{left:20px;bottom:24px;gap:22px}.tour-progress{font-size:13px;gap:10px;padding-right:22px}.tour-progress li{gap:10px}.tour-progress li + li::before{width:12px}.tour-footer .tour-skip{font-size:13px}.tour-plan-link{font-size:14px;gap:12px;margin-top:16px;padding:9px 17px}.tour-tip .tour-practice-note{font-size:12px;margin-top:14px}}
@container(max-height:430px){.tour-tip{max-height:calc(100% - 110px)}.tour-tip h2{font-size:28px;margin-bottom:12px}.tour-tip p{font-size:13px;line-height:1.4}.tour-eyebrow{margin-bottom:12px}.tour-plan-link{min-height:36px;margin-top:12px;padding:8px 16px;font-size:13px}.tour-tip .tour-practice-note{margin-top:12px;font-size:11px}.tour-footer{bottom:14px}}
@container(max-height:430px){.tour-step-invite .tour-eyebrow{display:none}.tour-step-invite h2{font-size:24px;margin-bottom:10px}.tour-invite-options{gap:10px}.tour-invite-option{gap:10px}.tour-invite-option > svg{width:17px;height:17px}.tour-invite-option h3{font-size:14px;margin-bottom:4px}.tour-step-invite .tour-invite-option p{font-size:12px}.tour-step-invite .tour-practice-note{margin-top:6px;font-size:11px}}
@container(max-width:949px){.tour-step-settings{--tour-frame-width:100%;width:calc(100cqw - 378px)}.tour-step-settings h2{font-size:clamp(26px,4.3cqw,40px);margin-bottom:10px}.tour-step-settings .tour-settings-subtitle{font-size:13px}.tour-settings-note{margin-top:18px;padding:20px 17px}.tour-settings-overview{gap:14px}.tour-settings-overview > div{padding-left:35px;font-size:14px}.tour-settings-overview dt svg{width:24px;height:24px}.tour-settings-overview dd{font-size:12px}.tour-step-settings .tour-finish{min-height:44px;margin-top:18px;font-size:15px;gap:10px}.tour-step-settings .tour-finish svg{width:17px;height:17px}.tour-footer{gap:12px}.tour-progress{gap:8px;padding-right:12px}.tour-progress li{gap:6px}.tour-progress li + li::before{width:8px}.tour-footer .tour-skip{font-size:12px}}
/* Embedded players need the space normally reserved below the progress row. */
@container(max-height:700px){.tour-footer-final{bottom:18px}}
@container(max-height:520px){.tour-step-settings h2{font-size:28px;margin-bottom:8px}.tour-step-settings .tour-settings-subtitle{font-size:12px;line-height:1.35}.tour-settings-note{margin-top:12px;padding:16px 19px}.tour-settings-overview{gap:10px}.tour-settings-overview > div{padding-left:30px;font-size:12px;line-height:1.3}.tour-settings-overview dt svg{width:21px;height:21px}.tour-settings-overview dt{margin-bottom:2px}.tour-settings-overview dd{font-size:11px}.tour-step-settings .tour-finish{min-height:38px;margin-top:14px;padding:8px 18px;font-size:14px}.tour-step-settings .tour-finish svg{width:16px;height:16px}.tour-footer-final{bottom:18px}}
@container(max-height:430px){.tour-step-camera .tour-eyebrow{display:none}.tour-step-camera h2,.tour-step-chat h2{font-size:26px;margin-bottom:12px}.tour-media-states{gap:6px;margin-top:12px}.tour-media-states li{font-size:13px;gap:9px}.tour-media-state-icon{width:23px;height:23px;flex-basis:23px}.tour-media-state-icon svg{width:13px;height:13px}.tour-media-states kbd{height:19px;min-width:19px}.tour-step-camera .tour-camera-note{margin-top:10px}}
@keyframes tour-enter{from{opacity:0}to{opacity:1}}
@container(max-width:949px){.tour-cue:not(.tour-cue-camera):not(.tour-cue-invite){width:38px}.tour-cue .tour-sketch-label{display:none}.tour-chat-send-cue .tour-sketch-label{font-size:19px}.tour-cue-camera .tour-sketch-label,.tour-cue-invite .tour-sketch-label{display:block;font-size:18px}.tour-cue-launcher .tour-sketch-label{display:block;font-size:19px}}
@media(prefers-reduced-motion:reduce){.tour-tip,.tour-plan-spinner{animation:none}}
`;

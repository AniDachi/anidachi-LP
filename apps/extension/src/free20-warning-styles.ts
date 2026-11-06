export const free20WarningStyles = `
  .free20-warning-notice {
    position: absolute;
    top: var(--top-bubble-top, 10px);
    right: var(--top-bubble-right, 10px);
    width: min(420px, calc(100% - var(--top-bubble-right, 10px) - 10px));
    height: 32px;
    z-index: 0;
    container: free20-notice / inline-size;
    pointer-events: none;
    color: #eeedeb;
  }
  .free20-notice-layout { --dismiss-width: 32px; position: absolute; inset: 0; }
  .free20-notice-announcement {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
  }
  .free20-notice-sleeve {
    position: absolute; inset: 0;
    clip-path: inset(0 0 0 calc(100% - var(--free20-capsule-width, 78px)) round 16px);
    transition: clip-path 330ms cubic-bezier(.4, 0, .25, 1);
  }
  .free20-notice-sleeve::before {
    content: ''; position: absolute; inset: 0;
    border-radius: 16px; background: #222224; border: 1px solid #ffffff18;
    z-index: 1; pointer-events: none;
  }
  .free20-warning-notice[data-open=true] .free20-notice-sleeve {
    clip-path: inset(0 0 0 0 round 16px);
    transition: clip-path 560ms cubic-bezier(.22, 1, .36, 1);
  }
  .free20-notice-message-clip {
    position: absolute; inset: 0 var(--free20-capsule-width, 78px) 0 var(--dismiss-width);
    overflow: hidden; clip-path: inset(0 0 0 100%);
    transition: clip-path 330ms cubic-bezier(.4, 0, .25, 1); pointer-events: none;
  }
  .free20-warning-notice[data-open=true] .free20-notice-message-clip {
    clip-path: inset(0); transition: clip-path 560ms cubic-bezier(.22, 1, .36, 1);
    pointer-events: auto;
  }
  .free20-notice-message {
    height: 32px; display: flex; align-items: center; gap: 11px; padding: 0 10px 0 11px;
    transform: translateX(24px); opacity: 0;
    transition: transform 340ms cubic-bezier(.22, 1, .36, 1), opacity 130ms ease;
  }
  .free20-warning-notice[data-open=true] .free20-notice-message {
    transform: translateX(0); opacity: 1;
    transition-duration: 340ms, 340ms; transition-delay: 105ms;
  }
  .free20-notice-copy { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; }
  .free20-notice-timer { display: flex; align-items: center; gap: 6px; flex: none; color: #eeedeb; transition: color 350ms ease; }
  .free20-notice-clock { width: 16px; height: 16px; color: #aaa9ac; flex: none; }
  .free20-notice-digits {
    display: flex; align-items: baseline; font-size: 18px; line-height: 24px;
    font-weight: 620; font-variant-numeric: tabular-nums; letter-spacing: -.6px;
  }
  .free20-notice-digits > span:not(.free20-notice-colon) { width: 2ch; text-align: center; }
  .free20-notice-colon { opacity: .58; margin: 0 .5px; }
  .free20-notice-context { font-size: 10.5px; color: #aaa9ac; line-height: 12px; letter-spacing: -.1px; }
  .free20-warning-notice[data-urgent=true] :is(.free20-notice-timer, .free20-notice-clock) { color: #ffbd85; }
  .free20-warning-notice[data-kind=closed] .free20-notice-copy { gap: 8px; animation: free20-ended-copy 260ms ease-out both; }
  .free20-warning-notice[data-kind=closed] .free20-notice-clock { width: 18px; height: 18px; color: #ffb15f; }
  .free20-warning-notice[data-kind=closed] .free20-notice-context strong { display: block; color: #eeedeb; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .free20-warning-notice[data-kind=closed] .free20-notice-context > span { display: block; color: #b7b5b7; font-size: 10px; line-height: 11px; margin-top: 1px; white-space: nowrap; }
  @keyframes free20-ended-copy { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

  .free20-notice-plans {
    position: relative; isolation: isolate; overflow: hidden; flex: none;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    height: 24px; min-width: 104px; padding: 0 10px; border-radius: 999px; border: 1px solid transparent;
    background: linear-gradient(135deg, #ffb15f, #f97316); color: rgba(28, 17, 9, .96);
    box-shadow: inset 0 1px 0 #ffffff26, 0 2px 8px rgba(249, 115, 22, .18);
    font: inherit; font-size: 10.5px; font-weight: 590; line-height: 1; white-space: nowrap; text-decoration: none;
    cursor: pointer; transition: background 160ms ease, color 160ms ease;
  }
  .free20-notice-plans:hover { background: linear-gradient(135deg, #ffc07a, #fb7c24); color: rgba(28, 17, 9, .96); }
  .free20-notice-plans:active { background: linear-gradient(135deg, #ffb15f, #f97316); box-shadow: inset 0 1px 3px #0000001a; }
  .free20-notice-plans:focus-visible { outline: 2px solid #fff1db; outline-offset: -3px; }
  .free20-notice-plans > :is(span, svg) { position: relative; z-index: 1; }
  .free20-notice-plans > svg { width: 11px; height: 11px; flex: none; }
  .free20-notice-plans::before {
    content: ''; position: absolute; inset: -50% auto -50% 0; width: 65%;
    background: linear-gradient(90deg, transparent, #ffffff24 22%, #ffffff8f 44%, #ffffffb8 50%, #ffffff8f 56%, #ffffff24 78%, transparent);
    opacity: 0; transform: translateX(-130%) skewX(-18deg); pointer-events: none;
  }
  /* One cycle: highlight, gentle nudge, then rest. The closed state only shines. */
  .free20-warning-notice[data-open=true] .free20-notice-plans::before { animation: free20-plans-sheen 4s linear infinite; }
  .free20-warning-notice[data-open=true][data-kind=warning] .free20-notice-plans { animation: free20-plans-nudge 4s ease-in-out infinite; transform-origin: center; }
  .free20-warning-notice[data-open=true][data-kind=warning] .free20-notice-plans:is(:hover, :focus-visible, :active) { animation: none; transform: none; }
  .free20-warning-notice[data-open=true] .free20-notice-plans:is(:hover, :focus-visible, :active)::before { animation: none; opacity: 0; }
  @keyframes free20-plans-sheen {
    0% { opacity: 0; transform: translateX(-130%) skewX(-18deg); }
    4%, 26% { opacity: 1; }
    30%, 100% { opacity: 0; transform: translateX(240%) skewX(-18deg); }
  }
  @keyframes free20-plans-nudge {
    0%, 32%, 48%, 100% { transform: translateX(0) rotate(0); }
    35% { transform: translateX(-1.3px) rotate(-.8deg); }
    38% { transform: translateX(1.3px) rotate(.8deg); }
    41% { transform: translateX(-.9px) rotate(-.5deg); }
    44% { transform: translateX(.9px) rotate(.5deg); }
  }

  /* A visible close end with a right-facing arc, sharing the strip's outline. */
  .free20-notice-dismiss {
    position: absolute; top: 0; left: 0; z-index: 2; height: 32px; width: var(--dismiss-width);
    display: flex; align-items: center; justify-content: center;
    padding: 0; border-radius: 16px; border: 1px solid #ffffff20;
    background: #303033; color: #d3d0ce; box-shadow: none; cursor: pointer;
    pointer-events: none;
    transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
  }
  .free20-warning-notice[data-open=true] .free20-notice-dismiss { pointer-events: auto; }
  .free20-notice-dismiss svg {
    width: 14px; height: 14px; pointer-events: none;
  }
  .free20-notice-dismiss:is(:hover, :focus-visible) { background: #3b3b3f; border-color: #ffffff36; color: #fff7ef; }
  .free20-notice-dismiss:focus-visible { outline: none; box-shadow: inset 0 0 0 2px #f3ae78; }
  .free20-notice-dismiss:active { background: #404044; }
  @container free20-notice (max-width: 379px) {
    .free20-notice-message { gap: 7px; padding-left: 7px; padding-right: 7px; }
    .free20-notice-copy { gap: 5px; }
    .free20-notice-context { max-width: 36px; font-size: 9px; line-height: 10px; }
    .free20-notice-digits { font-size: 17px; }
    .free20-notice-timer { gap: 5px; }
    .free20-notice-clock { width: 15px; height: 15px; }
    .free20-notice-plans { min-width: 94px; font-size: 10px; padding: 0 8px; gap: 4px; }
    .free20-warning-notice[data-kind=closed] .free20-notice-context { max-width: none; }
    .free20-warning-notice[data-kind=closed] .free20-notice-context strong { font-size: 10px; }
  }
  @container free20-notice (max-width: 329px) {
    .free20-notice-clock { display: none; }
    .free20-notice-message { gap: 6px; padding-left: 6px; padding-right: 6px; }
    .free20-notice-plans { min-width: 84px; padding: 0 6px; font-size: 9.5px; gap: 3px; }
    .free20-warning-notice[data-kind=closed] .free20-notice-context > span { font-size: 9px; }
  }
  @container free20-notice (max-width: 279px) {
    .free20-notice-layout { --dismiss-width: 24px; }
    .free20-notice-message { gap: 5px; padding-left: 5px; padding-right: 5px; }
    .free20-notice-copy { gap: 4px; }
    .free20-notice-digits { font-size: 15px; }
    .free20-notice-plans { min-width: 60px; padding: 0 5px; font-size: 9px; }
    .free20-notice-plans > svg { display: none; }
  }
  @container free20-notice (max-width: 259px) {
    .free20-notice-plans { width: 52px; min-width: 52px; padding: 0 2px; font-size: 8.5px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .free20-warning-notice *, .free20-warning-notice *::before { animation: none !important; transition: none !important; }
    .free20-notice-plans::before { opacity: 0; }
  }
`;

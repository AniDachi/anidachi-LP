/** Inbox only; the fixed drawer, history and player retain their existing styles. */
export const popupInboxStyles = `
  .inbox-panel { min-width: 0; gap: 0; }
  .inbox-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .inbox-toolbar h2 { margin: 0; color: #e7e3dc; font-size: 15px; font-weight: 600; letter-spacing: -.2px; }
  .inbox-icon-button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 50%; color: #a9a5a0; background: transparent; cursor: pointer; }
  .inbox-icon-button:hover { color: #eee5d9; background: #ffffff09; }
  .inbox-sections { display: grid; gap: 23px; min-width: 0; }
  .inbox-heading { display: flex; align-items: center; gap: 7px; margin: 0 0 11px; color: #a8a099; font-size: 11px; font-weight: 600; line-height: 1.4; }
  .inbox-heading > :last-child { color: #ec9d66; font-variant-numeric: tabular-nums; }
  .inbox-list { display: grid; gap: 10px; min-width: 0; }
  .inbox-friend { padding: 0 0 12px; border-bottom: 1px solid #ffffff0e; min-width: 0; }
  .inbox-friend:last-child { border-bottom: 0; padding-bottom: 0; }
  .inbox-sender { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
  .inbox-avatar { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; object-fit: cover; font-size: 12px; font-weight: 650; background: #342820; color: #ead6c3; border: 1px solid #ffffff15; box-sizing: border-box; }
  .inbox-person { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding-top: 1px; }
  .inbox-person strong { color: #e7e3dc; font-size: 13px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  .inbox-person > span { color: #aaa19a; font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
  .inbox-time { color: #958d86; flex-shrink: 0; font-size: 10px; line-height: 1.8; padding-top: 1px; font-variant-numeric: tabular-nums; }
  .inbox-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
  .inbox-friend .inbox-actions { margin-left: 46px; margin-top: 10px; }
  .inbox-primary, .inbox-secondary { display: inline-flex; justify-content: center; align-items: center; gap: 7px; min-height: 36px; border-radius: 999px; padding: 8px 15px; font: inherit; font-size: 12px; font-weight: 650; line-height: 1.3; cursor: pointer; transition: background 150ms ease, color 150ms ease; }
  .inbox-primary { background: #eee5d9; color: #191713; border: 1px solid transparent; min-width: 100px; }
  .inbox-primary:hover { background: #fff4e6; }
  .inbox-secondary { background: transparent; color: #b8b1a8; border: 1px solid transparent; }
  .inbox-secondary:hover { color: #eee5d9; background: #ffffff08; }
  .inbox-room { min-width: 0; border: 1px solid #ffffff14; border-radius: 16px; background: #ffffff03; padding: 14px; }
  .inbox-room-copy { margin-top: 12px; min-width: 0; }
  .inbox-room .inbox-primary { min-width: 112px; }
  .inbox-room-copy h4 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.45; color: #eee9e2; overflow-wrap: anywhere; }
  .inbox-group { display: flex; align-items: flex-start; gap: 6px; color: #d5a582; font-size: 11px; line-height: 1.45; margin-top: 6px; }
  .inbox-group svg { flex-shrink: 0; margin-top: 2px; }
  .inbox-group span { min-width: 0; overflow-wrap: anywhere; }
  .inbox-message { margin: 8px 0 0; color: #aaa29b; font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .inbox-room[data-state='missed'] { border: 0; border-radius: 0; background: transparent; padding: 0 0 14px; border-bottom: 1px solid #ffffff0c; }
  .inbox-room[data-state='missed']:last-child { border-bottom: 0; padding-bottom: 0; }
  .inbox-room[data-state='missed'] .inbox-room-copy { margin: 7px 0 0 46px; }
  .inbox-room[data-state='missed'] .inbox-room-copy h4 { font-size: 12px; color: #b1aaa3; font-weight: 500; }
  .inbox-empty { display: flex; flex-direction: column; align-items: center; padding: 44px 24px 50px; text-align: center; }
  .inbox-empty > svg { color: #b78c6b; margin-bottom: 17px; }
  .inbox-empty h3 { margin: 0; color: #e7e3dc; font-size: 16px; font-weight: 550; letter-spacing: -.2px; line-height: 1.5; }
  .inbox-empty p { color: #a39b93; font-size: 12px; line-height: 1.65; max-width: 235px; margin: 7px 0 0; overflow-wrap: anywhere; }
  .inbox-empty button { margin-top: 18px; }
  .inbox-status { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 14px; color: #c7b29e; background: #b677350a; border-left: 2px solid #b88961; border-radius: 2px 8px 8px 2px; font-size: 11px; line-height: 1.55; overflow-wrap: anywhere; }
  .inbox-status > span { flex: 1; min-width: 0; }
  .inbox-status[data-state='error'], .inbox-status[data-tone='error'] { color: #e9b2a9; border-color: #bf7466; background: #b653440a; }
  .inbox-status[data-tone='success'] { border-color: #809b7e; color: #c4d3bf; background: #6c906909; }
  .inbox-status button { border: 0; padding: 7px 0; background: transparent; color: #eee5d9; font: inherit; font-weight: 600; cursor: pointer; }
  .inbox-website { display: flex; align-items: center; justify-content: center; gap: 5px; border: 0; border-top: 1px solid #ffffff12; background: transparent; color: #aaa298; font: inherit; font-size: 12px; padding: 15px 8px 4px; cursor: pointer; width: 100%; margin-top: 22px; }
  .inbox-website:hover { color: #eee5d9; }
  .inbox-panel button:disabled { opacity: .5; cursor: default; }
  .inbox-panel button:focus-visible { outline: 2px solid #ff984e; outline-offset: 2px; }
  .inbox-loading { display: grid; gap: 20px; padding: 15px 0 25px; }
  .inbox-skeleton { display: flex; align-items: center; gap: 12px; animation: inbox-pulse 1.5s ease-in-out infinite alternate; }
  .inbox-skeleton i { width: 36px; height: 36px; border-radius: 50%; background: #ffffff09; }
  .inbox-skeleton span { height: 30px; width: 65%; border-radius: 5px; background: #ffffff06; }
  .inbox-loading-label { text-align: center; font-size: 12px; color: #a39b93; }
  .inbox-spin { animation: inbox-spin .8s linear infinite; }
  @keyframes inbox-spin { to { transform: rotate(360deg); } }
  @keyframes inbox-pulse { to { opacity: .4; } }
  @media (prefers-reduced-motion: reduce) { .inbox-spin, .inbox-skeleton { animation: none; } .inbox-panel button { transition: none; } }
  @media (max-width: 340px) { .inbox-room { padding: 12px; } .inbox-friend .inbox-actions { margin-left: 0; } .inbox-empty { padding-inline: 12px; } }
`;

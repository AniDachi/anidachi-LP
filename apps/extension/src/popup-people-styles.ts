/** People only: keep the drawer shell, history and player styles unchanged. */
export const popupPeopleStyles = `
  .popup-people-content { display: grid; gap: 12px; min-width: 0; }
  .popup-people-panel { gap: 14px; min-width: 0; }
  .people-toolbar, .people-list-tools, .people-row, .people-dialog-header, .people-dialog-footer { display: flex; align-items: center; gap: 10px; }
  .people-toolbar { justify-content: space-between; }
  .people-modes { display: grid; grid-template-columns: 1fr 1fr; padding: 3px; position: relative; isolation: isolate; border: 1px solid #ffffff21; border-radius: 999px; width: 224px; max-width: calc(100% - 44px); }
  .people-modes::before { content: ''; position: absolute; z-index: -1; inset: 3px auto 3px 3px; width: calc(50% - 3px); border-radius: 999px; background: #eee5d9; transition: transform 180ms ease; }
  .people-modes[data-mode='groups']::before { transform: translateX(100%); }
  .people-modes button { background: transparent; border: 0; padding: 9px 10px; border-radius: 999px; color: #aaa5a0; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; transition: color 180ms ease; }
  .people-modes button[aria-selected='true'] { color: #191713; }
  .people-icon-button { width: 34px; height: 34px; flex: 0 0 34px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; color: #a9a5a0; background: transparent; cursor: pointer; }
  .people-icon-button:hover { color: #eee5d9; background: #ffffff09; }
  .people-primary, .people-secondary, .people-danger { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; line-height: 1.3; }
  .people-primary { background: #eee5d9; color: #191713; border: 1px solid transparent; }
  .people-primary:hover { background: #fff4e6; }
  .people-secondary { background: transparent; color: #b8b1a8; border: 1px solid #ffffff22; }
  .people-secondary:hover { color: #eee5d9; border-color: #ffffff40; }
  .people-danger { background: #67232a; border: 1px solid #a44b5566; color: #ffe2df; }
  .people-delete { color: #cc8f88; }
  .people-add { flex-shrink: 0; padding-inline: 12px; }
  .people-search { display: flex; align-items: center; gap: 9px; padding: 0 11px; border: 1px solid #ffffff20; border-radius: 999px; min-width: 0; color: #938f8b; flex: 1; background: #ffffff03; }
  .people-search input { width: 100%; min-width: 0; border: 0; background: transparent; color: #eee9e2; padding: 10px 0; outline: 0; font: inherit; font-size: 13px; }
  .people-search:focus-within { border-color: #ff984e; }
  .people-search svg { flex-shrink: 0; }
  .people-list-caption { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 17px 0 6px; color: #99938c; font-size: 11px; font-weight: 600; }
  .people-list-caption > :last-child { color: #dd9a68; font-variant-numeric: tabular-nums; }
  .people-rows { min-width: 0; }
  .people-row { min-width: 0; padding: 11px 0; min-height: 60px; box-sizing: border-box; border-bottom: 1px solid #ffffff09; }
  .people-row:last-child { border-bottom: 0; }
  .people-avatar, .people-group-avatar { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; object-fit: cover; font-size: 12px; font-weight: 650; background: #342820; color: #ead6c3; border: 1px solid #ffffff15; box-sizing: border-box; }
  .people-group-avatar { background: #ffffff06; color: #d69c72; }
  .people-row-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; text-align: left; }
  .people-row-copy strong { color: #e7e3dc; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; line-height: 1.35; }
  .people-row-copy small { color: #938e88; font-size: 11px; overflow-wrap: anywhere; }
  .people-group-row { width: 100%; background: transparent; border: 0; border-bottom: 1px solid #ffffff09; color: #8e8983; cursor: pointer; font: inherit; }
  .people-group-row:hover .people-row-copy strong { color: #fff1df; }
  .people-avatar-stack { display: flex; flex-shrink: 0; margin-left: 5px; }
  .people-avatar-stack .people-avatar { width: 24px; height: 24px; flex-basis: 24px; font-size: 8px; margin-left: -6px; border: 2px solid #121111; }
  .people-row-menu { position: relative; flex-shrink: 0; }
  .people-row-menu summary { list-style: none; }
  .people-row-menu summary::-webkit-details-marker { display: none; }
  .people-row-menu > div { position: absolute; right: 0; top: 35px; z-index: 5; border-radius: 12px; padding: 5px; border: 1px solid #ffffff24; background: #242222; box-shadow: 0 8px 24px #0006; width: max-content; }
  .people-row-menu > div button { display: flex; align-items: center; gap: 8px; font: inherit; font-size: 12px; border: 0; border-radius: 8px; background: transparent; color: #e2b3ac; padding: 10px; cursor: pointer; }
  .people-row-menu > div button:hover { background: #ffffff09; }
  .people-empty { padding: 28px 12px; text-align: center; color: #a39b91; font-size: 13px; line-height: 1.6; }
  .people-hint { color: #9e968d; font-size: 12px; line-height: 1.55; margin: 12px 0 0; overflow-wrap: anywhere; }
  .people-website { display: flex; align-items: center; justify-content: center; gap: 5px; border: 0; border-top: 1px solid #ffffff12; background: transparent; color: #aaa298; font: inherit; font-size: 12px; padding: 15px 8px 4px; cursor: pointer; width: 100%; margin-top: 4px; }
  .people-website:hover { color: #eee5d9; }
  .people-dialog { box-sizing: border-box; width: min(364px, calc(100% - 24px)); max-height: calc(100dvh - 24px); margin: auto; padding: 0; border: 1px solid #ffffff25; border-radius: 20px; background: #161515; color: #eee5d9; box-shadow: 0 24px 70px #0009; overflow: hidden; font: 13px/1.45 Inter, system-ui, sans-serif; color-scheme: dark; }
  .people-dialog[open] { display: flex; flex-direction: column; animation: people-dialog-in 150ms ease-out; }
  .people-dialog::backdrop { background: #0009; }
  .people-dialog-header { padding: 16px 16px 12px 20px; flex-shrink: 0; justify-content: space-between; }
  .people-dialog-header h2 { font-size: 17px; font-weight: 650; margin: 0; letter-spacing: -.25px; }
  .people-editor { display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .people-dialog-body { padding: 4px 20px 18px; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #ffffff30 transparent; }
  .people-field { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: #bbb2a7; }
  .people-field input { box-sizing: border-box; width: 100%; border: 1px solid #ffffff25; border-radius: 11px; padding: 11px 12px; color: #eee5d9; background: #ffffff04; font: inherit; font-size: 13px; }
  .people-member-list { max-height: 260px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #ffffff30 transparent; margin-top: 6px; }
  .people-member { cursor: pointer; }
  .people-member input { appearance: none; -webkit-appearance: none; width: 19px; height: 19px; flex: 0 0 19px; padding: 0; border: 1px solid #ffffff3d; border-radius: 6px; cursor: pointer; background: transparent; display: grid; place-items: center; }
  .people-member input:checked { background: #eee5d9; border-color: #eee5d9; }
  .people-member input:checked::after { content: ''; width: 8px; height: 4px; border: solid #29231c; border-width: 0 0 2px 2px; transform: rotate(-45deg) translateY(-1px); }
  .people-dialog-footer { padding: 12px 20px 16px; border-top: 1px solid #ffffff12; flex-shrink: 0; }
  .people-footer-spacer { flex: 1; }
  .people-discard { border-top: 1px solid #ffffff15; padding: 14px 20px 16px; color: #e5c8ae; flex-shrink: 0; }
  .people-discard > div { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
  .people-link-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; color: #e8ae7e; background: #b6773514; }
  .people-link-body > p { line-height: 1.6; }
  .people-link-body .people-field { margin-top: 18px; }
  .people-removal-name { margin: 0; font-weight: 650; overflow-wrap: anywhere; }
  .people-error { color: #efaaa1; font-size: 12px; line-height: 1.5; }
  .people-dialog .popup-people-action-notice { margin-top: 12px; }
  .popup-people-panel button:disabled, .people-dialog button:disabled, .people-dialog input:disabled { opacity: .5; cursor: default; }
  .popup-people-panel button:focus-visible, .people-dialog button:focus-visible, .people-dialog input:focus-visible, .people-row-menu summary:focus-visible { outline: 2px solid #ff984e; outline-offset: 2px; }
  @keyframes people-dialog-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { .people-modes::before, .people-modes button { transition: none; } .people-dialog[open] { animation: none; } }
  @media (max-width: 340px) { .people-list-tools { gap: 6px; } .people-add { padding-inline: 9px; } .people-avatar-stack { display: none; } .people-dialog-body { padding-inline: 14px; } .people-dialog-footer { padding-inline: 14px; gap: 7px; } }
`;

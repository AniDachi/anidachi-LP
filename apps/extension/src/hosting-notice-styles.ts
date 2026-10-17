export const hostingNoticeStyles = `
  .hosting-notice {
    margin: 14px 0 6px;
    padding: 18px;
    border: 1px solid rgba(255,255,255,.095);
    border-radius: 15px;
    background: linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));
    box-shadow: 0 6px 20px rgba(0,0,0,.1);
    color: #f3eee5;
    animation: hosting-notice-in 160ms ease-out;
  }
  .hosting-notice:focus { outline: none; }
  .hosting-notice-top { display:flex; align-items:center; justify-content:space-between; margin:0 0 13px; }
  .hosting-notice-symbol { color:#f5a466; flex-shrink:0; }
  .hosting-notice-symbol.neutral { color:#b8b9be; }
  .hosting-notice-close {
    display:grid; place-items:center; margin:-5px -6px -5px 0; padding:0;
    width:30px; height:30px; border:0; border-radius:8px; background:transparent;
    color:#85868b; cursor:pointer; transition:background 120ms,color 120ms;
  }
  .hosting-notice-close:hover { background:rgba(255,255,255,.065); color:#eee8df; }
  .hosting-notice h2 {
    margin:0; font-size:20px; font-weight:630; line-height:1.22; letter-spacing:-.55px;
    text-wrap:balance; color:#f3eee5;
  }
  .hosting-notice-description { margin-top:11px; }
  .hosting-notice-description p { margin:0; color:#b5b5b9; font-size:12.5px; line-height:1.65; font-weight:420; }
  .hosting-notice-description strong { color:#f5a466; font-weight:610; }
  .hosting-notice-description .hosting-notice-terms { margin-top:13px; color:#96969d; font-size:11.5px; line-height:1.65; }
  .hosting-notice-primary {
    position:relative; display:flex; align-items:center; justify-content:center;
    gap:10px; width:100%; min-height:42px; margin-top:20px; padding:11px 35px;
    border:1px solid rgba(255,255,255,.18); border-radius:9px;
    background:#f0e8db; color:#171713; font-size:13px; line-height:1.3; font-weight:650;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 5px rgba(0,0,0,.1);
    cursor:pointer; transition:background 140ms,transform 140ms;
  }
  .hosting-notice-primary svg { position:absolute; right:13px; }
  .hosting-notice-primary:hover { background:#fff7eb; }
  .hosting-notice-primary:active { transform:translateY(1px); }
  .hosting-notice-primary:focus-visible,.hosting-notice-close:focus-visible { outline:2px solid #f5a466; outline-offset:3px; }
  .hosting-notice .hosting-notice-footer { margin:13px 0 0; text-align:center; color:#85868e; font-size:10px; line-height:1.5; }
  @keyframes hosting-notice-in { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
  @media (prefers-reduced-motion:reduce) { .hosting-notice { animation:none; } .hosting-notice-primary { transition:none; } }

  .hosting-notice-primary { text-decoration: none; box-sizing: border-box; }
  .hosting-notice-primary:disabled { opacity: .55; cursor: default; transform: none; }
`;

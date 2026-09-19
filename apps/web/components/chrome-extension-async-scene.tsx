"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock3, LockKeyhole, MousePointer2, Pause, Pin, Play, SendHorizontal, SmilePlus } from "lucide-react";
// Presentation only: the actual extension's composer/chat CSS, no room clients.
import { overlayStyles } from "../../extension/src/styles";
import { ASYNC_DEMO_MESSAGE, ASYNC_DEMO_TIMINGS, useAsyncDemoTyping, type AsyncDemoPhase } from "../lib/use-async-demo";
import frame from "./chrome-extension-room-demo.module.css";

const SCENE_STYLES = `
  :host { display:block; position:absolute; inset:0; }
  .anidachi-overlay { z-index:2; --top-bubble-top:18px; --top-bubble-right:24px;
    --live-chat-left:28px; --live-chat-top:94px; --live-chat-width:320px; --live-chat-height:96px;
    --reaction-origin-x:calc(100% - 92px); --reaction-origin-y:calc(100% - 130px);
    --reaction-rise-y:-140px; --reaction-lift-x:-8px; --reaction-curve-x:-22px; --reaction-end-x:-35px; --reaction-duration:2600ms; }
  .top-bubble .async-label { font-size:12px; font-weight:600; color:#eee5d9; }
  .top-bubble > svg { color:#ff9b55; }
  .async-viewer { position:absolute; top:18px; left:28px; display:flex; align-items:center; gap:9px; color:#eee5d9; text-shadow:0 1px 6px #000; }
  .async-avatar { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; border:1px solid #dcc1a84d; background:#604b3c; font-size:11px; }
  .async-avatar[data-friend=true] { background:#55444f; border-color:#d6b5c74d; }
  .async-viewer > div { display:grid; gap:3px; }
  .async-viewer strong { font-size:13px; font-weight:600; }
  .async-viewer small { font-size:10px; color:#d2c7bd; }
  .live-chat-column.live { padding:0; mask-image:none; pointer-events:none; }
  .live-chat-column.live::before { display:none; }
  .live-chat-message { --live-chat-font-size:16px; --live-chat-line-height:23px; animation:async-content-in 400ms ease-out both; }
  .async-message-heading { display:flex; align-items:center; gap:10px; }
  .async-message-heading .live-chat-name { font-size:12px; }
  .async-message-time { display:flex; align-items:center; gap:4px; font-size:10px; font-weight:400; color:#d2c7bd; }
  .async-locked { position:absolute; left:28px; top:100px; display:flex; align-items:center; gap:8px; padding:10px 12px;
    border:1px solid #ffffff1a; border-radius:12px; background:#111114b8; backdrop-filter:blur(14px); font-size:12px; color:#d6cdc4; }
  .async-viewer,.async-locked { animation:async-content-in 400ms ease-out both; }
  .async-locked > svg { color:#ff9b55; }
  .message-composer { bottom:162px; pointer-events:none; animation:async-composer-in 400ms ease-out both; }
  .message-composer input { caret-color:#ffae74; }
  .message-composer-emoji-popover { grid-template-columns:repeat(6,31px); }
  .message-composer-emoji-popover button[data-selected=true] { background:#ffffff18; }
  [data-phase=send] .message-composer-send { animation:async-send-click 350ms 650ms ease both; }
  .async-compose-caption { position:absolute; bottom:218px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:7px; font-size:11px; color:#eee5d9; text-shadow:0 1px 6px #000; }
  [data-phase=emoji] .async-compose-caption { visibility:hidden; }
  .async-compose-caption kbd { display:inline-grid; place-items:center; padding:3px 6px; border:1px solid #ffffff38; border-radius:5px; background:#161419; font:inherit; }
  .async-playback { position:absolute; right:28px; bottom:28px; width:246px; padding:13px 15px; border:1px solid #ffffff1a; border-radius:14px; background:#111114cc; backdrop-filter:blur(14px); }
  .async-playback-heading { display:flex; align-items:center; gap:7px; font-size:11px; color:#eee5d9; }
  .async-playback-heading > span { flex:1; }
  .async-time { display:flex; align-items:center; gap:5px; color:#c8beb5; font-size:10px; font-variant-numeric:tabular-nums; }
  .async-time strong { color:#eee5d9; font-weight:500; }
  .async-track { position:relative; height:3px; margin-top:12px; border-radius:999px; background:#ffffff26; }
  .async-track-fill { display:block; width:51.3%; height:100%; background:#ff9b55; border-radius:inherit; transition:width 250ms ease; }
  .async-track-pin { position:absolute; left:51.3%; top:50%; width:7px; height:7px; transform:translate(-50%,-50%); border:1px solid #e2d7cb; border-radius:50%; background:#302923; }
  .async-track-pin[data-unlocked=true] { background:#ff9b55; border-color:#ff9b55; }
  .async-playback-status { display:flex; align-items:center; gap:5px; height:12px; margin-top:9px; color:#c8b9aa; font-size:10px; opacity:0; }
  .async-playback-status[data-visible=true] { opacity:1; }
  [data-phase=later] .async-track-fill { width:0; transition:none; }
  [data-phase=catching] .async-track-fill { width:26%; transition:width ${ASYNC_DEMO_TIMINGS.catching}ms linear; }
  [data-phase=approaching] .async-track-fill { width:51%; transition:width ${ASYNC_DEMO_TIMINGS.approaching}ms linear; }
  .async-time-jump { position:absolute; inset:0; display:grid; place-content:center; text-align:center; gap:8px; background:#09090b40; animation:async-time-jump ${ASYNC_DEMO_TIMINGS.later}ms ease both; }
  .async-time-jump strong { font-size:32px; font-weight:550; letter-spacing:-.03em; text-shadow:0 2px 20px #000; }
  .async-time-jump span { font-size:13px; color:#e3d8cc; text-shadow:0 1px 8px #000; }
  .async-cursor { position:absolute; z-index:60; left:var(--cursor-x,50%); top:var(--cursor-y,50%); color:white; filter:drop-shadow(0 2px 3px #0009); pointer-events:none; transition:left 550ms ease,top 550ms ease,opacity 240ms ease; opacity:0; }
  .async-cursor[data-visible=true] { opacity:1; }
  [data-phase=emoji] .async-cursor,[data-phase=send] .async-cursor { animation:async-send-click 350ms 650ms ease both; }
  .reaction-pop { font-size:32px; }
  [data-playing=false] *,[data-playing=false] *::before { animation-play-state:paused!important; }
  @keyframes async-content-in { from { opacity:0; } to { opacity:1; } }
  @keyframes async-composer-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes async-send-click { 50% { transform:scale(.8); } }
  @keyframes async-time-jump { 0%,100% { opacity:0; } 20%,80% { opacity:1; } }
  @media(max-width:639px) {
    .anidachi-overlay { --top-bubble-top:14px; --top-bubble-right:14px; --live-chat-left:18px; --live-chat-top:82px; --live-chat-width:calc(100% - 36px); --live-chat-height:80px; }
    .async-viewer { left:18px; top:14px; gap:7px; }
    .async-viewer strong { font-size:12px; }
    .async-viewer small { font-size:9px; }
    .async-avatar { width:30px; height:30px; font-size:10px; }
    .message-composer { bottom:132px; }
    .message-composer input { font-size:12px; }
    .async-compose-caption { bottom:187px; font-size:10px; }
    .async-locked { top:88px; left:18px; font-size:11px; }
    .async-playback { right:16px; bottom:16px; width:calc(100% - 32px); max-width:260px; }
    .async-time-jump strong { font-size:26px; }
  }
  @media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; } .async-cursor,.reaction-pop { display:none; } }
`;

export function AsyncScene({ phase, playing }: { phase: AsyncDemoPhase; playing: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const typed = useAsyncDemoTyping(phase, playing);
  const composing = ["compose", "writing", "emoji", "send"].includes(phase);
  const friend = phase === "watching" || composing || phase === "saved";
  const sent = phase === "saved" || phase === "unlocked";
  const locked = phase === "catching" || phase === "approaching";
  const time = phase === "watching" ? "12:31" : phase === "later" ? "0:00" : phase === "catching" ? "06:20" : phase === "approaching" ? "12:30" : "12:34";
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host) setShadow(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const target = shadow?.querySelector<HTMLElement>(phase === "emoji" ? '[data-cursor-target="emoji"]' : phase === "send" ? ".message-composer-send" : ".message-composer input");
    if (!host || !target) return;
    const position = () => {
      const bounds = host.getBoundingClientRect(), button = target.getBoundingClientRect();
      host.style.setProperty("--cursor-x", `${button.left - bounds.left + button.width / 2}px`);
      host.style.setProperty("--cursor-y", `${button.top - bounds.top + button.height / 2}px`);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(host); observer.observe(target);
    return () => observer.disconnect();
  }, [phase, shadow]);

  return <div ref={hostRef} className={frame.overlay} data-async-demo-host aria-hidden="true" inert>
    {shadow && createPortal(<>
      <style>{overlayStyles + SCENE_STYLES}</style>
      <div className="anidachi-overlay" data-phase={phase} data-playing={playing}>
        <div className="top-bubble-reveal bubble-visible"><button className="top-bubble" type="button" tabIndex={-1}><img src="/Anidachi_logo.webp" alt="" className="top-bubble-logo" /><Clock3 size={12} /><span className="async-label">Async</span></button></div>
        <div className="async-viewer" key={friend ? "viewer-emma" : "viewer-alex"}><span className="async-avatar" data-friend={friend}>{friend ? "E" : "A"}</span><div><strong>{friend ? "Emma" : "Alex"}</strong><small>{friend ? "Watching now" : "Watching 2 days later"}</small></div></div>
        {sent && <div className="live-chat-column live" key={`chat-${phase}`}>
          <div className="live-chat-message"><span className="async-message-heading"><span className="live-chat-name">Emma</span><span className="async-message-time"><Pin size={10} />12:34</span></span><span className="live-chat-text">{ASYNC_DEMO_MESSAGE} 🥹</span></div>
        </div>}
        {locked && <div className="async-locked"><LockKeyhole size={14} /><span>Emma’s message · hidden until 12:34</span></div>}
        {composing && <>
          <div className="async-compose-caption">{phase === "compose" ? <><kbd>Enter</kbd><span>Open chat</span></> : <><Pin size={12} /><span>Message at 12:34</span></>}</div>
          <div className="message-composer">
            <div className="message-composer-emoji"><button type="button" className="message-composer-emoji-button" tabIndex={-1} aria-expanded={phase === "emoji"}><SmilePlus size={17} /></button>
              {phase === "emoji" && <div className="message-composer-emoji-popover">{["❤️", "😂", "🥹", "🔥", "👏", "😮"].map(emoji => <button type="button" key={emoji} tabIndex={-1} data-selected={emoji === "🥹"} data-cursor-target={emoji === "🥹" ? "emoji" : undefined}>{emoji}</button>)}</div>}
            </div>
            <input value={typed} readOnly placeholder="Type a quick reaction" aria-label="Demo message" tabIndex={-1} />
            <button type="button" className="message-composer-send" disabled={!typed} tabIndex={-1}><SendHorizontal size={15} /></button>
          </div>
        </>}
        <div className="async-playback">
          <div className="async-playback-heading">{composing || phase === "saved" || phase === "later" ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}<span>Episode 04</span><div className="async-time"><strong>{time}</strong><span>/ 24:30</span></div></div>
          <div className="async-track"><span className="async-track-fill" />{(sent || locked || phase === "later") && <span className="async-track-pin" data-unlocked={phase === "unlocked"} />}</div>
          <div className="async-playback-status" data-visible={sent || locked}>{sent ? <><Check size={11} />{phase === "saved" ? "Message saved at 12:34" : "Emma’s moment, right on time"}</> : <><LockKeyhole size={11} />Reactions unlock as you watch</>}</div>
        </div>
        {phase === "later" && <div className="async-time-jump"><strong>2 days later</strong><span>Alex presses play</span></div>}
        {sent && <div key={`reaction-${phase}`} className="reaction-pop" data-ready="true">🥹</div>}
        <span className="async-cursor" data-visible={phase === "compose" || phase === "emoji" || phase === "send"}><MousePointer2 size={23} fill="white" stroke="#161318" strokeWidth={1.4} /></span>
      </div>
    </>, shadow)}
  </div>;
}

export const overlayStyles = `
  :host {
    color-scheme: dark;
  }

  * {
    box-sizing: border-box;
  }

  .anidachi-overlay {
    position: absolute;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: rgba(255, 255, 255, 0.92);
  }

  .anidachi-hidden {
    display: none;
  }

  .top-bubble {
    position: absolute;
    top: var(--top-bubble-top, 10px);
    right: var(--top-bubble-right, 10px);
    height: 30px;
    padding: 0 9px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(10, 10, 18, 0.38);
    backdrop-filter: blur(18px);
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
    transition:
      background 180ms ease,
      opacity 180ms ease,
      right 180ms ease,
      top 180ms ease,
      transform 180ms ease;
  }

  .anidachi-overlay.is-crunchyroll.player-controls-visible .top-bubble {
    background: rgba(10, 10, 18, 0.5);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .brand-dot {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-weight: 760;
    font-size: 12px;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
  }

  .sync-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #9ca3af;
  }

  .sync-dot.connected {
    background: #7dd3a7;
  }

  .sync-dot.warning {
    background: #fbbf24;
  }

  .bubble-count {
    font-size: 12px;
    font-weight: 650;
  }

  .mini-panel {
    position: absolute;
    top: var(--mini-panel-top, 48px);
    right: var(--mini-panel-right, 10px);
    width: min(300px, calc(100% - 20px));
    max-height: var(--mini-panel-max-height, calc(100% - 58px));
    overflow: auto;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(10, 10, 18, 0.62);
    backdrop-filter: blur(24px);
    box-shadow: 0 18px 56px rgba(0, 0, 0, 0.34);
    pointer-events: auto;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .panel-title {
    margin: 0;
    font-size: 16px;
    line-height: 1.2;
    font-weight: 760;
  }

  .panel-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.58);
  }

  .panel-actions,
  .emoji-row,
  .toggle-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .button,
  .icon-button {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.92);
    border-radius: 999px;
    height: 30px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 680;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .button.primary {
    border-color: transparent;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
  }

  .button.compact {
    height: 26px;
    padding: 0 9px;
    font-size: 10px;
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button {
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .section-title {
    margin: 14px 0 8px;
    font-size: 11px;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  .message-composer-shield {
    position: absolute;
    inset: 0;
    background: transparent;
    cursor: default;
    pointer-events: auto;
    touch-action: none;
  }

  .message-composer-shield.latched {
    cursor: none;
  }

  .message-composer-shield.releasing {
    cursor: default;
  }

  .message-composer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: clamp(72px, 12vh, 118px);
    width: min(430px, calc(100% - 36px));
    min-height: 44px;
    margin: 0 auto;
    padding: 6px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(10, 10, 18, 0.62);
    backdrop-filter: blur(24px);
    box-shadow: 0 18px 56px rgba(0, 0, 0, 0.34);
    display: flex;
    align-items: center;
    gap: 7px;
    pointer-events: auto;
    animation: anidachi-composer-in 120ms ease-out both;
  }

  .message-composer-emoji {
    position: relative;
    flex: 0 0 auto;
  }

  .message-composer-emoji-button {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.72);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      scale 160ms ease;
  }

  .message-composer-emoji-button:hover,
  .message-composer-emoji-button[aria-expanded="true"] {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.94);
  }

  .message-composer-emoji-button:active {
    scale: 0.96;
  }

  .message-composer-emoji-popover {
    position: absolute;
    left: -8px;
    bottom: 46px;
    padding: 8px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(10, 10, 18, 0.76);
    backdrop-filter: blur(24px);
    box-shadow: 0 18px 46px rgba(0, 0, 0, 0.34);
    display: grid;
    grid-template-columns: repeat(8, 31px);
    gap: 5px;
    animation: anidachi-composer-in 100ms ease-out both;
  }

  .message-composer-emoji-popover button {
    width: 31px;
    height: 31px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    cursor: pointer;
    font-size: 17px;
    line-height: 1;
    transition:
      background 140ms ease,
      scale 140ms ease;
  }

  .message-composer-emoji-popover button:hover {
    background: rgba(255, 255, 255, 0.1);
    scale: 1.06;
  }

  .message-composer input {
    min-width: 0;
    flex: 1 1 auto;
    height: 32px;
    border: 0;
    outline: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.94);
    font: inherit;
    font-size: 13px;
    font-weight: 620;
    letter-spacing: 0;
  }

  .message-composer input::placeholder {
    color: rgba(255, 255, 255, 0.38);
  }

  .message-composer-send {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
    color: rgba(255, 255, 255, 0.95);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .message-composer-send:disabled {
    cursor: not-allowed;
    opacity: 0.42;
    background: rgba(255, 255, 255, 0.12);
  }

  .participant-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .auth-card {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.055);
  }

  .auth-copy {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .auth-copy strong,
  .auth-copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .auth-copy strong {
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 720;
  }

  .auth-copy span {
    color: rgba(255, 255, 255, 0.52);
    font-size: 10px;
    font-weight: 620;
  }

  .auth-notice {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(251, 191, 36, 0.22);
    background: rgba(251, 191, 36, 0.08);
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    line-height: 1.35;
  }

  .auth-notice span {
    min-width: 0;
  }

  .participant-main {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .mini-avatar {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.1);
    font-size: 11px;
    font-weight: 760;
  }

  .participant-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 650;
  }

  .participant-status {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.52);
    flex: 0 0 auto;
  }

  .toggle {
    align-items: center;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    cursor: pointer;
  }

  .toggle span:first-child {
    font-size: 13px;
    font-weight: 650;
  }

  .toggle span:last-child {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.58);
  }

  .toggle:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .size-control {
    width: 100%;
    display: grid;
    gap: 8px;
    padding: 9px 10px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
  }

  .size-control-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .size-control-header span {
    font-size: 13px;
    font-weight: 650;
  }

  .size-control-header strong {
    color: rgba(255, 255, 255, 0.64);
    font-size: 12px;
    font-weight: 650;
  }

  .size-slider {
    width: 100%;
    height: 18px;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .size-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(124, 58, 237, 0.95), rgba(37, 99, 235, 0.95));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .size-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: #8b5cf6;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }

  .size-slider::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(124, 58, 237, 0.95), rgba(37, 99, 235, 0.95));
  }

  .size-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: #8b5cf6;
  }

  .size-ticks {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 9px;
    font-weight: 680;
    color: rgba(255, 255, 255, 0.42);
  }

  .mode-control {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 8px 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
  }

  .mode-control > span {
    min-width: 0;
    font-size: 13px;
    font-weight: 650;
  }

  .live-voice-status {
    min-height: 38px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    font-weight: 650;
  }

  .live-voice-status.talking {
    border-color: rgba(125, 211, 167, 0.36);
    background: rgba(34, 197, 94, 0.1);
    color: rgba(167, 243, 208, 0.94);
  }

  .live-voice-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.86);
    font-size: 13px;
  }

  .segmented-control {
    flex: 0 0 auto;
    min-width: 128px;
    height: 28px;
    margin: 0;
    padding: 2px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .segmented-control button {
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.54);
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    font-weight: 760;
    padding: 0 8px;
    transition:
      background 160ms ease,
      color 160ms ease;
  }

  .segmented-control button.selected {
    background: rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.92);
  }

  .current-resource-card {
    display: grid;
    gap: 6px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .current-resource-topline {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 10px;
    font-weight: 680;
    color: rgba(255, 255, 255, 0.52);
  }

  .current-resource-time {
    margin-left: auto;
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
  }

  .current-resource-title,
  .current-resource-episode {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current-resource-title {
    font-size: 12px;
    font-weight: 760;
  }

  .current-resource-episode {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.58);
  }

  .resource-provider-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.32);
    flex: 0 0 auto;
  }

  .resource-provider-dot.crunchyroll {
    background: #f97316;
  }

  .resource-provider-dot.netflix {
    background: #ef4444;
  }

  .resource-provider-dot.youtube {
    background: #f43f5e;
  }

  .resource-provider-dot.amazon {
    background: #38bdf8;
  }

  .resource-progress {
    width: 100%;
    height: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .resource-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #86efac, #22c55e);
  }

  .debug-box {
    display: grid;
    gap: 7px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
  }

  .debug-line {
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .debug-line strong {
    min-width: 0;
    color: rgba(255, 255, 255, 0.82);
    font-weight: 680;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .debug-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 3px;
  }

  .cam-stack {
    position: absolute;
    right: 12px;
    bottom: var(--cam-stack-bottom, 54px);
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-end;
    gap: var(--cam-bubble-gap, 8px);
    pointer-events: auto;
    transition:
      bottom 220ms ease,
      opacity 180ms ease,
      transform 180ms ease;
  }

  .anidachi-overlay.is-crunchyroll.player-controls-visible .cam-stack {
    transform: translateY(-2px);
  }

  .live-chat-column {
    position: absolute;
    right: 6px;
    bottom: var(--live-chat-bottom, 118px);
    width: min(205px, calc(100% - 12px));
    max-height: 122px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    gap: 5px;
    overflow: hidden;
    pointer-events: auto;
    transition:
      bottom 220ms ease,
      opacity 180ms ease,
      transform 180ms ease;
  }

  .live-chat-column.history {
    max-height: 172px;
    justify-content: flex-start;
    gap: 6px;
    padding: 12px 0 10px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    scrollbar-width: none;
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      black 18px,
      black calc(100% - 18px),
      transparent 100%
    );
  }

  .live-chat-column.history::-webkit-scrollbar {
    display: none;
  }

  .live-chat-column.history .live-chat-message {
    flex: 0 0 auto;
    animation: none;
  }

  .live-chat-message {
    max-width: 100%;
    display: grid;
    justify-items: start;
    gap: 1px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 13px;
    line-height: 1.18;
    font-weight: 660;
    letter-spacing: 0;
    text-shadow:
      0 1px 1px rgba(0, 0, 0, 0.86),
      0 0 2px rgba(0, 0, 0, 0.7),
      0 0 5px rgba(0, 0, 0, 0.35);
    animation: anidachi-live-chat-in 180ms ease-out both;
    overflow-wrap: anywhere;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .live-chat-message.ghost {
    max-height: 15px;
    opacity: 0.28;
    filter: blur(0.8px);
    overflow: hidden;
    mask-image: linear-gradient(to bottom, transparent 0%, black 36%, transparent 100%);
  }

  .live-chat-name {
    color: var(--chat-name-color, #c4a7ff);
    display: block;
    max-width: 100%;
    font-size: 10px;
    font-weight: 760;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .live-chat-text {
    display: block;
    max-width: 100%;
    color: rgba(255, 255, 255, 0.92);
  }

  .cam-bubble {
    width: var(--cam-bubble-size, 44px);
    height: var(--cam-bubble-size, 44px);
    border-radius: 999px;
    position: relative;
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(15, 15, 28, 0.54);
    opacity: 0.54;
    transition: opacity 180ms ease, transform 180ms ease;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
    isolation: isolate;
  }

  .cam-bubble.flame-active {
    opacity: 1;
    box-shadow:
      0 0 18px rgba(255, 241, 138, 0.64),
      0 0 46px rgba(249, 115, 22, 0.42),
      0 0 78px rgba(168, 85, 247, 0.22),
      0 10px 28px rgba(0, 0, 0, 0.3);
  }

  .cam-bubble.speaking {
    opacity: 1;
    box-shadow:
      0 0 0 1px rgba(125, 211, 167, 0.72),
      0 0 14px rgba(125, 211, 167, 0.22),
      0 10px 28px rgba(0, 0, 0, 0.3);
  }

  .nuke-burst {
    position: absolute;
    left: 50%;
    bottom: 58%;
    width: calc(var(--cam-bubble-size, 44px) * 1.28);
    height: calc(var(--cam-bubble-size, 44px) * 1.48);
    z-index: 4;
    overflow: visible;
    pointer-events: none;
    transform: translateX(-50%);
    transform-origin: 50% 100%;
    animation: anidachi-nuke-lift 2.5s ease-out forwards;
    mix-blend-mode: screen;
    filter: saturate(1.18);
  }

  .nuke-burst * {
    transform-box: fill-box;
    transform-origin: center;
  }

  .nuke-fireball {
    filter: blur(0.8px) drop-shadow(0 0 12px rgba(255, 218, 92, 0.86));
    opacity: 0;
    transform: scale(0.2);
    animation: anidachi-nuke-fireball 1.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .nuke-fireball-halo {
    fill: rgba(249, 115, 22, 0.58);
  }

  .nuke-fireball-core {
    fill: rgba(255, 218, 92, 0.95);
  }

  .nuke-fireball-white {
    fill: rgba(255, 255, 255, 0.96);
  }

  .nuke-shockwave {
    fill: none;
    stroke: rgba(255, 241, 138, 0.82);
    stroke-width: 2.6;
    filter: drop-shadow(0 0 8px rgba(255, 218, 92, 0.65));
    opacity: 0;
    transform: scale(0.36);
    animation: anidachi-nuke-shockwave 1.05s ease-out forwards;
  }

  .nuke-stem {
    filter: blur(0.8px);
    opacity: 0;
    transform: translateY(18px) scaleX(0.55) scaleY(0.2);
    animation: anidachi-nuke-stem 1.75s ease-out forwards;
  }

  .nuke-stem-smoke {
    fill: rgba(249, 115, 22, 0.54);
  }

  .nuke-stem-glow {
    fill: rgba(255, 241, 138, 0.58);
  }

  .nuke-cap {
    filter: blur(0.7px) drop-shadow(0 0 14px rgba(255, 204, 91, 0.5));
    opacity: 0;
    transform: translateY(20px) scale(0.22);
    animation: anidachi-nuke-cap 2.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .nuke-cap-shadow {
    fill: rgba(63, 63, 70, 0.46);
  }

  .nuke-cap-puff {
    fill: rgba(249, 115, 22, 0.66);
  }

  .nuke-cap-puff.puff-mid-left,
  .nuke-cap-puff.puff-mid-right {
    fill: rgba(255, 212, 92, 0.82);
  }

  .nuke-cap-core {
    fill: rgba(255, 244, 183, 0.58);
  }

  .nuke-cap-ring {
    fill: none;
    stroke: rgba(255, 237, 160, 0.48);
    stroke-width: 1.8;
  }

  .nuke-sparks {
    filter: drop-shadow(0 0 5px rgba(255, 218, 92, 0.88));
  }

  .nuke-spark {
    fill: rgba(255, 241, 138, 0.96);
    opacity: 0;
    transform: scale(0.3);
    animation: anidachi-nuke-spark 1.28s ease-out forwards;
  }

  .nuke-spark.spark-0 { --spark-x: -34px; --spark-y: -18px; animation-delay: 60ms; }
  .nuke-spark.spark-1 { --spark-x: -26px; --spark-y: -39px; animation-delay: 20ms; }
  .nuke-spark.spark-2 { --spark-x: -13px; --spark-y: -53px; animation-delay: 90ms; }
  .nuke-spark.spark-3 { --spark-x: 0px; --spark-y: -61px; animation-delay: 35ms; }
  .nuke-spark.spark-4 { --spark-x: 17px; --spark-y: -52px; animation-delay: 70ms; }
  .nuke-spark.spark-5 { --spark-x: 30px; --spark-y: -35px; animation-delay: 10ms; }
  .nuke-spark.spark-6 { --spark-x: 38px; --spark-y: -10px; animation-delay: 95ms; }
  .nuke-spark.spark-7 { --spark-x: 24px; --spark-y: 8px; animation-delay: 130ms; }
  .nuke-spark.spark-8 { --spark-x: -21px; --spark-y: 4px; animation-delay: 115ms; }
  .nuke-spark.spark-9 { --spark-x: -39px; --spark-y: 7px; animation-delay: 150ms; }
  .nuke-spark.spark-10 { --spark-x: 39px; --spark-y: 7px; animation-delay: 165ms; }
  .nuke-spark.spark-11 { --spark-x: 5px; --spark-y: -72px; animation-delay: 120ms; }

  .cam-bubble:hover,
  .cam-bubble.active {
    opacity: 1;
    transform: scale(1.08);
  }

  .cam-media,
  .cam-bubble video {
    width: 100%;
    height: 100%;
  }

  .cam-media,
  .fallback-face {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    background: rgba(15, 15, 28, 0.54);
    z-index: 1;
  }

  .cam-bubble video {
    object-fit: cover;
    transform: scaleX(-1);
  }

  .fallback-face {
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: calc(var(--cam-bubble-size, 44px) * 0.3);
  }

  .super-ring {
    position: absolute;
    inset: calc(var(--cam-bubble-size, 44px) * -0.13);
    width: auto;
    height: auto;
    overflow: visible;
    pointer-events: none;
    z-index: 2;
    transform: rotate(-90deg);
    filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.42));
  }

  .super-ring-track,
  .super-ring-progress {
    fill: none;
    stroke-width: 5;
  }

  .super-ring-track {
    stroke: rgba(255, 255, 255, 0.16);
  }

  .super-ring-progress {
    stroke: rgba(255, 190, 64, 0.98);
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    stroke-linecap: round;
  }

  .super-ring.charging .super-ring-progress {
    animation: anidachi-super-charge 1s linear forwards;
  }

  .super-ring.ready .super-ring-progress {
    stroke: rgba(255, 218, 92, 1);
    stroke-dashoffset: 0;
  }

  .live-dot {
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 8px;
    height: 8px;
    border: 2px solid rgba(10, 10, 18, 0.9);
    border-radius: 999px;
    background: #7dd3a7;
    z-index: 3;
  }

  .mic-dot {
    position: absolute;
    right: calc(var(--cam-bubble-size, 44px) * 0.04);
    bottom: calc(var(--cam-bubble-size, 44px) * 0.04);
    width: calc(var(--cam-bubble-size, 44px) * 0.22);
    height: calc(var(--cam-bubble-size, 44px) * 0.22);
    min-width: 13px;
    min-height: 13px;
    max-width: 18px;
    max-height: 18px;
    color: rgba(125, 255, 202, 0.98);
    display: grid;
    place-items: center;
    z-index: 5;
    filter:
      drop-shadow(0 0 2px rgba(4, 10, 8, 0.95))
      drop-shadow(0 0 8px rgba(52, 211, 153, 0.78));
    animation: anidachi-mic-dot-pulse 900ms ease-in-out infinite;
  }

  .mic-dot svg {
    width: 100%;
    height: 100%;
  }

  .reaction-pop {
    position: absolute;
    right: var(--reaction-right, 52px);
    bottom: var(--reaction-bottom, 94px);
    min-width: 44px;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: white;
    font-size: 24px;
    font-weight: 760;
    text-shadow: 0 3px 14px rgba(0, 0, 0, 0.7);
    animation: anidachi-pop 2.6s ease forwards;
    pointer-events: auto;
    transform-origin: right bottom;
  }

  .reaction-text {
    max-width: 240px;
    min-width: 86px;
    padding: 7px 10px 8px;
    border-radius: 14px;
    background: rgba(10, 10, 18, 0.54);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .reaction-author {
    max-width: 100%;
    color: rgba(255, 255, 255, 0.58);
    font-size: 10px;
    line-height: 1.05;
    font-weight: 760;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: none;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .reaction-message {
    max-width: 100%;
    color: rgba(255, 255, 255, 0.94);
    font-size: 13px;
    line-height: 1.2;
    font-weight: 680;
    overflow-wrap: anywhere;
  }

  @keyframes anidachi-pop {
    0% {
      opacity: 0;
      transform: translate3d(-4px, 10px, 0) scale(0.82);
    }
    16% {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
    78% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(10px, -42px, 0) scale(0.92);
    }
  }

  @keyframes anidachi-nuke-lift {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(8%) scale(0.72);
    }
    8% {
      opacity: 1;
    }
    72% {
      opacity: 1;
      transform: translateX(-50%) translateY(-12%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-23%) scale(1.08);
    }
  }

  @keyframes anidachi-nuke-fireball {
    0% {
      opacity: 0;
      transform: scale(0.16);
    }
    12% {
      opacity: 1;
      transform: scale(0.78);
    }
    60% {
      opacity: 0.88;
      transform: scale(1.18);
    }
    100% {
      opacity: 0;
      transform: scale(1.58);
    }
  }

  @keyframes anidachi-nuke-shockwave {
    0% {
      opacity: 0;
      transform: scale(0.2);
    }
    16% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: scale(2.18);
    }
  }

  @keyframes anidachi-nuke-stem {
    0% {
      opacity: 0;
      transform: translateY(18px) scaleX(0.55) scaleY(0.2);
    }
    18% {
      opacity: 0.95;
    }
    72% {
      opacity: 0.82;
      transform: translateY(-3px) scaleX(0.84) scaleY(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-14px) scaleX(1.08) scaleY(1.12);
    }
  }

  @keyframes anidachi-nuke-cap {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.22);
    }
    18% {
      opacity: 1;
    }
    62% {
      opacity: 0.9;
      transform: translateY(-2px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-15px) scale(1.12);
    }
  }

  @keyframes anidachi-live-chat-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes anidachi-composer-in {
    from {
      opacity: 0;
      translate: 0 8px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes anidachi-mic-dot-pulse {
    0% {
      transform: scale(0.96);
      opacity: 0.84;
      filter:
        drop-shadow(0 0 2px rgba(4, 10, 8, 0.95))
        drop-shadow(0 0 6px rgba(52, 211, 153, 0.58));
    }
    50% {
      transform: scale(1.08);
      opacity: 1;
      filter:
        drop-shadow(0 0 2px rgba(4, 10, 8, 0.95))
        drop-shadow(0 0 10px rgba(52, 211, 153, 0.9));
    }
    100% {
      transform: scale(0.96);
      opacity: 0.84;
      filter:
        drop-shadow(0 0 2px rgba(4, 10, 8, 0.95))
        drop-shadow(0 0 6px rgba(52, 211, 153, 0.58));
    }
  }

  @keyframes anidachi-nuke-spark {
    0% {
      opacity: 0;
      transform: scale(0.2);
    }
    16% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--spark-x), var(--spark-y)) scale(0.1);
    }
  }

  @keyframes anidachi-super-charge {
    from {
      stroke-dashoffset: 100;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  .catch-up {
    position: absolute;
    left: 50%;
    bottom: 32px;
    transform: translateX(-50%);
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(251, 191, 36, 0.34);
    background: rgba(26, 18, 8, 0.62);
    backdrop-filter: blur(18px);
    display: flex;
    align-items: center;
    gap: 9px;
    pointer-events: auto;
    font-size: 13px;
    font-weight: 680;
  }

  .footnote {
    margin-top: 12px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    line-height: 1.35;
  }
`;

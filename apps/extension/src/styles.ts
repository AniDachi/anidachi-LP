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
    --ad-accent: #ff8a3d;
    --ad-accent-strong: #f97316;
    --ad-accent-soft: rgba(249, 115, 22, 0.16);
    --ad-panel: rgba(10, 10, 12, 0.82);
    --ad-panel-strong: rgba(18, 17, 20, 0.92);
    --ad-surface-inset: rgba(0, 0, 0, 0.2);
    --ad-surface: rgba(255, 255, 255, 0.065);
    --ad-surface-strong: rgba(255, 255, 255, 0.1);
    --ad-border: rgba(255, 255, 255, 0.12);
    --ad-border-strong: rgba(255, 255, 255, 0.18);
    --ad-text: rgba(255, 255, 255, 0.93);
    --ad-muted: rgba(255, 255, 255, 0.56);
  }

  .anidachi-hidden {
    display: none;
  }

  .top-bubble-reveal {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }

  .top-bubble-reveal.panel-open {
    z-index: 31;
  }

  .top-bubble-edge-glow {
    position: absolute;
    top: 0;
    right: 0;
    width: 104px;
    height: 0;
    border-radius: 999px;
    background: transparent;
    box-shadow:
      0 3px 12px 6px rgba(255, 92, 20, 0.56),
      0 13px 32px 12px rgba(249, 115, 22, 0.34),
      0 18px 42px 14px rgba(76, 24, 4, 0.22);
    opacity: 0;
    transform: translateY(-4px) scaleX(0.7);
    transform-origin: right center;
    pointer-events: none;
    transition:
      opacity 120ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .top-bubble-reveal.edge-glow .top-bubble-edge-glow {
    opacity: 0.96;
    transform: translateY(0) scaleX(1);
  }

  .top-bubble {
    position: absolute;
    top: var(--top-bubble-top, 10px);
    right: var(--top-bubble-right, 10px);
    height: 32px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--ad-border-strong);
    background: rgba(9, 9, 11, 0.68);
    backdrop-filter: blur(22px) saturate(1.12);
    display: flex;
    align-items: center;
    gap: 7px;
    opacity: 0;
    transform: translateY(calc(-100% - var(--top-bubble-top, 10px)));
    z-index: 1;
    cursor: pointer;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    pointer-events: none;
    transition:
      border-color 180ms ease,
      background 180ms ease,
      opacity 180ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .top-bubble-reveal.bubble-visible .top-bubble {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .top-bubble-reveal.panel-open .top-bubble {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .top-bubble:focus-visible {
    outline: 2px solid rgba(147, 197, 253, 0.9);
    outline-offset: 2px;
  }

  .anidachi-overlay.player-controls-visible .top-bubble {
    background: rgba(9, 9, 11, 0.78);
    border-color: rgba(255, 138, 61, 0.28);
  }

  .top-bubble-logo {
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
    border-radius: 999px;
    object-fit: contain;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 5px 14px rgba(249, 115, 22, 0.16);
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
    top: min(var(--mini-panel-top, 48px), calc(100% - 28px));
    right: var(--mini-panel-right, 10px);
    width: min(324px, calc(100% - var(--mini-panel-right, 10px) - 10px));
    max-height: max(
      0px,
      calc(
        100% - var(--mini-panel-top, 48px) - var(--mini-panel-bottom-reserve, 10px)
      )
    );
    overflow: auto;
    overscroll-behavior: contain;
    padding: 13px;
    border-radius: 18px;
    border: 1px solid var(--ad-border);
    background:
      linear-gradient(180deg, rgba(23, 22, 25, 0.94) 0%, rgba(9, 9, 11, 0.84) 100%),
      var(--ad-panel);
    backdrop-filter: blur(28px) saturate(1.12);
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.48),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    cursor: default;
    pointer-events: auto;
    z-index: 30;
    scrollbar-width: none;
  }

  .mini-panel::-webkit-scrollbar {
    display: none;
  }

  .panel-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 12px;
    min-height: 36px;
    margin-bottom: 10px;
    padding: 1px 1px 11px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .panel-account {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
  }

  .panel-header .panel-account-avatar {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    font-size: 12px;
    background:
      linear-gradient(135deg, rgba(255, 138, 61, 0.34), rgba(255, 255, 255, 0.08)),
      rgba(255, 255, 255, 0.06);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      0 8px 18px rgba(0, 0, 0, 0.18);
  }

  .panel-account-copy {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 3px;
  }

  .panel-account-title-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
  }

  .panel-account-name {
    min-width: 0;
    flex: 0 1 auto;
    color: var(--ad-text);
    font-size: 14px;
    font-weight: 780;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plan-badge {
    height: 18px;
    padding: 0 7px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.72);
    display: inline-flex;
    align-items: center;
    font-size: 9px;
    font-weight: 820;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .plan-badge.free {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.68);
  }

  .plan-badge.plus {
    border-color: rgba(255, 138, 61, 0.28);
    background: rgba(249, 115, 22, 0.13);
    color: rgba(255, 205, 166, 0.94);
  }

  .plan-badge.pro {
    border-color: rgba(125, 211, 167, 0.26);
    background: rgba(34, 197, 94, 0.1);
    color: rgba(187, 247, 208, 0.94);
  }

  .panel-account-title-row .plan-badge {
    flex: 0 0 auto;
    height: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 8px;
    line-height: 1.1;
    transform: translateY(var(--plan-glyph-offset, -2px));
    text-shadow:
      0 1px 0 rgba(255, 255, 255, 0.045),
      0 -1px 0 rgba(0, 0, 0, 0.72);
  }

  .panel-room-summary,
  .panel-account-helper {
    min-width: 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 10.5px;
    font-weight: 650;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .panel-room-summary {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .panel-header-actions {
    display: flex;
    align-items: start;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
  }

  .panel-sign-in-button {
    height: 30px;
    padding: 0 10px;
  }

  .panel-actions {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 6px;
    margin-bottom: 8px;
    min-height: 36px;
  }

  .panel-actions .button {
    justify-content: center;
    min-width: 0;
  }

  .button.panel-primary-action {
    flex: 1 1 auto;
    height: 36px;
    min-height: 36px;
    min-width: 0;
    position: relative;
    overflow: hidden;
    font-size: 12px;
    font-weight: 760;
    transition:
      flex-basis 240ms cubic-bezier(0.22, 1, 0.36, 1),
      max-width 240ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 160ms ease,
      opacity 160ms ease;
  }

  .panel-primary-action span {
    position: relative;
    z-index: 1;
  }

  .panel-actions.room-empty .panel-primary-action {
    flex-basis: 100%;
    max-width: 100%;
  }

  .panel-actions.room-active .panel-primary-action {
    flex-basis: 112px;
    max-width: none;
  }

  .panel-primary-action.loading::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      transparent 0%,
      rgba(255, 255, 255, 0.34) 45%,
      transparent 70%
    );
    transform: translateX(-125%);
    animation: anidachi-room-action-sweep 920ms ease-in-out infinite;
  }

  .panel-primary-action.loading:disabled {
    opacity: 0.9;
    cursor: default;
  }

  .panel-action-icons {
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
    min-width: 0;
  }

  .panel-icon-action {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid var(--ad-border);
    background: var(--ad-surface);
    color: rgba(255, 255, 255, 0.78);
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .panel-icon-action.reveal-action {
    animation: anidachi-room-action-reveal 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--action-index, 0) * 42ms);
  }

  .panel-icon-action:not(:disabled):hover {
    border-color: rgba(255, 138, 61, 0.28);
    background: var(--ad-surface-strong);
    color: rgba(255, 235, 218, 0.96);
  }

  .panel-icon-action:not(:disabled):active {
    transform: translateY(1px);
  }

  .panel-icon-action.danger:not(:disabled):hover {
    border-color: rgba(248, 113, 113, 0.34);
    background: rgba(248, 113, 113, 0.1);
    color: rgba(254, 202, 202, 0.96);
  }

  .panel-icon-action.success,
  .panel-icon-action.success:not(:disabled):hover {
    border-color: rgba(52, 211, 153, 0.38);
    background: rgba(34, 197, 94, 0.1);
    color: rgba(110, 231, 183, 0.96);
  }

  .panel-icon-action:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .panel-icon-action.loading {
    opacity: 0.74;
    pointer-events: none;
  }

  .toggle-list {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .button,
  .icon-button {
    border: 1px solid var(--ad-border);
    background: var(--ad-surface);
    color: var(--ad-text);
    border-radius: 999px;
    height: 32px;
    padding: 0 11px;
    font-size: 11px;
    font-weight: 680;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .button.primary {
    border-color: transparent;
    background: linear-gradient(135deg, #ffb15f, var(--ad-accent-strong));
    color: rgba(28, 17, 9, 0.96);
    box-shadow: 0 10px 24px rgba(249, 115, 22, 0.2);
  }

  .button:not(:disabled):hover,
  .icon-button:not(:disabled):hover {
    border-color: rgba(255, 138, 61, 0.3);
    background: rgba(255, 255, 255, 0.1);
  }

  .button.primary:not(:disabled):hover {
    background: linear-gradient(135deg, #ffc07a, #fb7c24);
  }

  .button.primary.panel-primary-action.room-exit {
    border-color: rgba(248, 113, 113, 0.24);
    background: rgba(51, 35, 37, 0.88);
    color: rgba(255, 255, 255, 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
  }

  .button.primary.panel-primary-action.room-exit:not(:disabled):hover {
    border-color: rgba(248, 113, 113, 0.38);
    background: rgba(67, 39, 42, 0.94);
    color: rgba(255, 255, 255, 0.98);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .button.primary.panel-primary-action.room-exit.confirming {
    border-color: rgba(248, 113, 113, 0.52);
    background: rgba(88, 38, 42, 0.96);
    color: rgba(255, 255, 255, 0.98);
    box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.08);
  }

  .button:not(:disabled):active,
  .icon-button:not(:disabled):active {
    transform: translateY(1px);
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

  .icon-button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .icon-button {
    width: 32px;
    padding: 0;
    justify-content: center;
  }

  .icon-button.panel-camera-control {
    position: relative;
    width: 48px;
    height: 26px;
    box-sizing: border-box;
    overflow: hidden;
    padding: 0;
    flex: 0 0 auto;
    border-radius: 999px;
    border: 1px solid var(--ad-border);
    background: var(--ad-surface);
    box-shadow: none;
  }

  .icon-button.panel-camera-control.active {
    border-color: var(--ad-border);
    background: var(--ad-surface);
    box-shadow: none;
  }

  .icon-button.panel-camera-control.inactive {
    border-color: var(--ad-border);
    background: var(--ad-surface);
  }

  .icon-button.panel-camera-control.unavailable {
    border-color: var(--ad-border);
    background: var(--ad-surface);
    opacity: 1;
    cursor: not-allowed;
  }

  .panel-camera-control-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.05);
    transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .icon-button.panel-camera-control.active .panel-camera-control-thumb {
    transform: translateX(22px);
  }

  .panel-camera-control-icon {
    flex: 0 0 auto;
  }

  .icon-button.panel-camera-control.active .panel-camera-control-icon {
    color: rgba(134, 239, 172, 0.98);
  }

  .icon-button.panel-camera-control.inactive .panel-camera-control-icon {
    color: rgba(255, 255, 255, 0.56);
  }

  .icon-button.panel-camera-control.unavailable .panel-camera-control-icon {
    color: rgba(248, 113, 113, 0.72);
  }

  .icon-button.panel-camera-control:not(:disabled):hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: var(--ad-surface-strong);
  }

  .icon-button.panel-camera-control:focus {
    outline: 0;
  }

  .icon-button.panel-camera-control:focus-visible {
    box-shadow: 0 0 0 2px rgba(255, 166, 92, 0.38);
  }

  .section-title {
    margin: 14px 0 7px;
    font-size: 10px;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.58);
  }

  .section-title.compact {
    margin: 10px 0 4px;
    font-size: 10px;
  }

  .settings-section-title {
    margin: 18px 0 2px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .settings-shell {
    display: grid;
    gap: 8px;
  }

  .settings-category-rail {
    position: relative;
    min-width: 0;
    padding-bottom: 5px;
  }

  .settings-category-rail::before,
  .settings-category-rail::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 18px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }

  .settings-category-rail::before {
    left: -2px;
    background: linear-gradient(90deg, rgba(10, 10, 12, 0.98), rgba(10, 10, 12, 0));
  }

  .settings-category-rail::after {
    right: -2px;
    background: linear-gradient(270deg, rgba(10, 10, 12, 0.98), rgba(10, 10, 12, 0));
  }

  .settings-category-rail.can-scroll-left::before,
  .settings-category-rail.can-scroll-right::after {
    opacity: 1;
  }

  .settings-category-scroll {
    width: 100%;
    margin: 0;
    padding: 0 1px 4px;
    border: 0;
    border-radius: 0;
    background: transparent;
    display: flex;
    gap: 18px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-color: rgba(255, 138, 61, 0.28) rgba(255, 255, 255, 0.04);
    scrollbar-width: thin;
    scroll-snap-type: none;
    scroll-behavior: auto;
    cursor: default;
    user-select: none;
    touch-action: pan-x pan-y;
  }

  .settings-category-scroll::-webkit-scrollbar {
    height: 3px;
  }

  .settings-category-scroll::-webkit-scrollbar-track {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
  }

  .settings-category-scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 138, 61, 0.28);
  }

  .settings-category-rail.dragging .settings-category-scroll {
    cursor: grabbing;
    scroll-behavior: auto;
    scroll-snap-type: none;
  }

  .settings-category-tab {
    position: relative;
    height: 32px;
    flex: 0 0 auto;
    min-width: 0;
    padding: 0 2px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-size: 10.5px;
    font-weight: 690;
    line-height: 1;
    transition:
      color 160ms ease,
      opacity 160ms ease;
  }

  .settings-category-tab::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 22px;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ffad63, var(--ad-accent-strong));
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.22);
    transform: translateX(-50%) scaleX(0);
    transform-origin: center;
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .settings-category-tab:focus-visible {
    outline: 2px solid rgba(255, 184, 122, 0.66);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .settings-category-tab:hover {
    color: rgba(255, 255, 255, 0.78);
  }

  .settings-category-tab.active {
    color: rgba(255, 238, 224, 0.96);
  }

  .settings-category-tab.active::after {
    transform: translateX(-50%) scaleX(1);
  }

  .settings-panel {
    min-width: 0;
  }

  .settings-panel-stack {
    display: grid;
    gap: 6px;
  }

  .layout-editor-v2 {
    min-width: 0;
    display: grid;
    gap: 10px;
  }

  .layout-preview-v2 {
    box-sizing: border-box;
    container-type: inline-size;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 8px;
    background-color: rgba(5, 5, 8, 0.78);
    background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 54%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.035),
      inset 0 0 0 9px rgba(0, 0, 0, 0.08);
    touch-action: none;
  }

  .layout-grid-preview-v2 {
    z-index: 0;
    background-image:
      repeating-linear-gradient(
        to right,
        transparent 0,
        transparent calc(8.333% - 1px),
        rgba(255, 255, 255, 0.04) calc(8.333% - 1px),
        rgba(255, 255, 255, 0.04) 8.333%
      ),
      repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent calc(12.5% - 1px),
        rgba(255, 255, 255, 0.04) calc(12.5% - 1px),
        rgba(255, 255, 255, 0.04) 12.5%
      );
    pointer-events: none;
  }

  .layout-video-slot-v2 {
    z-index: 2;
    box-sizing: border-box;
    border-radius: 999px;
    border: 1px solid rgba(110, 231, 183, 0.52);
    background:
      linear-gradient(145deg, rgba(52, 211, 153, 0.32), rgba(15, 118, 110, 0.16)),
      rgba(10, 22, 19, 0.86);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 8px 18px rgba(0, 0, 0, 0.28);
  }

  .layout-video-slot-v2.is-ghost {
    z-index: 1;
    opacity: 0.42;
    border-color: rgba(110, 231, 183, 0.3);
    box-shadow: none;
  }

  button.layout-video-slot-v2.is-leader {
    padding: 0;
    cursor: grab;
    appearance: none;
    font: inherit;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      opacity 150ms ease;
  }

  button.layout-video-slot-v2.is-leader:active {
    cursor: grabbing;
  }

  button.layout-video-slot-v2.is-leader[data-selected="true"] {
    border-color: rgba(255, 166, 92, 0.92);
    box-shadow:
      0 0 0 2px rgba(249, 115, 22, 0.2),
      0 10px 22px rgba(0, 0, 0, 0.32);
  }

  .layout-chat-preview-v2 {
    z-index: 3;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 3px;
    min-width: 0;
    padding: 7px;
    border: 1px solid rgba(125, 184, 255, 0.42);
    border-radius: 7px;
    background:
      linear-gradient(180deg, rgba(71, 120, 188, 0.14), rgba(28, 51, 82, 0.22)),
      rgba(7, 12, 20, 0.82);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
    cursor: grab;
    appearance: none;
    font: inherit;
    user-select: none;
    -webkit-user-select: none;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .layout-chat-preview-v2 > * {
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .layout-chat-preview-v2:active {
    cursor: grabbing;
  }

  .layout-chat-preview-v2[data-selected="true"] {
    border-color: rgba(255, 166, 92, 0.88);
    box-shadow:
      0 0 0 2px rgba(249, 115, 22, 0.18),
      0 10px 22px rgba(0, 0, 0, 0.28);
  }

  .layout-video-slot-v2:focus-visible,
  .layout-chat-preview-v2:focus-visible {
    outline: 2px solid rgba(255, 190, 134, 0.9);
    outline-offset: 2px;
  }

  .layout-object-selector-v2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
  }

  .layout-object-selector-v2 button {
    min-width: 0;
    height: 30px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.52);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 740;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease;
  }

  .layout-object-selector-v2 button[aria-pressed="true"] {
    border-color: rgba(255, 138, 61, 0.28);
    background: rgba(249, 115, 22, 0.13);
    color: rgba(255, 229, 209, 0.96);
  }

  .layout-controls-v2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .layout-chat-mode-control-v2 {
    box-sizing: border-box;
    border-radius: 7px;
  }

  .layout-controls-v2 > button {
    min-width: 0;
    min-height: 36px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 0 11px;
    border: 1px solid rgba(255, 255, 255, 0.085);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.82);
    font: inherit;
    font-size: 11px;
    font-weight: 690;
    cursor: pointer;
    text-align: left;
  }

  .layout-controls-v2 > button:hover {
    border-color: rgba(255, 138, 61, 0.24);
    background: rgba(255, 255, 255, 0.055);
  }

  .stepped-setting-slider-v2 {
    min-width: 0;
    min-height: 66px;
    box-sizing: border-box;
    display: grid;
    gap: 5px;
    padding: 8px 11px 7px;
    border: 1px solid rgba(255, 255, 255, 0.085);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.82);
  }

  .stepped-setting-slider-header-v2 {
    min-width: 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    font-weight: 690;
  }

  .stepped-setting-slider-header-v2 strong {
    color: rgba(255, 181, 116, 0.86);
    font-size: 10px;
    font-weight: 710;
    white-space: nowrap;
  }

  .stepped-setting-slider-input-v2 {
    width: 100%;
    height: 18px;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .stepped-setting-slider-input-v2::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      #ffad63 0,
      var(--ad-accent-strong) var(--setting-slider-progress),
      rgba(255, 255, 255, 0.13) var(--setting-slider-progress),
      rgba(255, 255, 255, 0.13) 100%
    );
  }

  .stepped-setting-slider-input-v2::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5.5px;
    appearance: none;
    border: 2px solid rgba(255, 255, 255, 0.92);
    border-radius: 999px;
    background: var(--ad-accent);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.42);
  }

  .stepped-setting-slider-input-v2::-moz-range-track {
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.13);
  }

  .stepped-setting-slider-input-v2::-moz-range-progress {
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ffad63, var(--ad-accent-strong));
  }

  .stepped-setting-slider-input-v2::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: 2px solid rgba(255, 255, 255, 0.92);
    border-radius: 999px;
    background: var(--ad-accent);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.42);
  }

  .stepped-setting-slider-input-v2:focus-visible {
    outline: 2px solid rgba(255, 166, 92, 0.72);
    outline-offset: 2px;
    border-radius: 999px;
  }

  .top-bubble-open-mic {
    width: 16px;
    height: 16px;
    margin-right: -2px;
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.68);
    display: grid;
    place-items: center;
  }

  .top-bubble-open-mic.speaking {
    color: rgba(134, 239, 172, 0.98);
    filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.56));
  }

  .stepped-setting-slider-input-v2:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .stepped-setting-slider-endpoints-v2 {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: rgba(255, 255, 255, 0.38);
    font-size: 8px;
    font-weight: 650;
  }

  .layout-editor-actions-v2 {
    display: grid;
    grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
    gap: 6px;
    padding-top: 2px;
  }

  .layout-editor-actions-v2 button {
    height: 34px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.035);
    color: rgba(255, 255, 255, 0.58);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 750;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease;
  }

  .layout-editor-actions-v2 button:last-child {
    border-color: rgba(255, 138, 61, 0.38);
    background:
      linear-gradient(180deg, rgba(255, 161, 86, 0.94), rgba(249, 115, 22, 0.94)),
      #f97316;
    color: rgba(18, 8, 3, 0.96);
  }

  .layout-editor-v2 button:disabled,
  .layout-editor-v2 select:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .layout-editor-v2 > p[role="status"] {
    margin: -2px 0 0;
    color: rgba(255, 170, 132, 0.88);
    font-size: 10px;
    line-height: 1.35;
  }

  .reaction-shortcut-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    padding: 7px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.105);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028)),
      rgba(255, 255, 255, 0.035);
  }

  .reaction-shortcut {
    min-width: 0;
    height: 46px;
    padding: 5px 3px 6px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.035);
    color: var(--ad-text);
    cursor: pointer;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 4px;
    font: inherit;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }

  .reaction-shortcut:not(:disabled):hover {
    border-color: rgba(255, 138, 61, 0.24);
    background: rgba(255, 255, 255, 0.075);
  }

  .reaction-shortcut:not(:disabled):active {
    transform: translateY(1px);
  }

  .reaction-shortcut:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .reaction-shortcut-key {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.5);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 760;
    line-height: 1;
  }

  .reaction-shortcut-emoji {
    font-size: 17px;
    line-height: 1;
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
    border: 1px solid var(--ad-border);
    background: rgba(9, 9, 11, 0.82);
    backdrop-filter: blur(26px) saturate(1.1);
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
    border: 1px solid var(--ad-border);
    border-radius: 999px;
    background: var(--ad-surface);
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
    border: 1px solid var(--ad-border);
    background: rgba(9, 9, 11, 0.9);
    backdrop-filter: blur(26px) saturate(1.1);
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
    background: linear-gradient(135deg, #ffb15f, var(--ad-accent-strong));
    color: rgba(28, 17, 9, 0.96);
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

  .auth-notice {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 138, 61, 0.26);
    background: var(--ad-accent-soft);
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    line-height: 1.35;
  }

  .auth-notice span {
    min-width: 0;
  }

  .quota-note {
    margin-top: 8px;
    padding: 2px 4px 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 255, 255, 0.64);
    font-size: 10.5px;
    line-height: 1.3;
  }

  .quota-note strong {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.76);
    font: inherit;
    font-weight: 650;
  }

  .panel-sync-card {
    margin-top: 10px;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(255, 138, 61, 0.045), transparent 60%),
      var(--ad-surface-inset);
  }

  .panel-sync-card .section-title {
    margin-top: 0;
    margin-bottom: 8px;
  }

  .panel-sync-card .current-resource-card {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .playback-sync-notice {
    align-items: center;
    color: rgba(240, 240, 244, 0.72);
    display: flex;
    font-size: 13px;
    justify-content: space-between;
    line-height: 1.35;
    padding: 2px 4px;
  }

  .playback-sync-resume {
    background: transparent;
    border: 0;
    color: #ff9a5c;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 2px 0 2px 10px;
  }

  .invite-panel {
    margin-top: 10px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid var(--ad-border);
    background: rgba(0, 0, 0, 0.16);
  }

  .invite-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .invite-panel-header strong {
    min-width: 0;
    font-size: 12px;
    font-weight: 720;
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
    background: linear-gradient(135deg, rgba(255, 138, 61, 0.24), rgba(255, 255, 255, 0.08));
    color: rgba(255, 244, 234, 0.96);
    font-size: 11px;
    font-weight: 760;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  }

  .panel-camera-control:not(:disabled):hover {
    border-color: rgba(255, 138, 61, 0.24);
    background: rgba(255, 255, 255, 0.075);
    color: rgba(255, 236, 222, 0.92);
  }

  .panel-camera-control.active:not(:disabled):hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: var(--ad-surface-strong);
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
    color: var(--ad-muted);
    flex: 0 0 auto;
  }

  .room-people-section {
    margin-top: 12px;
  }

  .room-people-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .room-people-heading span:last-child {
    color: rgba(255, 255, 255, 0.38);
    font-size: 10px;
    font-weight: 720;
    letter-spacing: 0;
    text-transform: none;
  }

  .room-people-list {
    display: grid;
    gap: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    background: rgba(255, 255, 255, 0.018);
  }

  .room-people-entry + .room-people-entry {
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .room-people-row {
    position: relative;
    min-width: 0;
    min-height: 50px;
    padding: 8px 10px;
    border: 0;
    border-radius: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    color: rgba(255, 255, 255, 0.84);
    box-shadow: none;
    transition: background 150ms ease;
  }

  .room-people-row.host {
    background: transparent;
    box-shadow: none;
  }

  .room-people-row.self:not(.host) {
    background: rgba(255, 255, 255, 0.012);
  }

  .room-people-row.speaking {
    box-shadow: none;
  }

  .room-people-row.host.speaking {
    box-shadow: none;
  }

  .room-people-row.speaking .room-people-avatar {
    box-shadow: 0 0 0 2px rgba(97, 220, 154, 0.72);
  }

  .room-people-main {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .room-people-avatar {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    font-size: 10.5px;
  }

  .room-people-row.host .room-people-avatar {
    border-color: rgba(255, 138, 61, 0.18);
    background: rgba(255, 138, 61, 0.11);
    color: rgba(255, 235, 220, 0.96);
  }

  .room-people-copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .room-people-name-row {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .room-people-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 700;
  }

  .room-people-role,
  .room-people-you {
    flex: 0 0 auto;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
  }

  .room-people-role {
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(232, 156, 107, 0.92);
  }

  .room-people-you {
    color: rgba(255, 255, 255, 0.36);
  }

  .room-people-status {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255, 255, 255, 0.42);
    font-size: 9px;
    font-weight: 620;
    white-space: nowrap;
  }

  .room-people-media-status,
  .room-people-seat-status,
  .room-people-camera-status {
    display: inline-flex;
    align-items: center;
  }

  .room-people-media-status {
    gap: 6px;
  }

  .room-people-seat-status {
    gap: 3px;
    color: rgba(255, 255, 255, 0.5);
  }

  .room-people-camera-status {
    width: 14px;
    height: 14px;
    justify-content: center;
  }

  .room-people-camera-status.active {
    color: rgba(134, 239, 172, 0.9);
  }

  .room-people-camera-status.inactive {
    color: rgba(248, 113, 113, 0.68);
  }

  .room-people-side {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    min-width: 0;
  }

  .room-people-side.identity {
    align-self: stretch;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-start;
    padding-top: 3px;
  }

  .room-people-side.action {
    align-self: center;
  }

  .room-people-action {
    flex: 0 0 auto;
    min-width: 0;
    min-height: 27px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.025);
    color: rgba(255, 255, 255, 0.68);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 9.5px;
    font-weight: 720;
    letter-spacing: 0;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
  }

  .room-people-action svg {
    flex: 0 0 auto;
    color: rgba(255, 155, 84, 0.9);
  }

  .room-people-action:hover {
    border-color: rgba(255, 138, 61, 0.24);
    background: rgba(255, 138, 61, 0.07);
    color: rgba(255, 238, 226, 0.92);
  }

  .room-people-action:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .toggle {
    align-items: center;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 36px;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.105);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028)),
      rgba(255, 255, 255, 0.035);
    color: inherit;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease;
  }

  .toggle:hover {
    border-color: rgba(255, 138, 61, 0.28);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.04)),
      rgba(255, 255, 255, 0.052);
  }

  .toggle span:first-child {
    font-size: 12.5px;
    font-weight: 680;
  }

  .toggle span:last-child {
    font-size: 12px;
    color: var(--ad-muted);
  }

  .toggle-label {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
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
    border: 1px solid rgba(255, 255, 255, 0.105);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028)),
      rgba(255, 255, 255, 0.035);
  }

  .size-control.compact {
    gap: 7px;
    padding: 8px 9px 9px;
  }

  .size-control-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .size-control-header span {
    font-size: 12.5px;
    font-weight: 680;
  }

  .size-control-header strong {
    color: rgba(255, 181, 116, 0.78);
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
    background: linear-gradient(90deg, #ffb15f, var(--ad-accent-strong));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .size-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: var(--ad-accent);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }

  .size-slider::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ffb15f, var(--ad-accent-strong));
  }

  .size-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: var(--ad-accent);
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
    min-height: 36px;
    padding: 8px 8px 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.105);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028)),
      rgba(255, 255, 255, 0.035);
  }

  .mode-control > span {
    min-width: 0;
    font-size: 12.5px;
    font-weight: 680;
  }

  .live-voice-status {
    min-height: 36px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.105);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028)),
      rgba(255, 255, 255, 0.035);
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
    background: rgba(0, 0, 0, 0.2);
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
    background: rgba(255, 138, 61, 0.2);
    color: rgba(255, 221, 191, 0.96);
  }

  .voice-settings-panel {
    gap: 9px;
  }

  .voice-mode-control {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
  }

  .voice-mode-control button {
    border-radius: 7px;
    font-size: 11px;
  }

  .voice-settings-feedback {
    margin: 0;
    color: rgba(248, 180, 180, 0.9);
    font-size: 10.5px;
    line-height: 1.35;
  }

  .current-resource-card {
    display: grid;
    gap: 7px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background:
      linear-gradient(180deg, rgba(255, 138, 61, 0.045), rgba(255, 255, 255, 0.035)),
      rgba(0, 0, 0, 0.14);
  }

  .current-resource-topline {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 10px;
    font-weight: 680;
    color: var(--ad-muted);
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
    font-size: 13px;
    font-weight: 740;
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
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.11);
    overflow: visible;
    position: relative;
  }

  .resource-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ffc27e, var(--ad-accent-strong));
    position: relative;
    min-width: 2px;
  }

  .resource-progress span::after {
    content: "";
    position: absolute;
    top: 50%;
    right: 0;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #ffd1a6;
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.18);
    transform: translate(50%, -50%);
  }

  .debug-box {
    display: grid;
    gap: 7px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid var(--ad-border);
    background: rgba(0, 0, 0, 0.16);
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin-top: 3px;
  }

  .debug-actions .button {
    justify-content: center;
    min-width: 0;
    padding: 0 8px;
  }

  .debug-status {
    min-width: 0;
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 10px;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-footer-action {
    width: 100%;
    height: 30px;
    margin-top: 10px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.38);
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 160ms ease,
      color 160ms ease;
  }

  .account-footer-action:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 220, 196, 0.78);
  }

  .account-footer-action:disabled {
    cursor: not-allowed;
    opacity: 0.46;
  }

  .cam-stack {
    position: absolute;
    top: var(--cam-stack-top, 12px);
    right: auto;
    bottom: auto;
    left: var(--cam-stack-left, 12px);
    width: var(--cam-stack-width, auto);
    height: var(--cam-stack-height, var(--cam-bubble-size, 44px));
    display: flex;
    flex-direction: var(--cam-stack-direction, row-reverse);
    justify-content: flex-start;
    align-items: flex-end;
    gap: var(--cam-bubble-gap, 8px);
    pointer-events: none;
    z-index: 10;
    transition:
      left 220ms ease,
      top 220ms ease,
      opacity 180ms ease,
      transform 180ms ease;
  }

  .anidachi-overlay.player-controls-visible .cam-stack {
    transform: translateY(0);
  }

  .room-rail {
    position: absolute;
    top: calc(var(--top-bubble-top, 10px) + 44px);
    right: 0;
    bottom: var(--room-rail-bottom, 92px);
    width: min(184px, calc(100% - 10px));
    z-index: 20;
    overflow: visible;
    pointer-events: none;
  }

  .room-rail-edge {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 6px;
    pointer-events: auto;
  }

  .room-rail-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: 176px;
    max-height: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: rgba(10, 10, 12, 0);
    pointer-events: none;
    transform: none;
    transition:
      background 190ms ease,
      box-shadow 190ms ease;
  }

  .room-rail.open .room-rail-panel,
  .room-rail-panel:focus-within {
    background: rgba(10, 10, 12, 0);
    box-shadow: none;
  }

  .room-rail.open .room-rail-panel {
    pointer-events: auto;
  }

  .room-rail-panel.adjusting-audio {
    pointer-events: auto;
  }

  .room-rail-list {
    display: grid;
    justify-items: end;
    gap: 7px;
    max-height: 100%;
    overflow: visible;
  }

  .room-rail.open .room-rail-list,
  .room-rail-panel:focus-within .room-rail-list {
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  .room-rail.open .room-rail-list::-webkit-scrollbar,
  .room-rail-panel:focus-within .room-rail-list::-webkit-scrollbar {
    display: none;
  }

  .room-rail-slot {
    position: relative;
    min-height: 42px;
    width: 176px;
    border-radius: 999px 0 0 999px;
  }

  .room-rail-pill {
    position: absolute;
    top: 50%;
    right: 0;
    width: 0;
    height: 40px;
    padding: 0;
    border: 0 solid transparent;
    border-right: 0;
    border-radius: 999px 0 0 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    gap: 7px;
    opacity: 0;
    box-shadow: none;
    transform: translateY(-50%);
    overflow: hidden;
    pointer-events: none;
    transition:
      width 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
      padding 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .room-rail.open .room-rail-pill,
  .room-rail-panel:focus-within .room-rail-pill {
    width: 162px;
    padding: 4px 8px 4px 4px;
    border-width: 1px;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(13, 13, 16, 0.74);
    opacity: 1;
    pointer-events: auto;
    box-shadow:
      0 12px 30px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .room-rail-pill.speaking {
    width: 64px;
    padding: 4px 8px 4px 4px;
    border-width: 1px;
    border-color: rgba(125, 211, 167, 0.58);
    background:
      linear-gradient(90deg, rgba(34, 197, 94, 0.15), rgba(13, 13, 16, 0.74)),
      rgba(13, 13, 16, 0.74);
    opacity: 1;
    pointer-events: auto;
    box-shadow:
      0 0 20px rgba(34, 197, 94, 0.22),
      0 12px 30px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .room-rail.open .room-rail-pill.speaking,
  .room-rail-panel:focus-within .room-rail-pill.speaking {
    width: 162px;
  }

  .room-rail-slot.active .room-rail-pill {
    border-color: rgba(255, 255, 255, 0.22);
  }

  .room-rail-avatar {
    width: 31px;
    height: 31px;
    flex: 0 0 auto;
    border-radius: 999px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    font-size: 11px;
    font-weight: 820;
    line-height: 1;
  }

  .room-rail-pill.speaking .room-rail-avatar {
    border-color: rgba(125, 211, 167, 0.82);
    background: rgba(34, 197, 94, 0.14);
    color: rgba(220, 252, 231, 0.98);
    animation: anidachi-room-rail-avatar-pulse 1100ms ease-in-out infinite;
  }

  .room-rail-voice-bars {
    width: 17px;
    height: 17px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    opacity: 0.22;
    transform: translateX(6px);
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .room-rail-pill.speaking .room-rail-voice-bars {
    opacity: 1;
    transform: translateX(0);
  }

  .room-rail-pill:not(.speaking) .room-rail-voice-bars {
    opacity: 0;
  }

  .room-rail-voice-bars i {
    width: 3px;
    height: 5px;
    border-radius: 999px;
    background: rgba(125, 211, 167, 0.96);
  }

  .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(1) {
    animation: anidachi-room-rail-bar-1 680ms ease-in-out infinite;
  }

  .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(2) {
    animation: anidachi-room-rail-bar-2 620ms ease-in-out infinite;
  }

  .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(3) {
    animation: anidachi-room-rail-bar-3 740ms ease-in-out infinite;
  }

  .room-rail-copy {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 1px;
    opacity: 0;
    transform: translateX(8px);
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .room-rail.open .room-rail-copy,
  .room-rail-panel:focus-within .room-rail-copy {
    opacity: 1;
    transform: translateX(0);
  }

  .room-rail-name,
  .room-rail-status {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .room-rail-name {
    color: rgba(255, 255, 255, 0.94);
    font-size: 11.5px;
    font-weight: 760;
    line-height: 1.1;
  }

  .room-rail-status {
    color: rgba(255, 255, 255, 0.54);
    font-size: 9.5px;
    font-weight: 650;
    line-height: 1.1;
  }

  .room-rail-slot.speaking .room-rail-status {
    color: rgba(255, 200, 164, 0.78);
  }

  .participant-audio-inline-control {
    width: 84px;
    height: 30px;
    flex: 0 0 84px;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 5px;
    opacity: 0;
    pointer-events: none;
    transform: translateX(5px);
    transition:
      opacity 140ms ease,
      transform 160ms ease;
  }

  .room-rail.open .room-rail-slot:hover .room-rail-copy,
  .room-rail.open .room-rail-slot:focus-within .room-rail-copy {
    opacity: 0;
    pointer-events: none;
    transform: translateX(-4px);
  }

  .room-rail.open .room-rail-slot:hover .participant-audio-inline-control,
  .room-rail.open .room-rail-slot:focus-within .participant-audio-inline-control,
  .room-rail-panel.adjusting-audio .participant-audio-inline-control {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
  }

  .room-rail.open .room-rail-slot:hover .participant-audio-inline-control {
    opacity: 1;
  }

  .participant-audio-inline-control input[type="range"] {
    width: 56px;
    min-width: 0;
    height: 20px;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
    touch-action: none;
  }

  .participant-audio-inline-control input[type="range"]::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
  }

  .participant-audio-inline-control input[type="range"]::-webkit-slider-thumb {
    width: 11px;
    height: 11px;
    margin-top: -4px;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.84);
    border-radius: 999px;
    background: rgba(255, 145, 69, 0.98);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .participant-audio-inline-control input[type="range"]::-moz-range-track {
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
  }

  .participant-audio-inline-control input[type="range"]::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: 1px solid rgba(255, 255, 255, 0.84);
    border-radius: 999px;
    background: rgba(255, 145, 69, 0.98);
  }

  .participant-audio-mute {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .participant-audio-mute:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.92);
  }

  .participant-audio-mute:focus-visible,
  .participant-audio-inline-control input[type="range"]:focus-visible,
  .participant-audio-contour-slider:focus-visible {
    outline: 2px solid rgba(255, 166, 92, 0.7);
    outline-offset: 2px;
  }

  .room-rail-more {
    width: 40px;
    height: 28px;
    margin-left: auto;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.66);
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 760;
    transform: translateX(1px);
  }

  .live-chat-column {
    position: absolute;
    top: var(--live-chat-top, 12px);
    right: auto;
    bottom: auto;
    left: var(--live-chat-left, 12px);
    width: var(--live-chat-width, 205px);
    height: var(--live-chat-height, 122px);
    max-width: calc(100% - 12px);
    max-height: calc(100% - 12px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    gap: 5px;
    overflow: hidden;
    pointer-events: auto;
    z-index: 10;
    transition:
      left 220ms ease,
      top 220ms ease,
      width 220ms ease,
      max-height 220ms ease,
      opacity 180ms ease,
      transform 180ms ease;
  }

  .live-chat-column.live {
    flex-direction: column;
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

  .live-chat-column.live::before {
    content: "";
    flex: 0 0 auto;
    margin-top: auto;
  }

  .live-chat-column.live::-webkit-scrollbar {
    display: none;
  }

  .overlay-layout-ghost-preview {
    position: absolute;
    inset: 0;
    z-index: 19;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
  }

  .overlay-layout-camera-ghost {
    border: 1px dashed rgba(110, 231, 183, 0.82);
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.2);
    box-shadow:
      inset 0 0 0 1px rgba(236, 253, 245, 0.12),
      0 8px 24px rgba(0, 0, 0, 0.22);
    opacity: 0.82;
  }

  .overlay-layout-camera-ghost.is-leader {
    border-style: solid;
    background: rgba(16, 185, 129, 0.26);
    opacity: 0.9;
  }

  .layout-chat-preview-shell {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    gap: 5px;
    padding: 8px 10px;
    overflow: hidden;
    border: 1px dashed rgba(147, 197, 253, 0.92);
    border-radius: 10px;
    background: rgba(30, 64, 175, 0.22);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
  }

  .live-chat-column.layout-chat-preview-shell {
    justify-content: flex-start;
    gap: 5px;
    padding: 8px 10px;
    overflow: hidden;
    mask-image: none;
  }

  .live-chat-message.overlay-layout-chat-preview-message {
    width: 100%;
    font-size: inherit;
    line-height: inherit;
    max-height: none;
    opacity: var(--live-chat-message-opacity, 1);
    filter: none;
    animation: none;
  }

  .live-chat-column.history {
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

  .live-chat-column.history::before {
    content: "";
    flex: 0 0 auto;
    margin-top: auto;
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
    font-size: var(--live-chat-font-size, 13px);
    line-height: var(--live-chat-line-height, 16px);
    font-weight: 660;
    letter-spacing: 0;
    text-shadow:
      0 1px 1px rgba(0, 0, 0, 0.86),
      0 0 2px rgba(0, 0, 0, 0.7),
      0 0 5px rgba(0, 0, 0, 0.35);
    animation: anidachi-live-chat-in 180ms ease-out both;
    max-height: calc(var(--live-chat-line-height, 16px) + 13px);
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    opacity: var(--live-chat-message-opacity, 1);
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
    display: -webkit-box;
    max-width: 100%;
    color: rgba(255, 255, 255, 0.92);
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }

  .live-chat-column.history .live-chat-message {
    max-height: none;
    overflow: visible;
  }

  .live-chat-column.history .live-chat-text {
    display: block;
    overflow: visible;
  }

  .live-chat-column.live .live-chat-message {
    flex: 0 0 auto;
    max-height: none;
    overflow: visible;
    opacity: var(--live-chat-message-opacity, 1);
  }

  .live-chat-column.live .live-chat-text {
    display: block;
    overflow: visible;
    overflow-wrap: anywhere;
    -webkit-line-clamp: unset;
  }

  .live-chat-column.layout-chat-preview-shell .live-chat-message {
    flex: 0 1 auto;
    max-height: none;
    overflow: visible;
    animation: none;
  }

  .live-chat-column.layout-chat-preview-shell .live-chat-text {
    display: block;
    overflow: visible;
    overflow-wrap: anywhere;
    -webkit-line-clamp: unset;
  }

  .layout-chat-preview-v2 .live-chat-message {
    max-height: none;
    overflow: visible;
  }

  .layout-chat-preview-v2 .live-chat-text {
    display: block;
    overflow: visible;
    overflow-wrap: anywhere;
    -webkit-line-clamp: unset;
  }

  .cam-bubble {
    width: var(--cam-bubble-size, 44px);
    height: var(--cam-bubble-size, 44px);
    border-radius: 999px;
    position: relative;
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.24);
    background: rgba(15, 15, 28, 0.82);
    opacity: 1;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;
    box-shadow:
      0 0 0 1px rgba(8, 10, 18, 0.5),
      0 10px 28px rgba(0, 0, 0, 0.34);
    isolation: isolate;
    pointer-events: auto;
  }

  .cam-bubble.flame-active {
    box-shadow:
      0 0 18px rgba(255, 241, 138, 0.64),
      0 0 46px rgba(249, 115, 22, 0.42),
      0 0 78px rgba(168, 85, 247, 0.22),
      0 10px 28px rgba(0, 0, 0, 0.3);
  }

  .cam-bubble.speaking {
    border-color: rgba(125, 255, 202, 0.92);
    box-shadow:
      0 0 18px rgba(52, 211, 153, 0.34),
      0 10px 28px rgba(0, 0, 0, 0.3);
  }

  .participant-audio-contour-control {
    position: absolute;
    inset: -8px;
    z-index: 8;
    border-radius: 999px;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.96);
    transition:
      opacity 140ms ease,
      transform 160ms ease;
  }

  .cam-bubble:hover .participant-audio-contour-control,
  .cam-bubble:focus-within .participant-audio-contour-control {
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
  }

  .cam-bubble:hover .participant-audio-contour-control {
    pointer-events: auto;
  }

  .participant-audio-contour-slider {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    cursor: crosshair;
    touch-action: none;
  }

  .participant-audio-contour-arc {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: conic-gradient(
      from 135deg,
      rgba(255, 151, 78, 0.98) 0deg var(--participant-volume-progress),
      rgba(255, 255, 255, 0.2) var(--participant-volume-progress) 270deg,
      transparent 270deg 360deg
    );
    mask: radial-gradient(
      farthest-side,
      transparent calc(100% - 4px),
      #000 calc(100% - 3px)
    );
    pointer-events: none;
    filter: drop-shadow(0 0 4px rgba(255, 138, 61, 0.24));
  }

  .participant-audio-contour-control.muted .participant-audio-contour-arc {
    background: conic-gradient(
      from 135deg,
      rgba(248, 113, 113, 0.74) 0deg var(--participant-volume-progress),
      rgba(255, 255, 255, 0.16) var(--participant-volume-progress) 270deg,
      transparent 270deg 360deg
    );
  }

  .participant-audio-contour-control > .participant-audio-mute {
    position: absolute;
    left: 50%;
    bottom: -2px;
    z-index: 2;
    width: 18px;
    height: 18px;
    transform: translateX(-50%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(12, 12, 15, 0.9);
    color: rgba(255, 255, 255, 0.72);
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

  .cam-bubble:hover {
    border-color: rgba(255, 255, 255, 0.36);
    transform: scale(1.04);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 12px 30px rgba(0, 0, 0, 0.38);
  }

  .cam-bubble.active {
    border-color: rgba(255, 255, 255, 0.36);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 12px 30px rgba(0, 0, 0, 0.38);
  }

  .cam-bubble.speaking,
  .cam-bubble.speaking:hover,
  .cam-bubble.speaking.active {
    border-color: rgba(125, 255, 202, 0.94);
    box-shadow:
      0 0 18px rgba(52, 211, 153, 0.34),
      0 12px 30px rgba(0, 0, 0, 0.38);
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
    pointer-events: none;
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

  .cam-media,
  .cam-bubble video {
    width: 100%;
    height: 100%;
  }

  .cam-media {
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
      opacity: var(--live-chat-message-opacity, 1);
    }
  }

  @keyframes anidachi-room-action-reveal {
    from {
      opacity: 0;
      transform: translateX(-8px) scale(0.88);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes anidachi-room-action-sweep {
    0% {
      transform: translateX(-125%);
    }
    58%,
    100% {
      transform: translateX(125%);
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

  @keyframes anidachi-room-rail-avatar-pulse {
    0%,
    100% {
      box-shadow:
        0 0 0 2px rgba(34, 197, 94, 0.12),
        0 0 16px rgba(34, 197, 94, 0.22);
    }
    50% {
      box-shadow:
        0 0 0 5px rgba(34, 197, 94, 0.05),
        0 0 24px rgba(34, 197, 94, 0.34);
    }
  }

  @keyframes anidachi-room-rail-bar-1 {
    0%,
    100% {
      height: 5px;
    }
    45% {
      height: 12px;
    }
  }

  @keyframes anidachi-room-rail-bar-2 {
    0%,
    100% {
      height: 10px;
    }
    50% {
      height: 5px;
    }
  }

  @keyframes anidachi-room-rail-bar-3 {
    0%,
    100% {
      height: 6px;
    }
    52% {
      height: 14px;
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

  @media (prefers-reduced-motion: reduce) {
    .top-bubble,
    .top-bubble-edge-glow,
    .panel-primary-action,
    .panel-icon-action,
    .panel-icon-action.reveal-action,
    .layout-video-slot-v2,
    .layout-chat-preview-v2,
    .layout-object-selector-v2 button,
    .layout-editor-actions-v2 button {
      animation: none;
      transition: none;
    }

    .panel-primary-action.loading::after {
      display: none;
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

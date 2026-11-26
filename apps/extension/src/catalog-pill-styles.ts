export const catalogPillStyles = `
  .catalog-pill-dock {
    position: absolute; top: var(--top-bubble-top); right: var(--top-bubble-right);
    width: var(--catalog-pill-width); height: var(--catalog-pill-height, 32px); pointer-events: none;
  }
  .catalog-pill-dock > i, .catalog-pill-dock::before {
    position: absolute; inset: 0; border-radius: 999px; opacity: 0;
    border: 1px solid #efb78e;
  }
  .catalog-pill-dock::before {
    content: ""; border-color: #efbe9b85;
    background: linear-gradient(180deg, #e4b39212, #19171b38);
    transition: opacity 150ms ease;
  }
  [data-catalog-dragging][data-catalog-floating] .catalog-pill-dock::before { opacity: 1; }
  [data-prime-browsing] .top-bubble { touch-action: none; user-select: none; cursor: grab; }
  [data-catalog-dragging] .top-bubble { cursor: grabbing; border-color: #efae7980; }
  [data-catalog-floating] .top-bubble-reveal {
    --top-bubble-top: var(--catalog-pill-y);
    --top-bubble-right: calc(100% - var(--catalog-pill-x) - var(--catalog-pill-width));
  }
  /* The dock inherits the original provider coordinates, including after window resize. */
  [data-catalog-floating] .catalog-pill-dock { top: var(--catalog-home-top); right: var(--catalog-home-right); }
  [data-prime-browsing] { --catalog-home-top: var(--top-bubble-top); --catalog-home-right: var(--top-bubble-right); }
  [data-catalog-floating][data-catalog-return-right] .catalog-return-to-video {
    right: auto; left: var(--catalog-pill-x); max-width: calc(100% - var(--catalog-pill-x) - 4px);
    padding: 0 9px 0 calc(var(--catalog-pill-width) + 6px);
  }
  [data-catalog-floating] .mini-panel {
    --catalog-panel-width: min(324px, calc(100% - 16px));
    width: var(--catalog-panel-width); right: auto;
    left: clamp(8px, calc(var(--catalog-pill-x) + var(--catalog-pill-width) - var(--catalog-panel-width)), calc(100% - var(--catalog-panel-width) - 8px));
    top: calc(var(--catalog-pill-y) + 40px);
    max-height: max(0px, calc(100% - var(--catalog-pill-y) - 48px));
  }
  [data-catalog-floating][data-catalog-panel-above] .mini-panel {
    top: auto; bottom: calc(100% - var(--catalog-pill-y) + 8px);
    max-height: max(0px, calc(var(--catalog-pill-y) - 16px));
  }
  [data-catalog-floating] .panel-pointer-guard,
  [data-prime-browsing] .top-bubble-edge-glow { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .catalog-pill-dock::before { transition: none; }
  }
`;

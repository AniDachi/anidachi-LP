export const free20WarningStyles = `
  .free20-warning-notice {
    position: absolute;
    top: calc(var(--top-bubble-top, 10px) + 42px);
    right: var(--top-bubble-right, 10px);
    z-index: 32;
    width: min(288px, calc(100% - 20px));
    padding: 13px 14px;
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 14px;
    background: rgba(18, 18, 21, 0.96);
    color: rgba(255, 255, 255, 0.95);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
    pointer-events: auto;
    font-size: 13px;
    line-height: 1.5;
  }
  .free20-warning-actions { display: flex; align-items: center; gap: 18px; margin-top: 8px; }
  .free20-warning-actions a { color: #fbbf24; text-decoration: underline; text-underline-offset: 3px; }
  .free20-warning-actions button { border: 0; background: transparent; color: rgba(255, 255, 255, 0.72); padding: 4px; font: inherit; cursor: pointer; }
  .free20-warning-actions :is(a, button):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; border-radius: 3px; }
`;

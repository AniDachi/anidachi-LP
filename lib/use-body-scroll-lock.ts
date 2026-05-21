import { useEffect } from "react";

/** Prevents page scroll behind overlays; restores scroll position on unlock. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    const scrollY = window.scrollY;
    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;
    const prev = {
      bodyPosition: bodyStyle.position,
      bodyTop: bodyStyle.top,
      bodyLeft: bodyStyle.left,
      bodyRight: bodyStyle.right,
      bodyWidth: bodyStyle.width,
      bodyOverflow: bodyStyle.overflow,
      htmlOverflow: htmlStyle.overflow,
    };

    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = prev.bodyPosition;
      bodyStyle.top = prev.bodyTop;
      bodyStyle.left = prev.bodyLeft;
      bodyStyle.right = prev.bodyRight;
      bodyStyle.width = prev.bodyWidth;
      bodyStyle.overflow = prev.bodyOverflow;
      htmlStyle.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

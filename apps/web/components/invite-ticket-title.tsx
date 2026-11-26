"use client";

import { useLayoutEffect, useRef } from "react";
import styles from "./invite-ticket.module.css";

export function InviteTicketTitle({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    let lastWidth = -1;

    function fit(element: HTMLHeadingElement) {
      const width = element.clientWidth;
      if (!width || width === lastWidth) return;
      lastWidth = width;

      element.style.removeProperty("font-size");
      element.removeAttribute("data-fitted");
      const style = getComputedStyle(element);
      const fits = () => element.offsetHeight <= 3 * parseFloat(style.lineHeight) + 1;
      if (fits()) return;

      // Keep the largest readable size that fits the actual wrapped text.
      // At the lower bound the full title can flow onto additional lines.
      element.setAttribute("data-fitted", "");
      let low = 28;
      let high = Math.floor(parseFloat(style.fontSize));
      while (low < high) {
        const size = Math.ceil((low + high) / 2);
        element.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size - 1;
      }
      element.style.fontSize = `${low}px`;
    }

    fit(heading);
    const observer = new ResizeObserver(() => fit(heading));
    observer.observe(heading);
    return () => observer.disconnect();
  }, [title]);

  return <h1 id="ticket-title" className={styles.title} ref={ref}>{title}</h1>;
}

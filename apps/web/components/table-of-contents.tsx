"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, List } from "lucide-react";

export type TocHeading = {
  id: string;
  label: string;
  level: 2 | 3;
};

const HEADER_OFFSET = 88;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y =
    el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: y, behavior: "smooth" });
}

export function TableOfContents({ headings }: { headings: TocHeading[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  const setFromObserver = useCallback((id: string) => {
    setActive(id);
  }, []);

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((n): n is HTMLElement => n !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length > 0) {
          const top = vis.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0];
          if (top.target.id) setFromObserver(top.target.id);
        }
      },
      { root: null, rootMargin: `-${HEADER_OFFSET}px 0px -55% 0px`, threshold: [0, 0.1, 0.2, 0.4] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, setFromObserver]);

  if (headings.length === 0) return null;

  const list = (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 font-semibold text-ani-text">On this page</p>
      <ul className="space-y-1.5 border-l-2 border-ani-line pl-3">
        {headings.map((h) => (
          <li
            key={h.id}
            className={cn(
              h.level === 3 && "ml-3",
              "transition-colors -ml-px pl-2 border-l-2 -translate-x-[1px]"
            )}
            style={{
              borderLeftColor:
                active === h.id ? "var(--ani-progress)" : "transparent",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActive(h.id);
                // Collapse first: the mobile list changes the heading's position.
                if (open) flushSync(() => setOpen(false));
                scrollToId(h.id);
              }}
              className={cn(
                "w-full text-left transition-colors hover:text-ani-text",
                active === h.id ? "font-medium text-ani-text" : "text-ani-muted"
              )}
            >
              {h.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-[12px] border border-ani-line bg-ani-panel lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left font-medium text-ani-text"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2">
            <List className="h-4 w-4 text-ani-muted" aria-hidden="true" />
            Contents
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-ani-muted transition-transform",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        {open && <div className="border-t border-ani-line bg-ani-canvas px-4 py-3">{list}</div>}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24 max-h-[min(80vh,32rem)] overflow-y-auto rounded-[12px] border border-ani-line bg-ani-panel/80 py-3 pr-1 pl-1">
          {list}
        </div>
      </div>
    </>
  );
}

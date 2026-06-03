"use client";

import { useCallback, useEffect, useState } from "react";
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
      <p className="mb-2 font-semibold text-gray-900">On this page</p>
      <ul className="space-y-1.5 border-l-2 border-gray-200 pl-3">
        {headings.map((h) => (
          <li
            key={h.id}
            className={cn(
              h.level === 3 && "ml-3",
              "transition-colors -ml-px pl-2 border-l-2 -translate-x-[1px]"
            )}
            style={{
              borderLeftColor:
                active === h.id ? "rgb(147 51 234)" : "transparent",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActive(h.id);
                scrollToId(h.id);
                setOpen(false);
              }}
              className={cn(
                "text-left w-full hover:text-purple-600 transition-colors",
                active === h.id ? "text-purple-600 font-medium" : "text-gray-600"
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
      <div className="lg:hidden mb-6 rounded-lg border border-gray-200 bg-gray-50/80 p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-medium text-gray-900"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2">
            <List className="h-4 w-4 text-gray-500" aria-hidden="true" />
            Contents
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-gray-500 transition-transform",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        {open && <div className="border-t border-gray-200 bg-white px-4 py-3">{list}</div>}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24 max-h-[min(80vh,32rem)] overflow-y-auto pr-1">
          {list}
        </div>
      </div>
    </>
  );
}

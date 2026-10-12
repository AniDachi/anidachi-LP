"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Shuffle } from "lucide-react";

export type SpinLength = "short" | "medium" | "long";

export type SpinEntry = {
  slug: string;
  title: string;
  episodes: string;
  genres: string;
  length: SpinLength;
  posterUrl: string | null;
};

function Poster({ entry, className = "" }: { entry: SpinEntry; className?: string }) {
  if (!entry.posterUrl) return null;
  return (
    <Image
      src={entry.posterUrl}
      alt={`${entry.title} poster`}
      width={160}
      height={240}
      sizes="(max-width: 640px) 96px, 160px"
      className={`aspect-[2/3] w-full rounded-xl object-cover shadow-lg ring-1 ring-ani-line ${className}`}
    />
  );
}

const LENGTHS: { id: SpinLength | "any"; label: string }[] = [
  { id: "any", label: "Any length" },
  { id: "short", label: "Up to 26 eps" },
  { id: "medium", label: "27–100 eps" },
  { id: "long", label: "100+ eps" },
];

const EXTRA_LINKS: Record<string, { href: string; label: string }[]> = {
  "one-piece": [
    {
      href: "/tools/one-piece-how-many-episodes",
      label: "How many episodes One Piece has",
    },
    { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
  ],
  naruto: [
    { href: "/tools/naruto-filler-list", label: "Naruto filler list" },
    {
      href: "/tools/naruto-shippuden-filler-list",
      label: "Shippuden filler list",
    },
  ],
};

// Delays (ms) between reel ticks: quick at first, easing out before the landing.
const REEL_DELAYS = [45, 45, 50, 55, 60, 70, 80, 90, 105, 120, 140, 165, 195, 230, 275];

export function AnimeSpin({ entries, initialSlug }: { entries: SpinEntry[]; initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [length, setLength] = useState<SpinLength | "any">("any");
  const [spins, setSpins] = useState(0);
  const [reelTitle, setReelTitle] = useState<string | null>(null);
  const [reelTick, setReelTick] = useState(0);
  const [pending, setPending] = useState<SpinEntry | null>(null);
  const timers = useRef<number[]>([]);
  const spinning = reelTitle !== null;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const pool = useMemo(
    () => (length === "any" ? entries : entries.filter((entry) => entry.length === length)),
    [entries, length],
  );

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (entries.some((entry) => entry.slug === hash)) setSlug(hash);
  }, [entries]);

  const current = entries.find((entry) => entry.slug === slug) ?? entries[0];
  if (!current) return null;
  const extras = EXTRA_LINKS[current.slug] ?? [];

  function land(next: SpinEntry) {
    setReelTitle(null);
    setPending(null);
    setSlug(next.slug);
    setSpins((n) => n + 1);
    window.history.replaceState(null, "", `#${next.slug}`);
  }

  function pick(from: SpinEntry[], animate = true) {
    const options = from.length > 1 ? from.filter((entry) => entry.slug !== slug) : from;
    if (options.length === 0) return;
    const next = options[Math.floor(Math.random() * options.length)];

    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced || from.length < 3) {
      land(next);
      return;
    }

    // Flick through other titles in the pool, never showing the same one twice in a row.
    let shown = current.title;
    let at = 0;
    REEL_DELAYS.forEach((delay, i) => {
      at += delay;
      timers.current.push(
        window.setTimeout(() => {
          const choices = from.filter((entry) => entry.title !== shown && entry.slug !== next.slug);
          shown = (choices[Math.floor(Math.random() * choices.length)] ?? next).title;
          setReelTitle(shown);
          setReelTick(i + 1);
        }, at),
      );
    });
    timers.current.push(window.setTimeout(() => land(next), at + 320));
    setReelTitle(current.title);
    setReelTick(0);
    setPending(next);
  }

  function chooseLength(next: SpinLength | "any") {
    setLength(next);
    const nextPool = next === "any" ? entries : entries.filter((entry) => entry.length === next);
    if (!nextPool.some((entry) => entry.slug === slug)) pick(nextPool, false);
  }

  return (
    <div className="not-prose overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel">
      <div
        className="flex gap-2 overflow-x-auto border-b border-ani-line px-4 py-3 sm:px-6 [scrollbar-width:none]"
        role="radiogroup"
        aria-label="Series length"
      >
        {LENGTHS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            disabled={spinning}
            aria-checked={length === item.id}
            onClick={() => chooseLength(item.id)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus ${
              length === item.id
                ? "bg-ani-primary text-ani-on-primary"
                : "border border-ani-control-border text-ani-text hover:bg-ani-hover"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
        <div className="relative w-24 shrink-0 sm:w-40">
          {spinning ? (
            <div
              aria-hidden
              className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-ani-hover ring-1 ring-ani-line"
            >
              <div className="h-full w-full motion-safe:animate-[cover-shimmer_900ms_linear_infinite] bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,var(--color-ani-text)_10%,transparent)_50%,transparent_70%)] bg-[length:250%_100%]" />
            </div>
          ) : current.posterUrl ? (
            <div
              key={`cover-${current.slug}-${spins}`}
              className={
                spins > 0
                  ? "motion-safe:animate-[cover-in_520ms_cubic-bezier(0.22,1.2,0.36,1)_both]"
                  : ""
              }
            >
              <Poster entry={current} />
            </div>
          ) : (
            <div
              aria-hidden
              className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-ani-hover text-3xl font-semibold text-ani-muted ring-1 ring-ani-line"
            >
              {current.title.charAt(0)}
            </div>
          )}
          {/* Warm the image cache so the landing cover is already loaded. */}
          {pending?.posterUrl ? (
            <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden>
              <Poster entry={pending} />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-ani-muted">
            {spinning ? "Spinning…" : spins === 0 ? "Start here" : `Spin ${spins}`} · {pool.length}{" "}
            shows in this pool
          </p>
          <div
            className={`relative mt-3 overflow-hidden ${
              spinning
                ? "[mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
                : ""
            }`}
          >
            {spinning ? (
              <p
                key={reelTick}
                aria-hidden
                className="truncate text-3xl font-semibold tracking-[-0.035em] text-ani-muted animate-[reel-tick_110ms_ease-out] sm:text-4xl"
              >
                {reelTitle}
              </p>
            ) : (
              <p
                key={`${current.slug}-${spins}`}
                className={`text-balance text-3xl font-semibold tracking-[-0.035em] text-ani-text sm:text-4xl ${
                  spins > 0
                    ? "motion-safe:animate-[reel-land_420ms_cubic-bezier(0.34,1.56,0.64,1)]"
                    : ""
                }`}
              >
                {current.title}
              </p>
            )}
          </div>
          <p
            key={`meta-${current.slug}-${spins}`}
            className={`mt-2 text-ani-muted transition-opacity duration-200 ${
              spinning ? "opacity-0" : "motion-safe:animate-[spin-in_260ms_ease-out_120ms_both]"
            }`}
          >
            {current.episodes} · {current.genres}
          </p>
          <p className="sr-only" aria-live="polite">
            {spins > 0 && !spinning ? `Picked ${current.title}, ${current.episodes}` : ""}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => pick(pool)}
              disabled={spinning}
              aria-busy={spinning}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ani-primary px-6 text-base font-medium text-ani-on-primary transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus ${
                spins > 0 && !spinning ? "motion-safe:animate-[reel-glow_600ms_ease-out]" : ""
              }`}
            >
              <Shuffle
                className={`h-4 w-4 transition-transform duration-500 ease-out ${
                  spinning ? "motion-safe:rotate-[360deg] motion-safe:duration-[1600ms]" : ""
                }`}
                aria-hidden
              />
              {spinning ? "Spinning…" : spins === 0 ? "Spin" : "Spin again"}
            </button>
            <Link
              href={`/watch/${current.slug}-with-friends`}
              className="group inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-medium text-ani-text underline decoration-ani-line underline-offset-4 hover:decoration-ani-text"
            >
              How to watch {current.title} with friends
              <ArrowUpRight
                className="h-4 w-4 text-ani-muted transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>

          {extras.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-ani-line pt-4 text-sm">
              {extras.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ani-muted underline decoration-ani-line underline-offset-4 hover:text-ani-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import styles from "./upcoming-platforms.module.css";

// Supported platforms link to their hubs. Glyphs match the watch-history
// platform switch (app/account/watch-library/history-browser.tsx).
const supportedPlatforms = [
  {
    name: "Crunchyroll",
    href: "/watch-crunchyroll-together",
    label: "Crunchyroll watch party",
    color: "#F47521",
    viewBox: "0 0 24 24",
    paths: [
      "M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z",
    ],
  },
  {
    name: "Netflix",
    href: "/netflix-watch-party",
    label: "Netflix watch party",
    color: "#E50914",
    viewBox: "0 0 141 277",
    paths: [
      "M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676L44.051 119.724v151.073C28.647 272.418 14.594 274.58 0 276.742V0h41.08l56.212 157.021V0h43.511v258.904z",
    ],
  },
  {
    name: "YouTube",
    href: "/watch-youtube-together",
    label: "Watch YouTube together",
    color: "#FF0000",
    viewBox: "0 0 24 24",
    paths: [
      "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.121 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z",
    ],
    playTriangle: "m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z",
  },
];

// Brand artwork: Hulu and Disney+ from https://github.com/pheralb/svgl
// (static/library); Paramount+ from https://commons.wikimedia.org/wiki/File:Paramount%2B_logo.svg.
// These marks identify planned integrations, not currently supported providers.
const platforms = [
  { name: "Hulu", file: "hulu", width: 110, height: 36 },
  { name: "Disney+", file: "disneyplus", width: 162, height: 92 },
  { name: "Paramount+", file: "paramountplus", width: 190, height: 44 },
];

export function UpcomingPlatforms() {
  return (
    <aside className={styles.section} aria-labelledby="supported-platforms-title">
      <div className={styles.container}>
        <h2 id="supported-platforms-title" className={styles.title}>
          Works on Crunchyroll, Netflix and YouTube.
        </h2>
        <ul className={styles.supported} aria-label="Supported platforms">
          {supportedPlatforms.map((platform) => (
            <li key={platform.name}>
              <Link href={platform.href} className={styles.supportedLink}>
                <svg
                  viewBox={platform.viewBox}
                  className={styles.glyph}
                  aria-hidden="true"
                  style={{ color: platform.color }}
                >
                  {platform.paths.map((d) => (
                    <path key={d} d={d} fill="currentColor" />
                  ))}
                  {platform.playTriangle ? (
                    <path d={platform.playTriangle} fill="#fff" />
                  ) : null}
                </svg>
                <span className={styles.supportedLabel}>
                  {platform.label}
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <h3 id="upcoming-platforms-title" className={styles.subtitle}>
          More platforms. <span>Coming soon.</span>
        </h3>
        <ul className={styles.logos} aria-label="Platforms coming soon">
          {platforms.map((platform) => (
            <li key={platform.file}>
              <Image
                src={`/platforms/${platform.file}.svg`}
                alt={platform.name}
                width={platform.width}
                height={platform.height}
                className={styles.logo}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

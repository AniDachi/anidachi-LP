import Image from "next/image";
import Link from "next/link";
import type { PageLocale } from "@/lib/locale/ui-strings";
import styles from "./upcoming-platforms.module.css";
import { PLATFORM_GLYPHS, PLATFORM_LOGOS } from "@/lib/platforms";
import { PLANNED_PLATFORMS, SUPPORTED_PLATFORMS } from "@/lib/product-facts";

/** German hub links and labels for /de; keyed by platform name. */
const DE_SUPPORTED: Record<string, { href: string; label: string }> = {
  Crunchyroll: { href: "/de/crunchyroll-watchparty", label: "Crunchyroll Watchparty" },
  Netflix: { href: "/de/netflix-watchparty", label: "Netflix Watchparty" },
  YouTube: { href: "/de/youtube-watchparty", label: "YouTube Watchparty" },
};

const COPY = {
  en: { title: "Works on Crunchyroll, Netflix and YouTube.", supported: "Supported platforms", more: "More platforms.", soon: "Coming soon.", soonList: "Platforms coming soon", soonSuffix: "watch party (coming soon)" },
  de: { title: "Funktioniert mit Crunchyroll, Netflix und YouTube.", supported: "Unterstützte Dienste", more: "Weitere Dienste.", soon: "Bald verfügbar.", soonList: "Dienste, die bald kommen", soonSuffix: "Watchparty (bald verfügbar)" },
} as const;

export function UpcomingPlatforms({ locale = "en" }: { locale?: PageLocale } = {}) {
  const copy = COPY[locale];
  const de = locale === "de";
  return (
    <aside className={styles.section} aria-labelledby="supported-platforms-title">
      <div className={styles.container}>
        <h2 id="supported-platforms-title" className={styles.title}>
          {copy.title}
        </h2>
        <ul className={styles.supported} aria-label={copy.supported}>
          {SUPPORTED_PLATFORMS.map((platform) => {
            const glyph = PLATFORM_GLYPHS[platform.name];
            return (
              <li key={platform.name}>
                <Link href={de ? DE_SUPPORTED[platform.name].href : platform.hubPath} className={styles.supportedLink}>
                  {glyph ? (
                    <svg
                      viewBox={glyph.viewBox}
                      className={styles.glyph}
                      aria-hidden="true"
                      style={{ color: glyph.color }}
                    >
                      {glyph.paths.map((d) => (
                        <path key={d} d={d} fill="currentColor" />
                      ))}
                      {glyph.playTriangle ? <path d={glyph.playTriangle} fill="#fff" /> : null}
                    </svg>
                  ) : null}
                  <span className={styles.supportedLabel}>
                    {de ? DE_SUPPORTED[platform.name].label : platform.hubLabel}
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <h3 id="upcoming-platforms-title" className={styles.subtitle}>
          {copy.more} <span>{copy.soon}</span>
        </h3>
        <ul className={styles.logos} aria-label={copy.soonList}>
          {PLANNED_PLATFORMS.map((name) => ({ name, ...PLATFORM_LOGOS[name] }))
            .filter((platform) => platform.file)
            .map((platform) => (
              <li key={platform.file}>
                {platform.href && !de ? (
                  <Link
                    href={platform.href}
                    className={styles.logoLink}
                    aria-label={`${platform.name} ${copy.soonSuffix}`}
                  >
                    <Image
                      src={`/platforms/${platform.file}.svg`}
                      alt=""
                      width={platform.width}
                      height={platform.height}
                      className={styles.logo}
                    />
                  </Link>
                ) : (
                  <Image
                    src={`/platforms/${platform.file}.svg`}
                    alt={platform.name}
                    width={platform.width}
                    height={platform.height}
                    className={styles.logo}
                  />
                )}
              </li>
            ))}
        </ul>
        {de ? null : (
          <p className="mt-6 text-center text-sm">
            <Link
              href="/watch-party-app"
              className="text-ani-muted underline decoration-ani-line underline-offset-4 transition-colors hover:text-ani-text"
            >
              All supported streaming services
            </Link>
          </p>
        )}
      </div>
    </aside>
  );
}

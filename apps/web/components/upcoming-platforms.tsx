import Image from "next/image";
import styles from "./upcoming-platforms.module.css";

// Brand artwork: Netflix, Hulu and Disney+ from https://github.com/pheralb/svgl
// (static/library); Paramount+ from https://commons.wikimedia.org/wiki/File:Paramount%2B_logo.svg.
// These marks identify planned integrations, not currently supported providers.
const platforms = [
  { name: "Netflix", file: "netflix", width: 140, height: 38 },
  { name: "Hulu", file: "hulu", width: 110, height: 36 },
  { name: "Disney+", file: "disneyplus", width: 162, height: 92 },
  { name: "Paramount+", file: "paramountplus", width: 190, height: 44 },
];

export function UpcomingPlatforms() {
  return (
    <aside className={styles.section} aria-labelledby="upcoming-platforms-title">
      <div className={styles.container}>
        <h2 id="upcoming-platforms-title" className={styles.title}>
          More platforms. <span>Coming soon.</span>
        </h2>
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

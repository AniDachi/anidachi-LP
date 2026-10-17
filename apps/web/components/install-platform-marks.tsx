import { ProviderLogo } from "../../extension/src/provider-logo";
import styles from "./extension-install.module.css";

// YouTube and Netflix artwork: https://github.com/pheralb/svgl (static/library).
/** Passive supported-platform marks; these are not links. */
export function InstallPlatformMarks() {
  return (
    <ul className={styles.platforms} aria-label="Watch together on these platforms">
      <li><span className={styles.youtube} role="img" aria-label="YouTube" /></li>
      <li className={styles.crunchyroll}>
        <ProviderLogo provider="crunchyroll" label="Crunchyroll" />
        <span>Crunchyroll</span>
      </li>
      <li><span className={styles.netflix} role="img" aria-label="Netflix" /></li>
    </ul>
  );
}

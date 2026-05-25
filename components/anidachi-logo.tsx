import Link from "next/link";
import { ANIDACHI_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

type AnidachiLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  /** Decorative instances (e.g. next to visible text) should hide from AT. */
  "aria-hidden"?: boolean;
};

/** Circular AniDachi mark — native img so alpha is preserved (no optimizer). */
export function AnidachiLogo({
  size = 32,
  className,
  alt = "AniDachi logo",
  priority,
  "aria-hidden": ariaHidden,
}: AnidachiLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- must keep PNG alpha
    <img
      src={ANIDACHI_LOGO_SRC}
      alt={ariaHidden ? "" : alt}
      width={size}
      height={size}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      aria-hidden={ariaHidden}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

type AnidachiLogoLinkProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
  priority?: boolean;
};

/** Homepage link with logo + optional wordmark (nav, footer). */
export function AnidachiLogoLink({
  size = 32,
  showWordmark = true,
  wordmarkClassName,
  className,
  priority,
}: AnidachiLogoLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 transition-opacity hover:opacity-90",
        className,
      )}
    >
      <AnidachiLogo size={size} priority={priority} />
      {showWordmark ? (
        <span className={cn("font-semibold", wordmarkClassName)}>AniDachi</span>
      ) : null}
    </Link>
  );
}

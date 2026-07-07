type AnidachiLogoMarkProps = {
  className?: string;
  size?: number;
};

const anidachiLogoUrl =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("Anidachi_logo.png")
    : "/Anidachi_logo.png";

export function AnidachiLogoMark({ className, size = 24 }: AnidachiLogoMarkProps) {
  return (
    <img
      alt=""
      aria-hidden
      className={className}
      decoding="async"
      draggable={false}
      height={size}
      src={anidachiLogoUrl}
      width={size}
    />
  );
}

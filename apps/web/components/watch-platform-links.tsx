import { Button } from "@/components/ui/button";

export const CRUNCHYROLL_URL = "https://www.crunchyroll.com";
export const YOUTUBE_URL = "https://www.youtube.com";

export function WatchPlatformLinks({
  className = "flex flex-wrap gap-2",
}: {
  className?: string;
}) {
  return (
    <div className={["watch-platform-links", className].filter(Boolean).join(" ")}>
      <Button asChild variant="creamOutline" size="control">
        <a href={CRUNCHYROLL_URL} target="_blank" rel="noopener noreferrer">
          Crunchyroll
          <span className="sr-only">, opens in a new tab</span>
        </a>
      </Button>
      <Button asChild variant="creamOutline" size="control">
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
          YouTube
          <span className="sr-only">, opens in a new tab. Use a full watch page, not the homepage, Shorts, or embeds.</span>
        </a>
      </Button>
    </div>
  );
}

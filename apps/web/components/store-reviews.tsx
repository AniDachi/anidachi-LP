import { ArrowUpRight, Star } from "lucide-react";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import styles from "./store-reviews.module.css";

// Transcribed from the owner's Chrome Web Store screenshot supplied Oct 1, 2026.
// Kurish Page's quote is an excerpt; the other two are complete reviews.
// Stars belong to these individual reviews, not an aggregate store rating.
const reviews = [
  {
    author: "Kurish Page",
    date: "2026-09-26",
    dateLabel: "Sep 26, 2026",
    quote:
      "Just install, create a room, send the link and you're watching together. Me and my friend use it every week.",
  },
  {
    author: "Gogi",
    date: "2026-09-21",
    dateLabel: "Sep 21, 2026",
    quote:
      "Been using it with my long distance gf. Love the ability to change the layout directly on the screen. Cool app!",
  },
  {
    author: "Vladislav Krivosheev",
    date: "2026-09-26",
    dateLabel: "Sep 26, 2026",
    quote:
      "Guys, great job! It's really convenient - I didn't even know something like this existed. 5 stars!",
  },
];

export function StoreReviews() {
  return (
    <aside id="reviews" className={styles.section} aria-labelledby="store-reviews-title">
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 id="store-reviews-title">What our users say</h2>
          <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
            Chrome Web Store reviews
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </header>
        <div className={styles.reviews}>
          {reviews.map((review) => (
            <figure key={review.author} className={styles.review}>
              <div className={styles.stars} role="img" aria-label="5 out of 5 stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                ))}
              </div>
              <blockquote cite={CHROME_WEB_STORE_URL}>
                <p>{review.quote}</p>
              </blockquote>
              <figcaption>
                <span>{review.author}</span>
                <time dateTime={review.date}>{review.dateLabel}</time>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </aside>
  );
}

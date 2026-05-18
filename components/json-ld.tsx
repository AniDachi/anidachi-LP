import Script from "next/script";
import { getResolvedSiteOrigin } from "@/lib/site-url";

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <Script
      id={`json-ld-${JSON.stringify(data).slice(0, 32)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      strategy="afterInteractive"
    />
  );
}

export function OrganizationJsonLd() {
  const siteUrl = getResolvedSiteOrigin();
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "AniDachi",
      url: siteUrl,
      logo: `${siteUrl}/Anidachi_logo.png`,
      sameAs: [],
      contactPoint: {
        "@type": "ContactPoint",
        email: "goshan.tolochko@gmail.com",
        contactType: "customer support",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "AniDachi",
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/watch/{search_term_string}-with-friends`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
  return <JsonLd data={data} />;
}

export function SoftwareApplicationJsonLd() {
  const siteUrl = getResolvedSiteOrigin();
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AniDachi",
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Chrome, Web",
    description:
      "Watch anime together with friends. Create watchrooms, sync Crunchyroll playback, chat in real-time, and track your anime journey.",
    url: siteUrl,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "8",
      highPrice: "8",
      offerCount: 1,
      offers: [
        {
          "@type": "Offer",
          name: "Crunchyroll Subscriber",
          price: "8",
          priceCurrency: "USD",
          priceValidUntil: "2027-12-31",
          availability: "https://schema.org/InStock",
          url: `${siteUrl}/#pricing`,
        },
      ],
    },
  };
  return <JsonLd data={data} />;
}

export function FAQPageJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
  return <JsonLd data={data} />;
}

export function HowToJsonLd({
  name,
  description,
  steps,
}: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
  return <JsonLd data={data} />;
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const siteUrl = getResolvedSiteOrigin();
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };
  return <JsonLd data={data} />;
}

export function ArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  image,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  /** Absolute URLs preferred (e.g. MAL CDN poster). Helps Article/carousel eligibility in Search. */
  image?: string | string[];
}) {
  const siteUrl = getResolvedSiteOrigin();
  const images =
    image == null
      ? undefined
      : Array.isArray(image)
        ? image
        : [image];

  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: url.startsWith("http") ? url : `${siteUrl}${url}`,
    datePublished,
    dateModified,
    ...(images?.length ? { image: images } : {}),
    author: {
      "@type": "Organization",
      name: "AniDachi",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "AniDachi",
      logo: { "@type": "ImageObject", url: `${siteUrl}/Anidachi_logo.png` },
    },
  };
  return <JsonLd data={data} />;
}


interface MediaSchemaProps {
  type: "TVSeries" | "Movie";
  name: string;
  alternateName?: string;
  description: string;
  genres: string[];
  numberOfEpisodes?: number | null;
  image?: string | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  url: string;
}

function MediaJsonLd({
  type,
  name,
  alternateName,
  description,
  genres,
  numberOfEpisodes,
  image,
  ratingValue,
  ratingCount,
  url,
}: MediaSchemaProps) {
  const siteUrl = getResolvedSiteOrigin();
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: url.startsWith("http") ? url : `${siteUrl}${url}`,
    genre: genres,
  };
  if (alternateName) data.alternateName = alternateName;
  if (numberOfEpisodes != null && numberOfEpisodes > 0) data.numberOfEpisodes = numberOfEpisodes;
  if (image) data.image = image;
  if (ratingValue != null && ratingValue > 0 && ratingCount != null && ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(ratingValue * 10) / 10,
      ratingCount,
      bestRating: 10,
      worstRating: 1,
    };
  }
  return <JsonLd data={data} />;
}

export function TvSeriesJsonLd(props: Omit<MediaSchemaProps, "type">) {
  return <MediaJsonLd type="TVSeries" {...props} />;
}

export function MovieJsonLd(props: Omit<MediaSchemaProps, "type">) {
  return <MediaJsonLd type="Movie" {...props} />;
}

export function ItemListJsonLd({
  name,
  items,
}: {
  name: string;
  items: { name: string; url: string; position: number }[];
}) {
  const siteUrl = getResolvedSiteOrigin();
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it) => ({
      "@type": "ListItem",
      position: it.position,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${siteUrl}${it.url}`,
    })),
  };
  return <JsonLd data={data} />;
}


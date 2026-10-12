import { JsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

export function ToolWebAppJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const absolute = `${getResolvedSiteOrigin()}${url}`;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name,
        url: absolute,
        description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      }}
    />
  );
}

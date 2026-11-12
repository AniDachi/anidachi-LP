"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { getPlanPolicy } from "@anidachi/protocol";
import { Button } from "@/components/ui/button";
import { HomeSectionHeader } from "@/components/home-section-header";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { trackConversion } from "@/lib/conversion-events";
import { DE_INSTALL_CTA_LABEL, DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import type { BillingPeriod } from "@/lib/billing-view";
import { PUBLISHED_PRICING, type CheckoutTier } from "@/lib/pricing-tiers";
import "./pricing.css";

/**
 * German presentation of the plans for /de and /de/preise. It reads the same published prices
 * (PUBLISHED_PRICING) and room limits (getPlanPolicy) as components/pricing.tsx, which it does not
 * touch. It shows the public Free20 model; checkout stays in the English pricing component, so the
 * Plus and Pro buttons open /pricing with the chosen billing period.
 */

const free = getPlanPolicy("free");
const plus = getPlanPolicy("plus");
const pro = getPlanPolicy("pro");

function formatPriceDe(cents: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

const TIERS: {
  id: "free" | CheckoutTier;
  label: string;
  audience: string;
  featureHeading: string;
  features: string[];
}[] = [
  {
    id: "free",
    label: "Free",
    audience: "Jeden Tag ein bisschen Zeit zusammen.",
    featureHeading: "In Free enthalten",
    features: [
      "Jeden Tag 20 Minuten kostenlos",
      `Bis zu ${free.maxParticipants} Personen, dich eingeschlossen`,
      `Bis zu ${free.maxCameras} Kameras und ${free.maxMicrophones} Mikrofone`,
      "Crunchyroll, YouTube, Netflix",
      "Räumen von Freunden kostenlos beitreten",
      "Synchrones Video, Chat und Reaktionen",
      "Gespeicherten Verlauf ansehen, fortsetzen und löschen",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    audience: "Dein Raum. Deine Lieblingsmenschen.",
    featureHeading: `Bis zu ${plus.maxParticipants - 1} Freunde treten kostenlos bei`,
    features: [
      "Kein tägliches Zeitlimit als Gastgeber",
      "Crunchyroll, YouTube, Netflix",
      "Synchrones Video, Chat und Reaktionen",
      `Bis zu ${plus.maxCameras} Kameras und ${plus.maxMicrophones} Mikrofone`,
      "Schaufortschritt speichern, bearbeiten und fortsetzen",
      "Freundesgruppen und direkte Einladungen",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    audience: "Mehr Platz für alle.",
    featureHeading: `Bis zu ${pro.maxParticipants - 1} Freunde treten kostenlos bei`,
    features: [
      "Kein tägliches Zeitlimit als Gastgeber",
      "Crunchyroll, YouTube, Netflix",
      "Synchrones Video, Chat und Reaktionen",
      `Bis zu ${pro.maxCameras} Kameras und ${pro.maxMicrophones} Mikrofone`,
      "Schaufortschritt speichern, bearbeiten und fortsetzen",
      "Freundesgruppen und direkte Einladungen",
      "Bevorzugter Support",
    ],
  },
];

/** German plan matrix for /de/preise, same rows and values as PRICING_PLAN_MATRIX_ROWS (Free20 model). */
function matrixRows(period: BillingPeriod) {
  const priceText = (tier: CheckoutTier) => {
    const price = PUBLISHED_PRICING[period][tier];
    return `${formatPriceDe(price.unitAmount, price.currency)}${period === "yearly" ? " / Jahr" : " / Monat"}`;
  };
  return [
    { feature: "Preis", values: { free: "Kostenlos", plus: priceText("plus"), pro: priceText("pro") } },
    { feature: "Dienste", values: { free: "Crunchyroll, YouTube, Netflix", plus: "Crunchyroll, YouTube, Netflix", pro: "Crunchyroll, YouTube, Netflix" } },
    { feature: "Eigenen Raum veranstalten", values: { free: "20 Min. pro Tag", plus: "Kein Tageslimit", pro: "Kein Tageslimit" } },
    { feature: "Personen im Raum (inkl. Gastgeber)", values: { free: `Bis zu ${free.maxParticipants}`, plus: `Bis zu ${plus.maxParticipants}`, pro: `Bis zu ${pro.maxParticipants}` } },
    { feature: "Kameras gleichzeitig", values: { free: `Bis zu ${free.maxCameras}`, plus: `Bis zu ${plus.maxCameras}`, pro: `Bis zu ${pro.maxCameras}` } },
    { feature: "Mikrofone gleichzeitig", values: { free: `Bis zu ${free.maxMicrophones}`, plus: `Bis zu ${plus.maxMicrophones}`, pro: `Bis zu ${pro.maxMicrophones}` } },
    { feature: "Fortschritt speichern und bearbeiten", values: { free: "no", plus: "Ja, auf allen drei Diensten", pro: "Ja, auf allen drei Diensten" } },
    { feature: "Gespeicherten Verlauf ansehen und fortsetzen", values: { free: "yes", plus: "yes", pro: "yes" } },
    { feature: "Räumen von Freunden beitreten", values: { free: "yes", plus: "yes", pro: "yes" } },
    { feature: "Synchronisation, Chat und Reaktionen", values: { free: "yes", plus: "yes", pro: "yes" } },
    { feature: "Freunde, Gruppen und Einladungen", values: { free: "yes", plus: "yes", pro: "yes" } },
    { feature: "Bevorzugter Support", values: { free: "no", plus: "no", pro: "yes" } },
  ];
}

export function PricingSectionDe({
  pagePath,
  headingLevel = 2,
  showPlanMatrix = false,
}: {
  pagePath: "/de" | "/de/preise";
  /** 1 on /de/preise so the page has a single H1. */
  headingLevel?: 1 | 2;
  showPlanMatrix?: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const sectionRef = useRef<HTMLElement | null>(null);
  const Heading = headingLevel === 1 ? "h2" : "h3";

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackConversion("cta_impression", {
            page_path: pagePath,
            page_template: "de_pilot",
            placement: "pricing_de",
            cta_variant: "pricing_cards",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pagePath]);

  return (
    <section ref={sectionRef} id="pricing" className="pricing-plans relative bg-ani-canvas py-16 lg:py-20">
      <div className="container relative mx-auto px-4">
        <HomeSectionHeader
          titleAs={headingLevel === 1 ? "h1" : "h2"}
          title="Zusammen schauen. Wähle deinen Plan."
          description="20 Minuten jeden Tag kostenlos. Kein tägliches Zeitlimit mit Plus oder Pro."
        />
        <div className="pricing-plans__period" role="group" aria-label="Abrechnungszeitraum">
          {(["monthly", "yearly"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {value === "monthly" ? "Monatlich" : "Jährlich"}
              {value === "yearly" ? <span>−20%</span> : null}
            </button>
          ))}
        </div>
        <p className="pricing-plans__yearly-benefit">
          <strong>Über 2 Monate gratis</strong> bei jährlicher Zahlung
        </p>

        <div className="pricing-plans__grid">
          {TIERS.map((tier) => {
            const paid = tier.id === "free" ? null : tier.id;
            const highlighted = tier.id === "plus";
            const monthly = paid ? PUBLISHED_PRICING.monthly[paid] : null;
            const selected = paid ? PUBLISHED_PRICING[period][paid] : null;
            const yearly = period === "yearly" && !!paid;
            const shown = selected
              ? formatPriceDe(yearly ? selected.unitAmount / 12 : selected.unitAmount, selected.currency)
              : "0 $";
            const savings =
              yearly && selected && monthly
                ? formatPriceDe(monthly.unitAmount * 12 - selected.unitAmount, selected.currency)
                : null;
            return (
              <article
                key={tier.id}
                aria-labelledby={`pricing-de-${tier.id}-title`}
                className={`pricing-plans__card ${highlighted ? "pricing-plans__card--featured" : ""}`}
              >
                {highlighted ? <span className="pricing-plans__badge">Empfohlen</span> : null}
                <div className="pricing-plans__top">
                  <header className="pricing-plans__card-header">
                    <Heading id={`pricing-de-${tier.id}-title`}>{tier.label}</Heading>
                    <p className="pricing-plans__description">{tier.audience}</p>
                  </header>
                  <div className="pricing-plans__price-block" aria-live="polite" aria-atomic="true">
                    <div className="pricing-plans__price-line">
                      <span className="pricing-plans__amount">{shown}</span>
                      {paid ? (
                        <span className="pricing-plans__suffix">{yearly ? "pro Monat, ca." : "pro Monat"}</span>
                      ) : null}
                    </div>
                    {yearly || !paid ? (
                      <p className="pricing-plans__billing">
                        {yearly && selected ? (
                          <>
                            Abgerechnet: <strong>{formatPriceDe(selected.unitAmount, selected.currency)} / Jahr</strong>
                          </>
                        ) : (
                          "Keine Karte nötig."
                        )}
                      </p>
                    ) : null}
                    {savings ? (
                      <p className="pricing-plans__savings">
                        Du sparst <strong>{savings} / Jahr</strong> gegenüber monatlich
                      </p>
                    ) : null}
                  </div>
                  {paid ? (
                    <Button
                      asChild
                      className="pricing-plans__button"
                      variant={highlighted ? "cream" : "creamOutline"}
                      size="control"
                    >
                      <Link
                        href={`/pricing?billing=${period}`}
                        hrefLang="en"
                        onClick={() =>
                          trackConversion("cta_click", {
                            page_path: pagePath,
                            page_template: "de_pilot",
                            placement: "pricing_de",
                            cta_variant: `pricing_de_${paid}`,
                          })
                        }
                      >
                        {tier.label} wählen
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="creamOutline" size="control" className="pricing-plans__button">
                      <InstallLink href={DE_INSTALL_HUB_PATH}>
                        {DE_INSTALL_CTA_LABEL}
                        <ArrowRight size={17} aria-hidden="true" />
                      </InstallLink>
                    </Button>
                  )}
                  <p className="pricing-plans__button-note">
                    {paid
                      ? "Weiter zum Checkout. Verlängert sich automatisch, jederzeit kündbar."
                      : "Erweiterung installieren, dann anmelden."}
                  </p>
                </div>
                <div className="pricing-plans__details">
                  <p className="pricing-plans__feature-heading">{tier.featureHeading}</p>
                  <ul className="pricing-plans__features">
                    {tier.features.map((feature) => (
                      <li key={feature}>
                        <Check size={17} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
        <div className="pricing-plans__footer">
          <p className="pricing-plans__terms">
            <Lock size={14} aria-hidden="true" />
            <span>
              Preise in US-Dollar. Der Checkout läuft sicher über Stripe; Endbetrag, Steuern und
              Rabatte siehst du vor der Bestätigung.
            </span>
          </p>
          {pagePath === "/de" ? (
            <p className="pricing-plans__terms">
              <Link href="/de/preise" className="underline decoration-ani-line underline-offset-4 hover:text-ani-text">
                Alle Pläne im Vergleich
              </Link>
            </p>
          ) : null}
        </div>

        {showPlanMatrix ? (
          <div className="mx-auto max-w-4xl">
            <h3 className="mb-4 text-center text-lg font-semibold tracking-[-0.02em] text-ani-text">
              Alle Limits auf einen Blick
            </h3>
            <ResponsiveCompareTable
locale="de"
              columns={[
                { id: "free", label: "Free" },
                { id: "plus", label: "Plus", highlight: true },
                { id: "pro", label: "Pro" },
              ]}
              rows={matrixRows(period)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { CheckCircle2, Shield, Sparkles } from "lucide-react";

const trustItems = [
  { icon: Shield, label: "Secure Stripe checkout" },
  { icon: CheckCircle2, label: "Everyone keeps their own Crunchyroll login" },
  { icon: Sparkles, label: "Pre-launch rate locked forever" },
];

export function SocialProof() {
  return (
    <section
      aria-label="Trust and credibility"
      className="border-y border-brand-border bg-brand-surface/40 py-5"
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-foreground/55">
          {trustItems.map((item, index) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              {index > 0 ? (
                <span className="mr-3 text-brand-border/80" aria-hidden="true">
                  ·
                </span>
              ) : null}
              <item.icon className="h-4 w-4 shrink-0 text-brand-orange/70" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

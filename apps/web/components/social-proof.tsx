import { CheckCircle2, Shield, Sparkles } from "lucide-react";

const trustItems = [
  { icon: Shield, label: "Secure Stripe checkout" },
  {
    icon: CheckCircle2,
    label: "Everyone keeps their own Crunchyroll or YouTube login",
  },
  { icon: Sparkles, label: "Subscribe now and keep this rate" },
];

export function SocialProof() {
  return (
    <section
      aria-label="Trust and credibility"
      className="border-y border-ani-line bg-ani-canvas py-6"
    >
      <div className="container mx-auto px-4">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-ani-muted">
          {trustItems.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-2">
              <item.icon
                className="h-4 w-4 shrink-0 text-ani-progress"
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

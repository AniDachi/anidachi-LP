import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Shield, Sparkles } from "lucide-react";

export function SocialProof() {
  return (
    <section
      aria-label="Trust and credibility"
      className="py-10 md:py-12 bg-background"
    >
      <div className="container mx-auto px-4">
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <Card className="rounded-2xl border border-[--brand-border] bg-[--brand-surface] shadow-sm transition-shadow hover:shadow-md hover:border-[--brand-orange]/30">
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 text-[--brand-orange]">
                <Shield className="h-4 w-4" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold">
                  Secure checkout
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-6 text-sm text-foreground/70 leading-relaxed">
              Pay via Stripe. Cancel any time. If early access isn&apos;t for you,
              we&apos;ll refund you.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[--brand-border] bg-[--brand-surface] shadow-sm transition-shadow hover:shadow-md hover:border-[--brand-orange]/30">
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 text-[--brand-orange]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold">
                  No account sharing
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-6 text-sm text-foreground/70 leading-relaxed">
              Everyone keeps their own Crunchyroll login. AniDachi is the
              watchroom, sync, and chat layer.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[--brand-border] bg-[--brand-surface] shadow-sm transition-shadow hover:shadow-md hover:border-[--brand-orange]/30">
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 text-[--brand-orange]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold">
                  Price locked forever
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-6 text-sm text-foreground/70 leading-relaxed">
              Subscribe during early access and keep your pre-launch rate — even
              after we go public. Priority support while we ship watchrooms.
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}


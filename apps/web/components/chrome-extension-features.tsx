import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chrome, MousePointer, FolderSyncIcon as Sync } from "lucide-react";

export function ChromeExtensionFeatures() {
  const features = [
    {
      icon: Chrome,
      title: "Automatic Anime Detection",
      description:
        "Smart recognition technology automatically detects anime content on Crunchyroll and other supported platforms, making watchroom creation effortless. No copy-pasting URLs or searching titles manually.",
    },
    {
      icon: MousePointer,
      title: "One-Click Watchroom Creation",
      description:
        "Instantly create watchrooms for any anime episode with a single click. No manual searching or setup required — just click and share the invite link with friends.",
    },
    {
      icon: Sync,
      title: "Stay in Sync with Friends",
      description:
        "Automatically synchronize playback with your watchroom members. Pause, play, and seek together for a truly shared Crunchyroll viewing experience across any distance.",
    },
  ];

  return (
    <section id="extension" className="py-24 bg-brand-surface">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-brand-orange/15 border border-brand-orange/30 text-brand-orange px-4 py-1.5 rounded-full text-sm font-semibold mb-4 tracking-wide uppercase">
            Extension
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Anime Detection Chrome Extension
          </h2>
          <div className="w-16 h-1 bg-gradient-to-r from-brand-orange to-brand-orange-bright mx-auto rounded-full mb-4" />
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
            Seamlessly detect anime on Crunchyroll and instantly create
            watchrooms. The best way to watch anime with friends online.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group border border-brand-border shadow-lg hover:shadow-xl hover:border-brand-orange/40 hover:-translate-y-1 transition-all duration-300 bg-background p-6 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="p-0">
                <div className="w-12 h-12 bg-brand-orange/15 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 group-hover:bg-brand-orange group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6 text-brand-orange group-hover:text-primary-foreground transition-colors duration-300" aria-hidden="true" />
                </div>
                <CardTitle className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-4">
                <CardDescription className="text-foreground/70 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

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
    <section id="extension" className="bg-ani-canvas py-24">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ani-line px-4 py-1.5 text-sm font-semibold tracking-wide text-ani-muted">
            Extension
          </div>
          <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-ani-text md:text-4xl">
            Anime Detection Chrome Extension
          </h2>
          <p className="mx-auto max-w-3xl text-pretty text-lg text-ani-muted">
            Seamlessly detect anime on Crunchyroll and instantly create
            watchrooms. The best way to watch anime with friends online.
          </p>
        </div>
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border border-ani-line bg-ani-panel p-6 shadow-none"
            >
              <CardHeader className="p-0">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-ani-line bg-ani-hover">
                  <feature.icon className="h-6 w-6 text-ani-text" aria-hidden="true" />
                </div>
                <CardTitle className="mb-2 text-xl font-semibold text-ani-text">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-4">
                <CardDescription className="text-base leading-relaxed text-ani-muted">
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

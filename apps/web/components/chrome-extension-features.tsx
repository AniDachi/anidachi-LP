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
    <section id="extension" className="py-24 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Anime Detection Chrome Extension
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Seamlessly detect anime on Crunchyroll and instantly create
            watchrooms. The best way to watch anime with friends online.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white p-6"
            >
              <CardHeader className="p-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <feature.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-4">
                <CardDescription className="text-gray-600 text-base leading-relaxed">
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

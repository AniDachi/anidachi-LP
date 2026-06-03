import { Chrome, Search, Users, MessageSquare, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Chrome,
    title: "Install the Chrome Extension",
    description:
      "Add the AniDachi extension to Chrome. It takes seconds and works alongside your existing Crunchyroll account.",
  },
  {
    icon: Search,
    title: "Detect Anime Automatically",
    description:
      "Navigate to any anime on Crunchyroll and click 'Detect Anime.' AniDachi identifies the show, season, and episode automatically.",
  },
  {
    icon: Users,
    title: "Create a Watchroom",
    description:
      "One click creates a shared watchroom. Invite friends via link — they can join from any device, any time.",
  },
  {
    icon: CheckCircle,
    title: "Mark Episodes & Track Progress",
    description:
      "Mark episodes as watched at your own pace. AniDachi tracks everyone's progress so no one falls behind.",
  },
  {
    icon: MessageSquare,
    title: "Chat, React & Discuss",
    description:
      "Leave reactions, share theories, and chat about each episode — even if friends watch days later. Every moment is shared.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How AniDachi Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From install to your first shared episode in under two minutes.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <ol className="relative border-l-2 border-purple-200 ml-4 space-y-10">
            {steps.map((step, i) => (
              <li key={i} className="ml-8">
                <div className="absolute -left-5 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {i + 1}
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <step.icon className="h-5 w-5 text-purple-600" aria-hidden="true" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export const howToSteps = steps.map((s) => ({
  name: s.title,
  text: s.description,
}));

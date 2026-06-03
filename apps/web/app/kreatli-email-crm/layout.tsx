import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kreatli Email CRM · AniDachi",
  description: "Personal outreach CRM for Kreatli prospects.",
  robots: { index: false, follow: false },
};

export default function KreatliCrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {children}
    </div>
  );
}

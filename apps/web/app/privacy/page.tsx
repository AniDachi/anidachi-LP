import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "AniDachi privacy policy — how we collect, use, and protect your data when you use our anime watchroom platform and Chrome extension.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Privacy Policy | AniDachi",
    description:
      "How AniDachi collects, uses, and protects your data.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <main id="main-content" className="min-h-screen bg-background">
        <article className="container mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-foreground/50 mb-10">
            Last updated: September 18, 2026
          </p>

          <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. AniDachi and your account</h2>
              <p>AniDachi operates this website and the AniDachi Chrome extension for synchronized viewing, calls, invitations and personal watch history on supported video services.</p>
              <p>When you sign in with Google or Discord, we receive your provider account identifier, email address, display name and profile image where available. We use these details to maintain your account, show your identity to people you interact with and manage access to your subscription. AniDachi stores its own session tokens in the browser. The extension reads the AniDachi website session cookie to connect your website and extension accounts; it does not collect unrelated website cookies.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Video information and personal history</h2>
              <p>The extension reads video information and playback state on supported YouTube and Crunchyroll pages to synchronize a room or save your progress. This includes the video URL and provider identifiers, title, cover image, episode and season details, playback position, duration and timestamps. It does not collect your general browsing history.</p>
              <p><strong>Automatic personal-history recording requires your choice in the extension and a Plus or Pro entitlement.</strong> The choice is saved for the signed-in account in that browser. YouTube recording also requires its separate switch in Settings. When enabled, eligible progress is saved locally and synchronized with your AniDachi account during both solo and room viewing. Pending updates may be retried after a connection failure.</p>
              <p>You can stop recording in the extension Settings. Disabling recording does not delete history already saved. Previously dispatched updates may finish processing; new capture stops. Losing a paid entitlement also stops new recording while saved history remains available to read and remove. The website lets you edit or remove saved progress. History belongs to your account; it is not a shared group completion record.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. Rooms, people, notifications and calls</h2>
              <p>To operate rooms, we process room identifiers, membership and presence, invitations, playback commands, video source information, reactions, media state and connection signaling. Other room participants receive the information needed to identify participants and synchronize viewing. Friends, groups and invitation records support the social features you choose to use.</p>
              <p>If you enable camera or microphone access, your live media is sent to other participants through WebRTC. Connections may use a relay when a direct connection is unavailable. Peers may learn network information, including an IP address, as part of establishing a connection. AniDachi does not record your calls or upload a recording of the streaming video; each participant watches through the original video service.</p>
              <p>For invitation notifications, we store browser push subscription details and delivery state. Notification settings are available in AniDachi and in your browser. Operational logs and limited local diagnostics help troubleshoot errors, connection failures and abuse.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Service providers and permitted use</h2>
              <p>We use service providers to deliver the functions described here:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Supabase</strong> stores account, subscription, social and watch-history records.</li>
                <li><strong>Cloudflare</strong> operates realtime room infrastructure, connection services and media relays.</li>
                <li><strong>Vercel</strong> hosts the website and server endpoints.</li>
                <li><strong>Stripe</strong> processes payments and subscription changes. We keep billing identifiers and subscription status; Stripe handles full payment-card details.</li>
                <li><strong>Google and Discord</strong> provide the sign-in method you select. Browser push services deliver notifications to your browser.</li>
                <li><strong>Google Analytics and Amplitude</strong> process website usage events, device/browser information and performance measurements where configured. These identifiers are not necessarily anonymous. Our website does not enable Amplitude Session Replay. These analytics SDKs are not installed in the extension.</li>
                <li><strong>Gmail (Google)</strong> may deliver copies of contact and feature-request submissions to our team.</li>
              </ul>
              <p className="mt-4">
                Contact and feature-request forms store your email address, name, subject or title, category and message, along with the request type and time. We keep these records in our internal CRM tools on private Vercel storage to fulfill your request and handle replies or follow-up about it.
              </p>
              <p>We do not sell extension user data or use it for advertising, creditworthiness or lending decisions. We use it for the disclosed product features and their security and reliability, and share it with providers only as needed to deliver those purposes. Human access is limited to your explicit consent for a specific purpose, necessary security or legal handling, or aggregated data that cannot identify you.</p>
              <p>AniDachi&apos;s use of information received from Chrome APIs follows the <a href="https://developer.chrome.com/docs/webstore/program-policies/limited-use" className="text-brand-orange hover:underline">Chrome Web Store User Data Policy, including its Limited Use requirements</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Storage, retention and security</h2>
              <p>Personal history is retained independently of individual rooms until you remove it or request account-data deletion. We do not automatically erase your oldest titles when a history limit is reached; adding new titles pauses until space is available. Account, social, room and operational records are kept as needed to provide the service, resolve failures and meet applicable obligations. Billing or security records may need to be retained after a deletion request.</p>
              <p>The browser stores authentication state, settings, cached history and pending synchronization work. Removing the extension clears its browser storage but does not by itself delete server-side account history. You can manage server-side history in your account. We use encrypted transport and access controls; no online service can guarantee absolute security.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Cookies and your choices</h2>
              <p>Essential cookies maintain your login and session. Website analytics may use cookies or browser identifiers. Browser privacy controls can restrict these, although blocking essential storage may prevent sign-in. You can separately control history recording, YouTube history, notifications, camera and microphone access. Declining history recording does not prevent joining or synchronizing a room.</p>
              <p>Depending on applicable law, you may be entitled to access, correct, export or delete personal data. For account deletion or assistance with these requests, email <a href="mailto:anidachi.app@gmail.com" className="text-brand-orange hover:underline">anidachi.app@gmail.com</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Changes and contact</h2>
              <p>We update this page when our data practices change. Where a change requires a new disclosure or choice, we will provide it in the product before starting that collection. For privacy questions, contact <a href="mailto:anidachi.app@gmail.com" className="text-brand-orange hover:underline">anidachi.app@gmail.com</a>. You can return to <Link href="/" className="text-brand-orange hover:underline">AniDachi</Link> at any time.</p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}

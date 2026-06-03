import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "AniDachi privacy policy — how we collect, use, and protect your data when you use our anime watchroom platform and Chrome extension.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | AniDachi",
    description:
      "How AniDachi collects, uses, and protects your data.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <main className="min-h-screen bg-white">
        <article className="container mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 mb-10">
            Last updated: April 23, 2026
          </p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                1. Who We Are
              </h2>
              <p>
                AniDachi (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
                operates the website at{" "}
                <Link href="/" className="text-purple-600 hover:underline">
                  anidachi.app
                </Link>{" "}
                and the AniDachi Chrome Extension. Our mission is to help anime
                fans watch together — synchronously or asynchronously — through
                shared watchrooms, real-time chat, and playback sync.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                2. Information We Collect
              </h2>
              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
                2.1 Account Information
              </h3>
              <p>
                When you sign up, we collect your email address and display name.
                If you subscribe through Stripe, Stripe processes your payment
                details — we never store your full card number.
              </p>
              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
                2.2 Usage Data
              </h3>
              <p>
                We collect anonymous analytics (via Google Analytics) such as
                pages visited, session duration, and device type. The Chrome
                extension detects the anime title and episode on supported
                streaming sites (e.g., Crunchyroll) to create watchrooms — this
                detection happens locally in your browser and is only transmitted
                when you explicitly create or join a watchroom.
              </p>
              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
                2.3 Chat & Watchroom Data
              </h3>
              <p>
                Messages you send in watchroom chats and your watch-progress
                markers are stored so your friends can view them
                asynchronously.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and improve the AniDachi platform and extension.</li>
                <li>Process subscriptions and payments via Stripe.</li>
                <li>
                  Send transactional emails (e.g., subscription confirmation).
                </li>
                <li>Analyze aggregate usage to improve our features.</li>
              </ul>
              <p className="mt-4">
                We do <strong>not</strong> sell, rent, or trade your personal
                data to third parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                4. Third-Party Services
              </h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  <strong>Stripe</strong> — payment processing (
                  <a
                    href="https://stripe.com/privacy"
                    className="text-purple-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Stripe Privacy Policy
                  </a>
                  ).
                </li>
                <li>
                  <strong>Google Analytics</strong> — anonymous site analytics (
                  <a
                    href="https://policies.google.com/privacy"
                    className="text-purple-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Privacy Policy
                  </a>
                  ).
                </li>
                <li>
                  <strong>Vercel</strong> — hosting and deployment.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                5. Data Retention
              </h2>
              <p>
                We retain your account data for as long as your account is
                active. Chat messages and watch history are retained for the
                lifetime of the watchroom. You can request deletion of your data
                at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                6. Your Rights
              </h2>
              <p>
                Depending on your jurisdiction, you may have the right to access,
                correct, delete, or export your personal data. To exercise any of
                these rights, email us at{" "}
                <a
                  href="mailto:goshan.tolochko@gmail.com"
                  className="text-purple-600 hover:underline"
                >
                  goshan.tolochko@gmail.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                7. Cookies
              </h2>
              <p>
                We use essential cookies for authentication and session
                management. Google Analytics sets its own cookies for analytics
                purposes. You can disable cookies in your browser settings,
                though some features may not work correctly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                8. Security
              </h2>
              <p>
                We use HTTPS, secure authentication tokens, and follow industry
                best practices to protect your data. However, no method of
                internet transmission is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                9. Changes to This Policy
              </h2>
              <p>
                We may update this policy from time to time. When we do, we will
                update the &quot;Last updated&quot; date at the top. Continued
                use of AniDachi after changes constitutes acceptance of the new
                policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
                10. Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy, contact us at{" "}
                <a
                  href="mailto:goshan.tolochko@gmail.com"
                  className="text-purple-600 hover:underline"
                >
                  goshan.tolochko@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}

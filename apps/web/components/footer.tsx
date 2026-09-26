import Link from "next/link";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { FooterPricingCta } from "@/components/footer-pricing-cta";
import { PUBLIC_SOCIAL_LINKS } from "@/lib/public-social-links";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-ani-line bg-ani-canvas py-12 text-ani-text">
      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          <div className="col-span-2 lg:col-span-2 relative">
            <AnidachiLogoLink
              size={40}
              wordmarkClassName="text-2xl font-semibold text-ani-text"
              className="mb-4"
            />
            <p className="mb-4 max-w-md text-sm leading-relaxed text-ani-muted">
              AniDachi (アニ友) — watch together with friends on Crunchyroll and
              YouTube. Live sync and chat now; async watchrooms coming soon.
            </p>
            <p className="text-xs text-ani-muted">
              Not affiliated with Crunchyroll, Sony, YouTube, Google, or any
              streaming platform.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2 text-ani-muted text-sm">
              <li>
                <Link
                  href="/#how-it-works"
                  className="hover:text-ani-text transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-ani-text transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/#compare"
                  className="hover:text-ani-text transition-colors"
                >
                  Compare
                </Link>
              </li>
              <li>
                <Link
                  href="/extension"
                  className="hover:text-ani-text transition-colors"
                >
                  Chrome extension
                </Link>
              </li>
              <li>
                <FooterPricingCta className="hover:text-ani-text transition-colors" />
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="hover:text-ani-text transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Guides</h4>
            <ul className="space-y-2 text-ani-muted text-sm">
              <li>
                <Link
                  href="/watch-anime-together"
                  className="hover:text-ani-text transition-colors"
                >
                  Watch Anime Together
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-crunchyroll-together"
                  className="hover:text-ani-text transition-colors"
                >
                  Crunchyroll Watch Party
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-youtube-together"
                  className="hover:text-ani-text transition-colors"
                >
                  YouTube Watch Party
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-crunchyroll-with-friends"
                  className="hover:text-ani-text transition-colors"
                >
                  How to Watch with Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-anime-with-friends-on-discord"
                  className="hover:text-ani-text transition-colors"
                >
                  Anime Watch Party on Discord
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/first-anime-watch-party-checklist"
                  className="hover:text-ani-text transition-colors"
                >
                  First Watch Party Checklist
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-anime-with-a-group"
                  className="hover:text-ani-text transition-colors"
                >
                  Watch Anime With a Group
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-party-app"
                  className="hover:text-ani-text transition-colors"
                >
                  Watch Party App
                </Link>
              </li>
              <li>
                <Link
                  href="/anime-tracker"
                  className="hover:text-ani-text transition-colors"
                >
                  Anime Tracker
                </Link>
              </li>
              <li>
                <Link
                  href="/discord-watch-party"
                  className="hover:text-ani-text transition-colors"
                >
                  Discord Watch Party
                </Link>
              </li>
              <li>
                <Link
                  href="/sub-vs-dub"
                  className="hover:text-ani-text transition-colors"
                >
                  Sub vs Dub
                </Link>
              </li>
              <li>
                <Link
                  href="/anime-watch-party"
                  className="hover:text-ani-text transition-colors"
                >
                  Anime Watch Party
                </Link>
              </li>
              <li>
                <Link
                  href="/anime-watch-party-toolkit"
                  className="hover:text-ani-text transition-colors"
                >
                  Watch Party Toolkit
                </Link>
              </li>
              <li>
                <Link
                  href="/compare/anidachi-vs-discord-screen-share"
                  className="hover:text-ani-text transition-colors"
                >
                  AniDachi vs Discord
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-as-a-couple"
                  className="hover:text-ani-text transition-colors"
                >
                  Anime for Couples
                </Link>
              </li>
              <li>
                <Link
                  href="/compare/anidachi-vs-teleparty"
                  className="hover:text-ani-text transition-colors"
                >
                  AniDachi vs Teleparty
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-with-friends"
                  className="hover:text-ani-text transition-colors"
                >
                  Best Anime with Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-isekai-anime-to-watch-with-friends"
                  className="hover:text-ani-text transition-colors"
                >
                  Best Isekai with Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-anime-together#genre-hubs"
                  className="hover:text-ani-text transition-colors"
                >
                  Browse Anime by Genre
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-for-beginners"
                  className="hover:text-ani-text transition-colors"
                >
                  Best Anime for Beginners
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2 text-ani-muted text-sm">
              <li>
                <Link
                  href="/about"
                  className="hover:text-ani-text transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-ani-text transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/feature-requests"
                  className="hover:text-ani-text transition-colors"
                >
                  Feature Requests
                </Link>
              </li>
              <li>
                <Link
                  href="/editorial-policy"
                  className="hover:text-ani-text transition-colors"
                >
                  Editorial Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/security"
                  className="hover:text-ani-text transition-colors"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-ani-text transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-ani-text transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Social</h4>
            <ul className="space-y-2 text-ani-muted text-sm">
              {PUBLIC_SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-ani-text transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-ani-line mt-12 pt-8 text-center text-ani-muted text-sm">
          <p>&copy; {new Date().getFullYear()} AniDachi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

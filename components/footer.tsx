import Image from "next/image";
import Link from "next/link";
import { FooterPricingCta } from "@/components/footer-pricing-cta";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Image
                src="/Anidachi_logo.png"
                alt="AniDachi logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                AniDachi
              </h3>
            </Link>
            <p className="text-gray-400 mb-4 max-w-md text-sm leading-relaxed">
              AniDachi (アニ友) means &quot;anime friend.&quot; We built the
              ultimate platform for watching anime together — create watchrooms,
              sync Crunchyroll playback, and share every reaction with your crew.
            </p>
            <p className="text-xs text-gray-500">
              Not affiliated with Crunchyroll, Sony, or any streaming platform.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link
                  href="/#how-it-works"
                  className="hover:text-white transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-white transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/#compare"
                  className="hover:text-white transition-colors"
                >
                  Compare
                </Link>
              </li>
              <li>
                <FooterPricingCta className="hover:text-white transition-colors" />
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="hover:text-white transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Guides</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link
                  href="/watch-anime-together"
                  className="hover:text-white transition-colors"
                >
                  Watch Anime Together
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-crunchyroll-together"
                  className="hover:text-white transition-colors"
                >
                  Watch Crunchyroll Together
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-crunchyroll-with-friends"
                  className="hover:text-white transition-colors"
                >
                  How to Watch with Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-anime-with-friends-on-discord"
                  className="hover:text-white transition-colors"
                >
                  Anime Watch Party on Discord
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/first-anime-watch-party-checklist"
                  className="hover:text-white transition-colors"
                >
                  First Watch Party Checklist
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/how-to-watch-anime-with-a-group"
                  className="hover:text-white transition-colors"
                >
                  Watch Anime With a Group
                </Link>
              </li>
              <li>
                <Link
                  href="/watch-party-starter"
                  className="hover:text-white transition-colors"
                >
                  Watch Party Starter
                </Link>
              </li>
              <li>
                <Link
                  href="/anime-watch-party-toolkit"
                  className="hover:text-white transition-colors"
                >
                  Watch Party Toolkit
                </Link>
              </li>
              <li>
                <Link
                  href="/compare/anidachi-vs-discord-screen-share"
                  className="hover:text-white transition-colors"
                >
                  AniDachi vs Discord
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-as-a-couple"
                  className="hover:text-white transition-colors"
                >
                  Anime for Couples
                </Link>
              </li>
              <li>
                <Link
                  href="/compare/anidachi-vs-teleparty"
                  className="hover:text-white transition-colors"
                >
                  AniDachi vs Teleparty
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-with-friends"
                  className="hover:text-white transition-colors"
                >
                  Best Anime with Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/guides/best-anime-to-watch-for-beginners"
                  className="hover:text-white transition-colors"
                >
                  Best Anime for Beginners
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a
                  href="mailto:goshan.tolochko@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} AniDachi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

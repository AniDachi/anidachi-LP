import Link from "next/link";
import Image from "next/image";
import { NavPricingButton } from "@/components/nav-pricing-button";

export function NavBar() {
  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 flex min-h-14 w-full items-center border-b border-white/10 bg-purple-900/80 backdrop-blur-md"
    >
      <div className="container mx-auto flex w-full items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-white font-semibold hover:opacity-90 transition-opacity"
        >
          <Image
            src="/Anidachi_logo.png"
            alt="AniDachi logo"
            width={28}
            height={28}
            className="object-contain"
          />
          AniDachi
        </Link>
        <ul className="flex items-center gap-4 sm:gap-6 text-sm">
          <li>
            <Link
              href="/#how-it-works"
              className="text-purple-100 hover:text-white transition-colors"
            >
              How It Works
            </Link>
          </li>
          <li>
            <Link
              href="/watch-anime-together"
              className="text-purple-100 hover:text-white transition-colors"
            >
              Watch
            </Link>
          </li>
          <li>
            <a
              href="mailto:goshan.tolochko@gmail.com"
              className="text-purple-100 hover:text-white transition-colors"
            >
              Contact
            </a>
          </li>
          <li className="hidden sm:block">
            <NavPricingButton />
          </li>
        </ul>
      </div>
    </nav>
  );
}

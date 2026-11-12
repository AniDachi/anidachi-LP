"use client";

import { useRef } from "react";
import { PricingSelection } from "@/components/pricing-selection";
import { PricingSectionDe } from "@/components/pricing-section-de";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { UpcomingPlatforms } from "@/components/upcoming-platforms";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { CompareTable } from "@/components/compare-table";
import { StoreReviews } from "@/components/store-reviews";
import { HomeFAQ } from "./home-faq";
import { useHomeScrollAssist } from "@/lib/use-home-scroll-assist";
import { UI_STRINGS, type PageLocale } from "@/lib/locale/ui-strings";
import styles from "./home-sections.module.css";

/** The homepage sections. German (/de) passes locale="de"; the demo and review quotes stay English. */
export function HomeClient({ locale = "en" }: { locale?: PageLocale } = {}) {
	const de = locale === "de";
	const pageRef = useRef<HTMLElement>(null);
	useHomeScrollAssist(pageRef);
	return (
		<main
			ref={pageRef}
			id="main-content"
			className={`${styles.page} min-h-screen bg-ani-canvas`}
		>
			<Hero locale={locale} />
			<ChromeExtensionDemo />
			<HowItWorks locale={locale} />
			<UpcomingPlatforms locale={locale} />
			<CompareTable locale={locale} />
			<MainAppFeatures locale={locale} />
			{de ? <PricingSectionDe pagePath="/de" /> : <PricingSelection />}
			<StoreReviews title={de ? UI_STRINGS.de.reviewsTitle : undefined} />
			<HomeFAQ locale={locale} />
		</main>
	);
}

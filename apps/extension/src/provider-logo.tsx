export function ProviderLogo({
	label,
	provider,
}: {
	label: string;
	provider: string;
}) {
	if (provider === "crunchyroll") {
		return (
			<span aria-hidden="true" className="resource-provider-logo crunchyroll">
				<svg viewBox="0 0 24 24">
					<title>{label}</title>
					<path
						d="M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z"
						fill="currentColor"
					/>
				</svg>
			</span>
		);
	}
	// Netflix glyph reuses the website public/platforms/netflix.svg (svgl).
	if (provider === "netflix") {
		return (
			<span aria-hidden="true" className="resource-provider-logo netflix">
				<svg aria-hidden="true" viewBox="0 0 141 277" fill="currentColor">
					<path d="M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676L44.051 119.724v151.073C28.647 272.418 14.594 274.58 0 276.742V0h41.08l56.212 157.021V0h43.511v258.904z" />
				</svg>
			</span>
		);
	}
	if (provider === "youtube") {
		return (
			<span aria-hidden="true" className="resource-provider-logo youtube">
				<svg viewBox="0 0 24 24">
					<title>{label}</title>
					<path
						d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.121 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"
						fill="currentColor"
					/>
					<path d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z" fill="#fff" />
				</svg>
			</span>
		);
	}
	return (
		<span aria-hidden="true" className={`resource-provider-logo ${provider}`}>
			<span className="resource-provider-fallback">{label.slice(0, 1)}</span>
		</span>
	);
}

import {
	PRIME_VIDEO_DOMAIN_ROOTS,
	primeDomainFamily,
	resolvePrimeLaunch,
	type PrimeMarketplace,
} from "@anidachi/protocol";
import { PrimePendingSchema } from "../../src/prime-launch-session";
const root = document.getElementById("root")!;

const request = (body: Record<string, unknown>) =>
	chrome.runtime.sendMessage({ type: "ANIDACHI_PRIME_LAUNCH", ...body });
const heading = document.createElement("h1");
heading.textContent = "Open Prime Video";
root.append(heading);
const result = await request({ action: "read" }).catch(() => null);
const parsed = PrimePendingSchema.safeParse(result?.pending);
if (!parsed.success) {
	root.append("This launch expired. Open the invitation or Resume again.");
} else {
	const pending = parsed.data;
	const label = document.createElement("label");
	label.textContent = "Your marketplace ";
	const select = document.createElement("select");
	const empty = document.createElement("option");
	empty.value = "";
	empty.textContent = "Choose a site";
	select.append(empty);
	for (const domain of PRIME_VIDEO_DOMAIN_ROOTS) {
		const option = document.createElement("option");
		option.value = domain;
		option.textContent = domain;
		select.append(option);
	}
	select.value = result.marketplace ?? "";
	label.append(select);
	root.append(label);
	const options = document.createElement("div");
	root.append(options);
	const button = (text: string, action: () => Promise<unknown>) => {
		const b = document.createElement("button");
		b.textContent = text;
		b.onclick = () => {
			b.disabled = true;
			void action()
				.then((response) => {
					if ((response as { status?: string })?.status !== "ready") {
						b.disabled = false;
						status.textContent =
							"This launch changed or expired. Open it again.";
					}
				})
				.catch(() => {
					b.disabled = false;
					status.textContent = "Could not open the title. Please try again.";
				});
		};
		options.append(b);
	};
	const status = document.createElement("p");
	root.append(status);
	const render = () => {
		options.replaceChildren();
		const market = select.value as PrimeMarketplace;
		const resolution = resolvePrimeLaunch({
			contentId: pending.contentId,
			navigation: pending.navigation,
			marketplace: market || undefined,
		});
		status.textContent =
			resolution.status === "regional-route-unknown"
				? "We do not have an exact link for this title in your marketplace. Choose a known link or open the movie or episode you selected in AniDachi. For a watch party, ask the host for its title and episode."
				: "Choose where to open this title. Your selection is remembered for this account.";
		const choices =
			resolution.status === "ready"
				? [
						{
							url: resolution.url,
							marketplace: primeDomainFamily(new URL(resolution.url).hostname)!,
						},
					]
				: resolution.choices;
		for (const choice of choices)
			button(`Open on ${choice.marketplace}`, () =>
				request({
					action: "choose",
					intentId: pending.intentId,
					marketplace: choice.marketplace,
					url: choice.url,
				}),
			);
		if (resolution.status === "regional-route-unknown")
			button(`Find this episode on ${market}`, () =>
				request({
					action: "choose",
					intentId: pending.intentId,
					marketplace: market,
					manual: true,
				}),
			);
		button("Cancel", async () => {
			await request({ action: "cancel" });
			window.close();
			return { status: "ready" };
		});
	};
	select.onchange = render;
	render();
}

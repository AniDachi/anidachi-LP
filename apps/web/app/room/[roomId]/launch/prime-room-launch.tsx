"use client";
import { useEffect, useState } from "react";
import type { RoomSourceDescriptor } from "@anidachi/protocol";
import { requestPrimeLaunch } from "@/lib/prime-launch-client";
export function PrimeRoomLaunch({
	source,
	roomId,
	owner,
	extensionId,
	fallback,
}: {
	source: RoomSourceDescriptor;
	roomId: string;
	owner: string;
	extensionId: string | null;
	fallback: string;
}) {
	const [unavailable, setUnavailable] = useState(false);
	useEffect(() => {
		let current = true;
		void requestPrimeLaunch(
			extensionId,
			{
				contentId: source.sourceUrl.split("/").at(-1),
				navigation: source.primeNavigation,
				roomId,
				expectedOwnerUserId: owner,
			},
			() => current,
		).then((ok) => {
			if (current) setUnavailable(!ok);
		});
		return () => {
			current = false;
		};
	}, [source, roomId, owner, extensionId]);
	return (
		<main style={{ maxWidth: 640, margin: "64px auto", padding: 24 }}>
			<h1>Open Prime Video</h1>
			<p>
				{unavailable
					? "Update or enable the AniDachi extension to keep this invitation through provider redirects. You can also choose a link below."
					: "Opening your watch party…"}
			</p>
			{unavailable && (
				<>
					<p>
						<a href={fallback}>Open on Prime Video</a>
					</p>
					{source.primeNavigation?.routes.map((route) => {
						const url = new URL(route.url);
						url.searchParams.set("autoplay", "1");
						url.hash = new URLSearchParams({ anidachiRoom: roomId }).toString();
						return (
							<p key={route.url}>
								<a href={url.toString()}>
									Open on {new URL(route.url).hostname}
								</a>
							</p>
						);
					})}
					<p>
						If the provider changes the link, return to this invitation after
						enabling the extension.
					</p>
				</>
			)}
		</main>
	);
}

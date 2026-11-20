"use client";
import { useEffect, useState } from "react";
import {
	resolvePrimeLaunch,
	type RoomSourceDescriptor,
} from "@anidachi/protocol";
import { requestPrimeLaunch } from "@/lib/prime-launch-client";
export function PrimeRoomLaunch({
	source,
	roomId,
	owner,
	extensionId,
}: {
	source: RoomSourceDescriptor;
	roomId: string;
	owner: string;
	extensionId: string | null;
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
	const destination = new URL(
		resolvePrimeLaunch({
			contentId: source.sourceUrl.split("/").at(-1)!,
			navigation: source.primeNavigation,
		}).url,
	);
	destination.searchParams.set("autoplay", "1");
	destination.hash = new URLSearchParams({ anidachiRoom: roomId }).toString();
	return (
		<main style={{ maxWidth: 640, margin: "64px auto", padding: 24 }}>
			<h1>Open Prime Video</h1>
			<p>
				{unavailable
					? "Update or enable the AniDachi extension to keep this invitation through provider redirects. You can also open the title below."
					: "Opening your watch party…"}
			</p>
			{unavailable && (
				<>
					<p>
						<a href={destination.toString()}>Open Prime Video</a>
					</p>
					<p>
						If the provider changes the link, return to this invitation after
						enabling the extension.
					</p>
				</>
			)}
		</main>
	);
}

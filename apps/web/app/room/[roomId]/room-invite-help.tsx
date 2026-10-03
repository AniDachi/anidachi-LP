"use client";

import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { INSTALL_HUB_PATH, installHubHref } from "@/lib/install-cta";
import styles from "./room-invite.module.css";

export function RoomInviteHelp({ hasLaunchUrl }: { hasLaunchUrl: boolean }) {
	const [helpOpen, setHelpOpen] = useState(false);
	const helpId = useId();
	const [installHref, setInstallHref] = useState(INSTALL_HUB_PATH);
	useEffect(() => {
		setInstallHref(installHubHref(window.location.pathname));
	}, []);
	return (
		<footer className={styles.help}>
			<a className={styles.install} href={installHref}>
				Get the extension
				<ArrowUpRight size={16} aria-hidden="true" />
			</a>
			<button
				type="button"
				className={styles.helpToggle}
				aria-expanded={helpOpen}
				aria-controls={helpId}
				onClick={() => setHelpOpen(!helpOpen)}
			>
				Need help?
				<ChevronDown size={16} aria-hidden="true" />
			</button>
			<div id={helpId} hidden={!helpOpen} className={styles.instructions}>
				<ol>
					<li>
						Use Chrome on a computer with the AniDachi extension installed.
					</li>
					<li>
						Make sure you can play the video with your own streaming account.
					</li>
					<li>
						{hasLaunchUrl
							? "Return here and join the room to open the host’s video."
							: "Join the room and keep this tab open while the host chooses a video."}
					</li>
					<li>
						On the video page, open the AniDachi bubble. If playback is blocked,
						choose Resume sync.
					</li>
				</ol>
			</div>
		</footer>
	);
}

import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./success.module.css";

export function SuccessPageFrame({
	children,
	preview = false,
}: {
	children: ReactNode;
	preview?: boolean;
}) {
	return (
		<main
			id="main-content"
			className={styles.page}
			data-preview={preview || undefined}
		>
			<div className={styles.content}>{children}</div>
		</main>
	);
}

export function SuccessFooter() {
	return (
		<footer className={styles.footer}>
			<Link href="/account/billing">Manage subscription</Link>
			<Link href="/contact">Need help?</Link>
		</footer>
	);
}

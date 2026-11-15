"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { api, ApiError } from "@/lib/client-api";
import { PROFILE_OWNER_HEADER } from "@/lib/profile-owner";
import { needsProfileName } from "@/lib/profile-name";

export function NameSetupScreen({ ownerUserId, returnTo }: {
	ownerUserId: string;
	returnTo: string;
}) {
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestRef = useRef<AbortController | null>(null);
	useEffect(() => () => requestRef.current?.abort(), []);

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (requestRef.current) return;
		const displayName = name.trim().replace(/\s+/g, " ");
		if (needsProfileName(displayName)) {
			setError("Enter your name or nickname.");
			return;
		}
		const controller = new AbortController();
		requestRef.current = controller;
		setSaving(true);
		setError(null);
		try {
			const data = await api<{ profile?: { userId?: string; displayName?: string } }>("/api/me/profile", {
				method: "PATCH",
				headers: { [PROFILE_OWNER_HEADER]: ownerUserId },
				body: JSON.stringify({ displayName }),
				signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
			});
			if (controller.signal.aborted) return;
			if (data.profile?.userId !== ownerUserId || data.profile.displayName !== displayName) {
				throw new Error("Unexpected profile response");
			}
			window.location.replace(returnTo);
		} catch (cause) {
			if (!controller.signal.aborted) {
				setError(cause instanceof ApiError && cause.status === 409
					? "Your account changed. Refresh this page and try again."
					: "Couldn't save your name. Please try again.");
			}
		} finally {
			if (!controller.signal.aborted) {
				requestRef.current = null;
				setSaving(false);
			}
		}
	}

	return <AuthPageShell maxWidth="max-w-[416px]">
		<AuthPageCard>
			<div className="mb-7 text-center">
				<AnidachiLogo size={48} priority className="mx-auto" />
				<h1 className="mt-5 text-[23px] font-semibold leading-snug tracking-tight text-foreground">Choose your name</h1>
			</div>
			<form onSubmit={save} className="space-y-3.5">
				<label className="sr-only" htmlFor="profile-name">Name or nickname</label>
				<input id="profile-name" name="nickname" autoComplete="nickname" maxLength={80}
					required autoFocus readOnly={saving} value={name} placeholder="Name or nickname"
					onInput={event => { setName(event.currentTarget.value); setError(null); }}
					aria-invalid={!!error} aria-describedby={error ? "profile-name-error" : undefined}
					className="min-h-[50px] w-full rounded-xl border border-foreground/20 bg-background px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-foreground/45 focus:border-ani-primary focus:ring-1 focus:ring-ani-focus" />
				{error ? <p id="profile-name-error" role="alert" className="text-sm leading-relaxed text-red-300">{error}</p> : null}
				<button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-[15px] font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
					{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
					{saving ? "Saving…" : "Continue"}
				</button>
			</form>
		</AuthPageCard>
	</AuthPageShell>;
}

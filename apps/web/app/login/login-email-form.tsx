"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

const messages: Record<string, string> = {
	invalid_email: "Enter a valid email address.",
	invalid_code:
		"That code is incorrect or expired. Try again or request a new code.",
	provider_required:
		"Sign in with Google or Discord once to enable email sign-in for your existing account.",
	rate_limited: "Too many requests. Please wait before trying again.",
	unavailable:
		"Email sign-in is temporarily unavailable. Try again or use Google or Discord.",
};
const buttonClass =
	"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
	"min-h-12 w-full rounded-xl border border-foreground/20 bg-background px-4 py-3 text-foreground outline-none focus:border-ani-orange focus:ring-1 focus:ring-ani-orange";

export function LoginEmailForm({ returnTo }: { returnTo: string }) {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [challenge, setChallenge] = useState<string | null>(null);
	const [pending, setPending] = useState<"send" | "verify" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [resendAt, setResendAt] = useState(0);
	const [now, setNow] = useState(Date.now());
	const inputRef = useRef<HTMLInputElement>(null);
	const busy = useRef(false);
	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open, challenge]);
	useEffect(() => {
		if (resendAt <= Date.now()) return;
		const timer = setInterval(() => {
			setNow(Date.now());
			if (Date.now() >= resendAt) clearInterval(timer);
		}, 1000);
		return () => clearInterval(timer);
	}, [resendAt]);
	const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

	async function submit(action: "send" | "verify") {
		if (busy.current) return;
		busy.current = true;
		setPending(action);
		setError(null);
		try {
			const response = await fetch(`/api/auth/email/${action}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					action === "send"
						? { email, returnTo }
						: { challengeId: challenge, code },
				),
				signal: AbortSignal.timeout(30000),
			});
			const data = (await response.json()) as {
				error?: string;
				challengeId?: string;
				redirectTo?: string;
				retryAfter?: number;
			};
			if (typeof data.retryAfter === "number" && data.retryAfter > 0) {
				setNow(Date.now());
				setResendAt(Date.now() + data.retryAfter * 1000);
			}
			if (!response.ok) {
				setError(messages[data.error ?? ""] ?? messages.unavailable);
				return;
			}
			if (action === "send" && data.challengeId) {
				setChallenge(data.challengeId);
				setCode("");
			} else if (
				action === "verify" &&
				data.redirectTo?.startsWith("/") &&
				!data.redirectTo.startsWith("//")
			)
				window.location.assign(data.redirectTo);
			else setError(messages.unavailable);
		} catch {
			setError(messages.unavailable);
		} finally {
			busy.current = false;
			setPending(null);
		}
	}
	function onSubmit(event: FormEvent) {
		event.preventDefault();
		void submit(challenge ? "verify" : "send");
	}

	return (
		<div className="mt-5">
			<div className="mb-5 flex items-center gap-3 text-xs text-foreground/40">
				<span className="h-px flex-1 bg-foreground/10" />
				or
				<span className="h-px flex-1 bg-foreground/10" />
			</div>
			{!open ? (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-foreground/20 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
				>
					<Mail className="h-4 w-4" aria-hidden />
					Continue with email
				</button>
			) : (
				<form onSubmit={onSubmit} className="space-y-3">
					{challenge ? (
						<>
							<button
								type="button"
								disabled={!!pending}
								onClick={() => {
									setChallenge(null);
									setCode("");
									setError(null);
								}}
								className="flex max-w-full items-center gap-2 text-left text-sm text-foreground/65 hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
								<span className="truncate">{email}</span>
							</button>
							<label
								htmlFor="email-code"
								className="block text-sm text-foreground/70"
							>
								Enter the code from your email
							</label>
							<input
								ref={inputRef}
								id="email-code"
								name="code"
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{6}"
								maxLength={6}
								required
								readOnly={!!pending}
								value={code}
								onChange={(e) =>
									setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
								}
								className={`${inputClass} text-center text-xl tracking-[0.5em]`}
								placeholder="000000"
								aria-describedby={error ? "email-login-error" : undefined}
								aria-invalid={!!error}
							/>
						</>
					) : (
						<>
							<label
								htmlFor="login-email"
								className="block text-sm text-foreground/70"
							>
								Email address
							</label>
							<input
								ref={inputRef}
								id="login-email"
								name="email"
								type="email"
								autoComplete="email"
								maxLength={254}
								required
								readOnly={!!pending}
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									setError(null);
								}}
								className={inputClass}
								placeholder="you@example.com"
								aria-describedby={error ? "email-login-error" : undefined}
								aria-invalid={!!error}
							/>
						</>
					)}
					{error ? (
						<p
							id="email-login-error"
							role="alert"
							className="text-sm leading-relaxed text-red-300"
						>
							{error}
						</p>
					) : null}
					<button
						type="submit"
						disabled={
							!!pending ||
							(!!challenge && code.length !== 6) ||
							(!challenge && remaining > 0)
						}
						className={buttonClass}
					>
						{pending ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						) : null}
						{pending === "verify"
							? "Signing in…"
							: pending === "send"
								? "Sending…"
								: challenge
									? "Sign in"
									: remaining
										? `Send code in ${remaining}s`
										: "Send code"}
					</button>
					{challenge ? (
						<button
							type="button"
							disabled={!!pending || remaining > 0}
							onClick={() => void submit("send")}
							className="min-h-10 w-full text-sm text-foreground/60 transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
						>
							{remaining ? `Resend code in ${remaining}s` : "Resend code"}
						</button>
					) : null}
				</form>
			)}
		</div>
	);
}

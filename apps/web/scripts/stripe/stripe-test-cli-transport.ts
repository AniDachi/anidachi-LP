import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../../lib/anidachi-auth/stripe-env";

const run = promisify(execFile);

// The CLI owns the credential. Never extract it or forward SDK Authorization.
export function buildTestCliArguments(
	profile: string,
	input: string,
	init: RequestInit,
): string[] {
	assert.match(profile, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
	const url = new URL(input);
	assert.equal(url.origin, "https://api.stripe.com");
	assert.ok(url.pathname.startsWith("/v1/"));
	assert.equal(url.username, "");
	assert.equal(url.password, "");
	const method = (init.method ?? "GET").toUpperCase();
	assert.ok(
		method === "GET" || method === "POST",
		"Only proof reads and explicit fixture writes are allowed",
	);
	const headers = new Headers(init.headers);
	assert.equal(headers.get("stripe-version"), STRIPE_API_VERSION);
	const args = [
		method.toLowerCase(),
		url.pathname,
		"--live=false",
		"--project-name",
		profile,
		"--stripe-version",
		STRIPE_API_VERSION,
		"--show-headers",
		"--color",
		"off",
		"--confirm",
	];
	const idempotency = headers.get("idempotency-key");
	if (idempotency) args.push("--idempotency", idempotency);
	assert.ok(
		init.body == null || typeof init.body === "string",
		"Only form-encoded Stripe requests supported",
	);
	for (const parameters of [
		url.searchParams,
		new URLSearchParams((init.body as string | undefined) ?? ""),
	]) {
		for (const [key, value] of parameters)
			args.push("--data", `${key}=${value}`);
	}
	return args;
}

export function parseTestCliResponse(stdout: string, stderr: string): Response {
	const headers = new Headers();
	let status: number | undefined;
	const allowed = new Set([
		"stripe-version",
		"request-id",
		"content-type",
		"retry-after",
		"stripe-should-retry",
	]);
	for (const line of stderr.split(/\r?\n/)) {
		const statusLine = /^< HTTP(?:\/[\d.]+)? (\d{3})\b/.exec(line);
		if (statusLine) status = Number(statusLine[1]);
		const header = /^< ([\w-]+):\s*(.*)$/.exec(line);
		if (header && allowed.has(header[1].toLowerCase()))
			headers.set(header[1], header[2]);
	}
	assert.ok(status, "CLI response HTTP status missing");
	assert.equal(
		headers.get("stripe-version"),
		STRIPE_API_VERSION,
		"Actual Stripe response version missing or unpinned",
	);
	JSON.parse(stdout);
	return new Response(stdout, { status, headers });
}

export function createTestCliStripeClient(profile: string): Stripe {
	const fetchViaCli = async (
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> => {
		const args = buildTestCliArguments(profile, String(input), init ?? {});
		// A globally exported key must not override the explicitly chosen profile.
		const environment = { ...process.env };
		delete environment.STRIPE_API_KEY;
		try {
			const { stdout, stderr } = await run("stripe", args, {
				encoding: "utf8",
				timeout: 30_000,
				maxBuffer: 2 * 1024 * 1024,
				env: environment,
				signal: init?.signal ?? undefined,
			});
			return parseTestCliResponse(stdout, stderr);
		} catch (error) {
			// HTTP errors still have a structured Stripe response for the SDK. Never
			// surface raw CLI stderr: it can include request authorization headers.
			if (
				error &&
				typeof error === "object" &&
				"stdout" in error &&
				"stderr" in error &&
				typeof error.stdout === "string" &&
				typeof error.stderr === "string"
			) {
				try {
					return parseTestCliResponse(error.stdout, error.stderr);
				} catch {
					/* fail closed */
				}
			}
			throw new Error(
				"Stripe test CLI request failed; credentials and raw headers omitted",
			);
		}
	};
	return new Stripe("sk_test_cli_transport_placeholder", {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(fetchViaCli),
		maxNetworkRetries: 0,
		timeout: 30_000,
	});
}

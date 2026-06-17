#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const PROFILE_COMMANDS = {
	docs: [],
	web: [
		"pnpm --filter @anidachi/web check",
		"pnpm --filter @anidachi/web test",
	],
	api: [
		"pnpm --filter @anidachi/api check",
		"pnpm --filter @anidachi/api test",
	],
	extension: [
		"pnpm --filter @anidachi/extension check",
		"pnpm --filter @anidachi/extension test",
		"pnpm build:extension:staging",
		"pnpm validate:extension:staging",
	],
	rooms: [
		"pnpm --filter @anidachi/api check",
		"pnpm --filter @anidachi/api test",
		"pnpm harness:rooms",
		"npm --prefix tests/e2e install",
		"npm --prefix tests/e2e exec playwright install chromium",
		"npm --prefix tests/e2e run harness:p2p",
	],
	workflows: ["pnpm check", "gh workflow list"],
	all: ["pnpm check", "pnpm test", "pnpm harness:rooms"],
};

const args = process.argv.slice(2);
const profile = readFlag("--profile");
const base = readFlag("--base") ?? "origin/staging";

if (args.includes("--help") || args.includes("-h")) {
	printHelp();
	process.exit(0);
}

if (profile) {
	printProfile(profile);
	process.exit(0);
}

const files = changedFiles(base);
const profiles = classify(files);

console.log("AniDachi dev-check");
console.log(`Base: ${base}`);
console.log(`Changed files: ${files.length}`);

if (files.length > 0) {
	for (const file of files.slice(0, 30)) {
		console.log(`- ${file}`);
	}
	if (files.length > 30) {
		console.log(`... ${files.length - 30} more`);
	}
}

console.log("");

if (profiles.size === 0) {
	console.log("No changed files detected. Baseline commands:");
	printCommands(PROFILE_COMMANDS.all);
	process.exit(0);
}

console.log("Recommended profiles:");
for (const name of profiles) {
	console.log(`- ${name}`);
}

console.log("");
console.log("Recommended commands:");
const commands = dedupe(
	[...profiles].flatMap((name) => PROFILE_COMMANDS[name] ?? []),
);
printCommands(commands);

if (profiles.has("rooms")) {
	console.log("");
	console.log(
		"Room/P2P changes also require staging acceptance before promotion to main.",
	);
}

function readFlag(name) {
	const index = args.indexOf(name);
	if (index === -1) return null;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) {
		fail(`${name} requires a value`);
	}
	return value;
}

function changedFiles(baseRef) {
	const tracked = runGit([
		"diff",
		"--name-only",
		"--diff-filter=ACMRTUXB",
		`${baseRef}...HEAD`,
	]);
	const unstaged = runGit(["diff", "--name-only", "--diff-filter=ACMRTUXB"]);
	const staged = runGit([
		"diff",
		"--cached",
		"--name-only",
		"--diff-filter=ACMRTUXB",
	]);
	const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
	return dedupe(
		[...tracked, ...unstaged, ...staged, ...untracked].filter(Boolean),
	).sort();
}

function runGit(argv) {
	try {
		const output = execFileSync("git", argv, { encoding: "utf8" });
		return output.split(/\r?\n/).filter(Boolean);
	} catch {
		return [];
	}
}

function classify(files) {
	const profiles = new Set();

	for (const file of files) {
		if (isDocs(file)) profiles.add("docs");
		if (file.startsWith("apps/web/")) profiles.add("web");
		if (file.startsWith("apps/api/")) profiles.add("api");
		if (file.startsWith("apps/extension/")) profiles.add("extension");
		if (file.startsWith("packages/protocol/")) {
			profiles.add("api");
			profiles.add("extension");
			profiles.add("rooms");
		}
		if (file.startsWith(".github/workflows/")) profiles.add("workflows");
		if (isSharedTooling(file)) profiles.add("all");
		if (!isDocs(file) && isRoomOrP2P(file)) profiles.add("rooms");
	}

	if (profiles.size === 0 && files.length > 0) {
		profiles.add("all");
	}

	return profiles;
}

function isDocs(file) {
	return (
		file === "README.md" ||
		file === "AGENTS.md" ||
		file.endsWith(".md") ||
		file.startsWith("docs/")
	);
}

function isSharedTooling(file) {
	return (
		file === "package.json" ||
		file === "pnpm-lock.yaml" ||
		file === "turbo.json" ||
		file === "biome.json" ||
		file.startsWith("scripts/")
	);
}

function isRoomOrP2P(file) {
	return (
		file.includes("room") ||
		file.includes("p2p") ||
		file.includes("webrtc") ||
		file.includes("ghost-cam") ||
		file === "scripts/room-signaling-harness.mjs" ||
		file === "scripts/p2p-scorecard.mjs" ||
		file.startsWith("tests/e2e/")
	);
}

function printProfile(name) {
	const commands = PROFILE_COMMANDS[name];
	if (!commands) {
		fail(
			`Unknown profile "${name}". Known profiles: ${Object.keys(PROFILE_COMMANDS).join(", ")}`,
		);
	}
	console.log(`${name} commands:`);
	printCommands(commands);
}

function printCommands(commands) {
	for (const command of commands) {
		console.log(`  ${command}`);
	}
}

function printHelp() {
	console.log(`Usage:
  node scripts/dev-check.mjs [--base origin/staging]
  node scripts/dev-check.mjs --profile web|api|extension|rooms|workflows|docs|all

The command prints recommended checks for the files changed relative to the base ref.
It does not execute the checks.`);
}

function dedupe(values) {
	return [...new Set(values)];
}

function fail(message) {
	console.error(`dev-check: ${message}`);
	process.exit(1);
}

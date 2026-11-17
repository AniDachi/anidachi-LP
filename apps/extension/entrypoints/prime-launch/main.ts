// Compatibility redirect for a launch tab left open by an older extension.
// Current launches navigate directly from the background.
const root = document.getElementById("root")!;
root.textContent = "Opening Prime Video…";
const result = await chrome.runtime
	.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "read",
	})
	.catch(() => null);
if (result?.status !== "ready") {
	root.textContent =
		"This launch expired. Open the invitation or Resume again.";
}
export {};

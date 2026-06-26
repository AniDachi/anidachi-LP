# LinkedIn Sales Navigator Connection Requests

Automates sending connection invitations from a **vetted Sales Navigator people search** using a dedicated Chrome profile and Playwright over CDP.

## Overview

Two-step workflow:

1. **Launch Chrome** — dedicated profile with remote debugging enabled
2. **Run the connect script** — attaches to that browser and sends invitations from the open search tab

The script does **not** manage recipient lists or search criteria. You open and vet the Sales Navigator search; the script only automates the UI flow for visible leads.

---

## Setup

```bash
npm --prefix scripts/linkedin install
```

---

## Step 1: Launch Chrome

```bash
pnpm linkedin:chrome
```

`launch-chrome.sh` starts a **separate Chrome instance** (not your daily browser):

| Setting | Default | Override |
|---------|---------|----------|
| Profile directory | `~/.chrome-linkedin-automation` | `LINKEDIN_CHROME_PROFILE` |
| CDP port | `9222` | `LINKEDIN_CDP_PORT` |
| Chrome binary | macOS: `/Applications/Google Chrome.app/...` | `LINKEDIN_CHROME_BIN` |

Chrome launches with anti-throttling flags so automation stays reliable when the window is in the background:

- `--disable-backgrounding-occluded-windows`
- `--disable-renderer-backgrounding`
- `--disable-background-timer-throttling`
- `--disable-features=CalculateNativeWinOcclusion`

On first launch, sign into LinkedIn and Sales Navigator in that window. Chrome opens directly to:

`https://www.linkedin.com/sales/search/people`

### Port already in use

If port 9222 is taken, either reuse the existing session:

```bash
LINKEDIN_CHROME_REUSE=1 pnpm linkedin:chrome
```

Or stop the stale process and relaunch:

```bash
lsof -tiTCP:9222 -sTCP:LISTEN | xargs kill
pnpm linkedin:chrome
```

---

## Step 2: Send connection requests

1. Open a **vetted** Sales Navigator people search in the automation Chrome window
2. Run:

```bash
pnpm linkedin:connect -- --batch 3 --yes
pnpm linkedin:connect -- --batch all --dry-run --yes
```

The script does **not** steal OS focus (`bringToFront` is not used). CDP dispatches clicks directly to Chrome.

### CLI flags

| Flag | Description |
|------|-------------|
| `--batch N` | Max invitations to send this run (default: `1`) |
| `--batch all` | Process every lead on the **current page** (~25 standard); scrolls within the page but does not click Next |
| `--dry-run` | Walk the flow without clicking **Send Invitation** |
| `--yes` | Skip interactive batch confirmation |
| `--cdp-url URL` | Chrome CDP endpoint (default: `http://127.0.0.1:9222`) |
| `--help` | Show usage |

Environment variable `LINKEDIN_CDP_URL` can also set the CDP endpoint.

### Pagination behavior

| Mode | Scroll within page | Click Next |
|------|---------------------|------------|
| `--batch N` (numeric) | Yes | Yes, when needed to reach N sends |
| `--batch all` | Yes | No — stops at current page boundary |

---

## Per-lead flow

For each unprocessed lead on the current search page:

1. **Find lead cards** — buttons labeled `See more actions for <name>`
2. **Scroll into view** and open the **⋯ actions menu**
3. Locate **Connect** with an exact match scoped **only** to that lead's open menu (no page-wide fallback)
4. Hover and click **Connect**
5. Wait for the **Send invitation** dialog
6. **Verify** the dialog matches the intended lead name (normalized exact line match, not substring)
7. Click **Send Invitation** (skipped in `--dry-run`)
8. If the dialog is slow to close, mark `send-ambiguous` and **continue** (manual verification recommended)

If **Connect** is unavailable (already connected, etc.), the lead is skipped with reason `connect-unavailable`.

Invitations are sent **without a personal note**. Delays between actions use randomized `humanSleep` ranges.

---

## Safety behavior

- **Interactive confirmation** before starting (unless `--yes`)
- **Blocker detection** scoped to LinkedIn UI chrome (alerts, toasts, feedback banners, non-invitation modals) — not full page body text
- **Stops the entire run** on hard blockers (`blocker:*`, disabled send button) — exit code `2`
- **Continues the run** on ambiguous send outcomes (`send-ambiguous:*`) — flagged in summary for manual check
- **Multi-tab warning** when more than one Sales Navigator people-search tab is open
- **No fabricated notes** — blank invitations only

---

## Session output

At the end, the script prints a summary:

```
[linkedin:connect] Session summary
[linkedin:connect] sent: N
[linkedin:connect] skipped: N
[linkedin:connect] dry-run: N
[linkedin:connect] stoppedEarly: yes|no
[linkedin:connect] <lead name>  <outcome>  <reason>
```

### Outcomes

| Outcome | Meaning |
|---------|---------|
| `sent` | Invitation sent successfully |
| `dry-run` | Flow completed without sending |
| `skipped` | Lead skipped (no Connect, verify failed, `send-ambiguous`, etc.) |
| `stopped` | Run halted due to blocker or error |

### Common skip reasons

| Reason | Meaning |
|--------|---------|
| `connect-unavailable` | Menu open but no exact Connect entry |
| `send-ambiguous:*` | Send may have worked; dialog did not close in time — verify manually |
| `dialog-verify-failed:*` | Dialog name did not exactly match intended lead |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed normally |
| `1` | Error (no Sales Nav tab, CDP connection failed, etc.) |
| `2` | Stopped early due to LinkedIn restriction or blocker |

---

## Architecture

```
Dedicated Chrome profile (CDP on :9222, background-throttle disabled)
        ↓
User vets Sales Navigator people search
        ↓
Playwright connects over CDP (no window focus steal)
        ↓
Menu-scoped Connect → verify dialog → Send invitation for N leads
```

---

## Files

| File | Purpose |
|------|---------|
| `launch-chrome.sh` | Starts Chrome with debugging and dedicated profile |
| `send-connection-requests.mjs` | Playwright automation script |
| `package.json` | Local deps (`playwright` in `dependencies`) and npm scripts |

Root `package.json` aliases:

- `pnpm linkedin:chrome` → `npm --prefix scripts/linkedin run chrome`
- `pnpm linkedin:connect` → `npm --prefix scripts/linkedin run send`

---

## Source code

### `package.json`

```json
{
  "name": "@anidachi/linkedin-connect",
  "private": true,
  "type": "module",
  "scripts": {
    "chrome": "bash launch-chrome.sh",
    "send": "node send-connection-requests.mjs"
  },
  "dependencies": {
    "playwright": "^1.50.0"
  }
}
```

### `launch-chrome.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

CDP_PORT="${LINKEDIN_CDP_PORT:-9222}"
PROFILE_DIR="${LINKEDIN_CHROME_PROFILE:-$HOME/.chrome-linkedin-automation}"

if [[ "$(uname)" == "Darwin" ]]; then
  CHROME_BIN="${LINKEDIN_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
else
  CHROME_BIN="${LINKEDIN_CHROME_BIN:-google-chrome}"
fi

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome not found at: $CHROME_BIN" >&2
  echo "Set LINKEDIN_CHROME_BIN to your Chrome executable path." >&2
  exit 1
fi

port_in_use() {
  lsof -nP -iTCP:"$CDP_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

print_port_conflict_help() {
  echo "[linkedin:chrome] Port $CDP_PORT is already in use:" >&2
  lsof -nP -iTCP:"$CDP_PORT" -sTCP:LISTEN >&2 || true
  echo >&2
  echo "[linkedin:chrome] Another Chrome debugging session is already running." >&2
  echo "[linkedin:chrome] Either reuse that window, or stop stale Chrome on this port:" >&2
  echo "  lsof -tiTCP:$CDP_PORT -sTCP:LISTEN | xargs kill" >&2
  echo "  pnpm linkedin:chrome" >&2
  echo >&2
  echo "[linkedin:chrome] Or use a different port:" >&2
  echo "  LINKEDIN_CDP_PORT=9333 pnpm linkedin:chrome" >&2
}

mkdir -p "$PROFILE_DIR"

if port_in_use; then
  if [[ "${LINKEDIN_CHROME_REUSE:-}" == "1" ]]; then
    echo "[linkedin:chrome] Port $CDP_PORT already in use; reusing existing Chrome (LINKEDIN_CHROME_REUSE=1)."
    echo "[linkedin:chrome] Open or focus your Sales Navigator people search, then run linkedin:connect."
    exit 0
  fi
  print_port_conflict_help
  exit 1
fi

echo "[linkedin:chrome] Profile: $PROFILE_DIR"
echo "[linkedin:chrome] CDP port: $CDP_PORT"
echo "[linkedin:chrome] Starting Chrome (separate from your daily profile)..."
echo "[linkedin:chrome] First time: log into LinkedIn/Sales Navigator, then open a people search."

exec "$CHROME_BIN" \
  --remote-debugging-port="$CDP_PORT" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-features=CalculateNativeWinOcclusion \
  "https://www.linkedin.com/sales/search/people"
```

### `send-connection-requests.mjs`

```javascript
#!/usr/bin/env node
/**
 * LinkedIn Sales Navigator connection requests (attach to logged-in Chrome via CDP).
 *
 * Prereqs:
 *   npm --prefix scripts/linkedin install
 *
 * 1) Launch the dedicated LinkedIn Chrome profile (keeps your daily Chrome open):
 *   pnpm linkedin:chrome
 *
 *    Profile dir: ~/.chrome-linkedin-automation
 *    Override with LINKEDIN_CHROME_PROFILE=/path/to/profile
 *
 * 2) First time only: sign into LinkedIn/Sales Navigator in that window.
 *
 * 3) Open a vetted Sales Navigator people search, then run:
 *   pnpm linkedin:connect -- --batch 3 --yes
 *   pnpm linkedin:connect -- --batch all --dry-run --yes
 *
 * Flags:
 *   --batch N|all  Max invitations this run, or every lead on the current page (default: 1)
 *   --dry-run       Open menus/dialogs but do not click Send invitation
 *   --yes           Skip interactive batch confirmation
 *   --cdp-url URL   Chrome CDP endpoint (default: http://127.0.0.1:9222)
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const SALES_NAV_PEOPLE_PATH = "/sales/search/people";

const BLOCKER_PATTERNS = [
  /captcha/i,
  /identity verification/i,
  /verify your identity/i,
  /suspicious activity/i,
  /invitation limit/i,
  /weekly invitation limit/i,
  /restricted/i,
  /temporarily restricted/i,
  /unusual activity/i,
  /security verification/i,
];

const BLOCKER_SCOPED_SELECTORS = [
  '[role="alert"]',
  ".artdeco-inline-feedback",
  ".artdeco-toast-item",
  ".global-alert",
  '[data-test-artdeco-toast-item-type]',
];

function parseArgs(argv) {
  const options = {
    batch: 1,
    dryRun: false,
    yes: false,
    cdpUrl: process.env.LINKEDIN_CDP_URL ?? "http://127.0.0.1:9222",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--batch") {
      const raw = argv[++i];
      if (raw === "all") {
        options.batch = Infinity;
      } else {
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1) {
          throw new Error("--batch must be a positive integer or 'all'");
        }
        options.batch = value;
      }
    } else if (arg === "--cdp-url") {
      const value = argv[++i];
      if (!value) {
        throw new Error("--cdp-url requires a value");
      }
      options.cdpUrl = value;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node send-connection-requests.mjs [options]

Options:
  --batch N|all   Max invitations this run, or every lead on the current page (default: 1)
  --dry-run       Walk the flow without clicking Send invitation
  --yes           Skip interactive batch confirmation
  --cdp-url URL   Chrome CDP endpoint (default: http://127.0.0.1:9222)
  --help          Show this help
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanSleep(minMs, maxMs) {
  const span = maxMs - minMs;
  return sleep(minMs + Math.random() * span);
}

function log(message) {
  console.log(`[linkedin:connect] ${message}`);
}

function norm(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function batchLabel(batch) {
  return batch === Infinity ? "all (current page)" : String(batch);
}

function isSalesNavPeopleUrl(url) {
  try {
    const parsed = new URL(url);
    const { hostname } = parsed;
    return (
      (hostname === "www.linkedin.com" || hostname.endsWith(".linkedin.com")) &&
      parsed.pathname.includes(SALES_NAV_PEOPLE_PATH)
    );
  } catch {
    return false;
  }
}

async function confirmBatch(batch, dryRun) {
  const rl = createInterface({ input, output });
  const mode = dryRun ? "dry-run" : "send";
  const target =
    batch === Infinity
      ? "every lead on the current page (~25 standard)"
      : `up to ${batch}`;
  const answer = await rl.question(
    `About to ${mode} ${target} connection request(s) on the current Sales Navigator search. Continue? [y/N] `,
  );
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function findSalesNavPage(browser) {
  const candidates = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const url = page.url();
      if (isSalesNavPeopleUrl(url)) {
        candidates.push(page);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length > 1) {
    log(
      `Warning: ${candidates.length} Sales Navigator people-search tabs open; using the most recently opened match.`,
    );
  }

  return candidates[candidates.length - 1];
}

async function readBlockerScopedText(page) {
  const parts = [];

  for (const selector of BLOCKER_SCOPED_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const text = await locator.nth(index).innerText({ timeout: 1000 }).catch(() => "");
      if (text.trim()) {
        parts.push(text);
      }
    }
  }

  const dialogs = page.getByRole("dialog");
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let index = 0; index < dialogCount; index += 1) {
    const dialog = dialogs.nth(index);
    const text = await dialog.innerText({ timeout: 1000 }).catch(() => "");
    if (text.trim() && !/send invitation/i.test(text)) {
      parts.push(text);
    }
  }

  return parts.join("\n");
}

async function detectBlockers(page, extraText = "") {
  const scopedText = await readBlockerScopedText(page);
  const text = extraText ? `${extraText}\n${scopedText}` : scopedText;
  for (const pattern of BLOCKER_PATTERNS) {
    if (pattern.test(text)) {
      return pattern.source;
    }
  }
  return null;
}

function leadCards(page) {
  return page.getByRole("button", { name: /^See more actions for / });
}

async function leadNameFromActionsButton(actionsButton) {
  const label = (await actionsButton.getAttribute("aria-label")) ?? "";
  const match = label.match(/^See more actions for (.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function closeOpenOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await humanSleep(150, 300);
  await page.keyboard.press("Escape").catch(() => {});
  await humanSleep(100, 250);
}

function actionMenuLocators(scope) {
  const viewProfile = scope.getByText("View profile", { exact: true });
  return [
    scope.locator(".artdeco-dropdown__content").filter({ has: viewProfile }),
    scope.locator(".artdeco-dropdown__content-inner").filter({ has: viewProfile }),
    scope.getByRole("menu").filter({ has: viewProfile }),
    scope.locator('[class*="dropdown"]').filter({ has: viewProfile }),
  ];
}

function leadRow(actionsButton) {
  return actionsButton.locator(
    "xpath=ancestor::*[@role='listitem' or contains(@class,'result')][1]",
  );
}

async function findOpenMenuContainer(page, actionsButton, timeoutMs = 3000) {
  const row = leadRow(actionsButton);
  const scopes = [];
  if ((await row.count()) > 0) {
    scopes.push(row.first());
  }
  scopes.push(page);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const scope of scopes) {
      for (const locator of actionMenuLocators(scope)) {
        const menu = locator.last();
        if ((await menu.count()) > 0 && (await menu.isVisible().catch(() => false))) {
          return menu;
        }
      }
    }
    await sleep(100);
  }
  return null;
}

async function scrollLeadIntoView(actionsButton) {
  await actionsButton
    .evaluate((el) => {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    })
    .catch(() => {});
  await humanSleep(250, 450);
}

async function clickActionsButton(page, actionsButton) {
  await scrollLeadIntoView(actionsButton);

  const row = leadRow(actionsButton);
  if ((await row.count()) > 0) {
    await row.first().hover().catch(() => {});
    await humanSleep(150, 350);
  }

  await actionsButton.hover().catch(() => {});
  await humanSleep(100, 250);

  try {
    await actionsButton.click({ timeout: 5000 });
  } catch {
    await scrollLeadIntoView(actionsButton);
    await actionsButton.click({ timeout: 5000, force: true });
  }
}

async function openActionsMenu(page, actionsButton) {
  await clickActionsButton(page, actionsButton);
  let menu = await findOpenMenuContainer(page, actionsButton);

  if (!menu) {
    await closeOpenOverlays(page);
    await clickActionsButton(page, actionsButton);
    menu = await findOpenMenuContainer(page, actionsButton);
  }

  if (!menu) {
    throw new Error("menu-did-not-open");
  }

  const connectOption = menu.getByText("Connect", { exact: true }).first();
  const hasConnect =
    (await connectOption.count()) > 0 &&
    (await connectOption.isVisible().catch(() => false));

  if (!hasConnect) {
    await closeOpenOverlays(page);
    throw new Error("connect-unavailable");
  }

  await humanSleep(250, 700);
  return connectOption;
}

async function openConnectDialog(page, connectOption) {
  await connectOption.hover().catch(() => {});
  await humanSleep(150, 400);
  await connectOption.click({ timeout: 5000 });

  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: /Send invitation/i })
    .last();
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  return dialog;
}

async function verifyDialogLead(dialog, leadName) {
  const normalizedLead = norm(leadName);

  const headingCandidates = [
    dialog.getByRole("heading"),
    dialog.locator("h1, h2, h3, h4"),
    dialog.locator('[class*="title"], [class*="name"]'),
  ];

  for (const candidate of headingCandidates) {
    const count = await candidate.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const text = await candidate.nth(index).innerText({ timeout: 1000 }).catch(() => "");
      if (text && norm(text) === normalizedLead) {
        return;
      }
    }
  }

  const dialogText = await dialog.innerText();
  const hasExactLine = dialogText
    .split("\n")
    .some((line) => norm(line) === normalizedLead);

  if (!hasExactLine) {
    log(`Dialog verification failed for "${leadName}". Dialog text:\n${dialogText}`);
    throw new Error(
      `Send invitation dialog does not match intended lead "${leadName}"`,
    );
  }
}

async function sendInvitation(page, dialog, dryRun) {
  const blocker = await detectBlockers(page, await dialog.innerText());
  if (blocker) {
    return { ok: false, reason: `blocker:${blocker}` };
  }

  const sendButton = dialog
    .getByRole("button", { name: /^Send Invitation$/i })
    .or(dialog.getByText("Send Invitation", { exact: true }));
  await sendButton.first().waitFor({ state: "visible", timeout: 5000 });

  if (await sendButton.first().isDisabled()) {
    return { ok: false, reason: "send-button-disabled" };
  }

  if (dryRun) {
    await page.keyboard.press("Escape").catch(() => {});
    await humanSleep(250, 450);
    return { ok: true, reason: "dry-run" };
  }

  await sendButton.first().click({ timeout: 5000 });
  await dialog.waitFor({ state: "hidden", timeout: 12_000 }).catch(async () => {
    const stillVisible = await dialog.isVisible().catch(() => false);
    if (stillVisible) {
      throw new Error("Send invitation dialog did not close after send");
    }
  });
  await humanSleep(450, 850);

  return { ok: true, reason: "sent" };
}

function isAmbiguousSendFailure(reason) {
  return reason.startsWith("send-ambiguous:");
}

async function processLead(page, actionsButton, dryRun) {
  const leadName = await leadNameFromActionsButton(actionsButton);
  if (!leadName) {
    return { leadName: "(unknown)", outcome: "skipped", reason: "missing-name" };
  }

  await closeOpenOverlays(page);

  let connectOption;
  try {
    connectOption = await openActionsMenu(page, actionsButton);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      leadName,
      outcome: "skipped",
      reason:
        message === "connect-unavailable"
          ? "connect-unavailable"
          : `menu-open-failed:${message}`,
    };
  }

  let dialog;
  try {
    dialog = await openConnectDialog(page, connectOption);
  } catch (error) {
    await closeOpenOverlays(page);
    return {
      leadName,
      outcome: "skipped",
      reason: `connect-dialog-failed:${error instanceof Error ? error.message : error}`,
    };
  }

  try {
    await verifyDialogLead(dialog, leadName);
  } catch (error) {
    await closeOpenOverlays(page);
    return {
      leadName,
      outcome: "skipped",
      reason: `dialog-verify-failed:${error instanceof Error ? error.message : error}`,
    };
  }

  let sendResult;
  try {
    sendResult = await sendInvitation(page, dialog, dryRun);
  } catch (error) {
    sendResult = {
      ok: false,
      reason: `send-ambiguous:${error instanceof Error ? error.message : error}`,
    };
  }
  await closeOpenOverlays(page);

  if (!sendResult.ok) {
    if (isAmbiguousSendFailure(sendResult.reason)) {
      return {
        leadName,
        outcome: "skipped",
        reason: sendResult.reason,
      };
    }
    return {
      leadName,
      outcome: "stopped",
      reason: sendResult.reason,
    };
  }

  return {
    leadName,
    outcome: dryRun ? "dry-run" : "sent",
    reason: sendResult.reason,
  };
}

function printSummary(results, sentCount, stoppedEarly, stopReason) {
  console.log("");
  log("Session summary");
  log(`sent: ${sentCount}`);
  log(`skipped: ${results.filter((r) => r.outcome === "skipped").length}`);
  log(`dry-run: ${results.filter((r) => r.outcome === "dry-run").length}`);
  log(`stoppedEarly: ${stoppedEarly ? "yes" : "no"}`);
  if (stopReason) {
    log(`stopReason: ${stopReason}`);
  }
  for (const result of results) {
    log(`${result.leadName}\t${result.outcome}\t${result.reason}`);
  }
}

async function tryLoadMoreLeads(page, processedNames, allowPagination) {
  const namesBefore = new Set(processedNames);
  const count = await leadCards(page).count();

  if (count > 0) {
    const lastCard = leadCards(page).nth(count - 1);
    await scrollLeadIntoView(lastCard);
    await lastCard.hover().catch(() => {});
  }

  await page.mouse.wheel(0, 1200);
  await humanSleep(1000, 1600);

  const afterCount = await leadCards(page).count();
  for (let index = 0; index < afterCount; index += 1) {
    const name = await leadNameFromActionsButton(leadCards(page).nth(index));
    if (name && !namesBefore.has(name)) {
      return true;
    }
  }

  if (!allowPagination) {
    return false;
  }

  const nextBtn = page
    .getByRole("button", { name: /^Next$/i })
    .or(page.locator('button[aria-label="Next"]'))
    .or(page.locator(".artdeco-pagination__button--next"));
  if ((await nextBtn.count()) > 0) {
    const btn = nextBtn.first();
    if ((await btn.isVisible()) && !(await btn.isDisabled())) {
      await btn.click({ timeout: 5000 });
      await humanSleep(2000, 3200);
      return true;
    }
  }

  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allowPagination = options.batch !== Infinity;

  if (!options.yes) {
    const confirmed = await confirmBatch(options.batch, options.dryRun);
    if (!confirmed) {
      log("Cancelled.");
      process.exit(0);
    }
  }

  let browser;
  try {
    browser = await chromium.connectOverCDP(options.cdpUrl);
  } catch (error) {
    console.error(
      `Failed to connect to Chrome at ${options.cdpUrl}. Quit Chrome completely (Cmd+Q), relaunch with --remote-debugging-port=9222, then retry.`,
    );
    throw error;
  }

  const page = await findSalesNavPage(browser);
  if (!page) {
    console.error(
      "No Sales Navigator people search tab found. Open /sales/search/people in Chrome first.",
    );
    process.exit(1);
  }

  log(`Using tab: ${page.url()}`);

  const initialBlocker = await detectBlockers(page);
  if (initialBlocker) {
    console.error(`LinkedIn restriction detected before start: ${initialBlocker}`);
    process.exit(1);
  }

  const results = [];
  let sentCount = 0;
  let stoppedEarly = false;
  let stopReason = "";
  const processedNames = new Set();
  let loadMoreAttempts = 0;
  const maxLoadMoreAttempts = 15;

  log(`Found ${await leadCards(page).count()} visible lead card(s) with action menus.`);

  while (sentCount < options.batch) {
    const buttons = leadCards(page);
    const totalCards = await buttons.count();
    if (totalCards === 0) {
      if (
        sentCount < options.batch &&
        loadMoreAttempts < maxLoadMoreAttempts &&
        (await tryLoadMoreLeads(page, processedNames, allowPagination))
      ) {
        loadMoreAttempts += 1;
        continue;
      }
      log("No more visible lead cards.");
      break;
    }

    let actionsButton = null;
    let leadName = "";
    for (let index = 0; index < totalCards; index += 1) {
      const candidate = buttons.nth(index);
      const name = await leadNameFromActionsButton(candidate);
      if (name && !processedNames.has(name)) {
        actionsButton = candidate;
        leadName = name;
        break;
      }
    }

    if (!actionsButton) {
      if (
        sentCount < options.batch &&
        loadMoreAttempts < maxLoadMoreAttempts &&
        (await tryLoadMoreLeads(page, processedNames, allowPagination))
      ) {
        loadMoreAttempts += 1;
        log("Loaded more search results, continuing…");
        continue;
      }
      log(
        `Stopping after ${sentCount}/${batchLabel(options.batch)} sent; no more unprocessed leads on this page.`,
      );
      break;
    }

    loadMoreAttempts = 0;

    processedNames.add(leadName);
    const result = await processLead(page, actionsButton, options.dryRun);
    results.push(result);

    if (result.outcome === "sent" || result.outcome === "dry-run") {
      sentCount += 1;
      log(
        `${result.outcome === "dry-run" ? "Would send" : "Sent"} invitation to ${result.leadName}`,
      );
    } else if (result.outcome === "skipped") {
      log(`Skipped ${result.leadName}: ${result.reason}`);
    } else if (result.outcome === "stopped") {
      stoppedEarly = true;
      stopReason = result.reason;
      log(`Stopped on ${result.leadName}: ${result.reason}`);
      break;
    }

    const blocker = await detectBlockers(page);
    if (blocker) {
      stoppedEarly = true;
      stopReason = blocker;
      log(`Stopped: LinkedIn restriction detected (${blocker})`);
      break;
    }

    if (sentCount < options.batch) {
      await humanSleep(700, 2200);
    }
  }

  printSummary(results, sentCount, stoppedEarly, stopReason);

  if (stoppedEarly) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

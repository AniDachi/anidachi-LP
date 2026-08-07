import type { FriendGroup, FriendListItem, RecentPerson, SocialDirectory } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopupPeoplePanel } from "../src/popup-people-panel";

const NOW = "2026-08-07T12:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PopupPeoplePanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("defaults to Friends and exposes only Friends and Groups modes", async () => {
    const view = await renderPanel({ directory: directory({ friends: [friend("friend", "friendship", "Friend", "accepted")] }) });

    const tabs = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(["Friends", "Groups"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(view.container.textContent).toContain("Friend");
    expect(view.container.textContent).not.toContain("New group");

    await unmount(view.root);
  });

  it("hides the recent section when there are no eligible people", async () => {
    const view = await renderPanel({ directory: directory() });

    expect(view.container.textContent).not.toContain("Watched with recently");
    expect(view.container.textContent).toContain("No friends yet.");

    await unmount(view.root);
  });

  it("renders one Add friend action for each recent person", async () => {
    const onAddFriend = vi.fn();
    const view = await renderPanel({
      directory: directory({ recentPeople: [recent("recent-a", "Recent A"), recent("recent-b", "Recent B")] }),
      onAddFriend,
    });

    const addButtons = [...view.container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (button) => button.textContent?.trim() === "Add friend",
    );
    expect(addButtons).toHaveLength(2);
    await click(addButtons[0]!);
    expect(onAddFriend).toHaveBeenCalledWith("recent-a");

    await unmount(view.root);
  });

  it("shows quick group creation and read-only summaries without group editors", async () => {
    const onCreateGroup = vi.fn();
    const view = await renderPanel({
      directory: directory({ groups: [group("group", null, "Friday crew", ["A", "B"])] }),
      onCreateGroup,
    });

    await click(getButton(view.container, "Groups"));
    expect(view.container.textContent).toContain("Friday crew");
    expect(view.container.textContent).toContain("2 members");
    expect(getButton(view.container, "Create group")).not.toBeNull();
    expect(view.container.querySelector('[aria-label^="Rename"]')).toBeNull();
    expect(view.container.querySelector('[aria-label^="Archive"]')).toBeNull();
    expect(view.container.querySelector("select")).toBeNull();

    const input = view.container.querySelector<HTMLInputElement>('input[name="group-name"]');
    if (!input) throw new Error("Group name input not found");
    await act(async () => {
      input.value = "Weekend";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onCreateGroup).toHaveBeenCalledWith("Weekend");

    await unmount(view.root);
  });

  it("keeps the dashboard command available in every explicit state", async () => {
    for (const props of [
      { status: "signed-out" as const, directory: null },
      { status: "loading" as const, directory: null },
      { status: "error" as const, directory: null, errorMessage: "Could not load people." },
      { status: "ready" as const, directory: directory(), isStale: true },
    ]) {
      const view = await renderPanel(props);
      expect(getButton(view.container, "Open dashboard")).not.toBeNull();
      await unmount(view.root);
    }
  });

  it("keeps signed-out, loading, error, stale, and empty presentation states explicit", async () => {
    const signedOut = await renderPanel({ status: "signed-out", directory: null });
    expect(signedOut.container.querySelector('[data-state="signed-out"]')?.textContent).toContain("Sign in to see your people.");
    await unmount(signedOut.root);

    const loading = await renderPanel({ status: "loading", directory: null });
    expect(loading.container.querySelector('[data-state="loading"]')?.textContent).toContain("Loading people...");
    await unmount(loading.root);

    const error = await renderPanel({ status: "error", directory: null, errorMessage: "Could not load people." });
    expect(error.container.querySelector('[data-state="error"]')?.textContent).toContain("Could not load people.");
    expect(getButton(error.container, "Retry")).not.toBeNull();
    await unmount(error.root);

    const cachedError = await renderPanel({ status: "error", directory: directory(), errorMessage: "Could not refresh people." });
    expect(cachedError.container.querySelector('[data-state="error"]')?.textContent).toContain("Could not refresh people.");
    expect(getButton(cachedError.container, "Retry")).not.toBeNull();
    await unmount(cachedError.root);

    const stale = await renderPanel({ status: "ready", directory: directory(), isStale: true });
    expect(stale.container.querySelector('[data-state="stale"]')?.textContent).toContain("Showing saved people while we reconnect.");
    expect(stale.container.querySelector('[data-state="empty"]')?.textContent).toContain("No friends yet.");
    await unmount(stale.root);
  });
});

type PanelProps = Partial<React.ComponentProps<typeof PopupPeoplePanel>>;

type RenderedView = {
  container: HTMLDivElement;
  root: Root;
};

async function renderPanel(props: PanelProps = {}): Promise<RenderedView> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PopupPeoplePanel
        directory={directory()}
        errorMessage="Unable to load people."
        isStale={false}
        onAddFriend={vi.fn()}
        onCreateGroup={vi.fn()}
        onOpenDashboard={vi.fn()}
        onRefresh={vi.fn()}
        onSignIn={vi.fn()}
        status="ready"
        {...props}
      />,
    );
  });
  return { container, root };
}

function directory(overrides: Partial<SocialDirectory> = {}): SocialDirectory {
  return {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    groups: [],
    recentPeople: [],
    ...overrides,
  };
}

function friend(
  userId: string,
  friendshipId: string,
  displayName = userId,
  status: FriendListItem["status"] = "pending",
): FriendListItem {
  return {
    friendshipId,
    user: { userId, handle: null, displayName, avatarUrl: null },
    status,
    direction: status === "accepted" ? "mutual" : "incoming",
    requestedAt: NOW,
    respondedAt: status === "accepted" ? NOW : null,
    updatedAt: NOW,
  };
}

function group(id: string, archivedAt: string | null, name: string, memberNames: string[]): FriendGroup {
  return {
    id,
    name,
    archivedAt,
    createdAt: NOW,
    updatedAt: NOW,
    members: memberNames.map((displayName, index) => ({
      user: { userId: `${id}-member-${index}`, handle: null, displayName, avatarUrl: null },
      addedAt: NOW,
    })),
  };
}

function recent(userId: string, displayName = userId): RecentPerson {
  return {
    user: { userId, handle: null, displayName, avatarUrl: null },
    lastWatchedAt: NOW,
    sharedRoomCount: 1,
  };
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === name || candidate.textContent?.trim() === name,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  return button;
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}

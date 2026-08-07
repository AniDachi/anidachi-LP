import type { FriendGroup, FriendListItem, RecentPerson, SocialDirectory } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PopupPeoplePanel,
  type PopupPeoplePanelProps,
  type PopupPeoplePresentationState,
} from "../src/popup-people-panel";

const NOW = "2026-08-07T12:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PopupPeoplePanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("defaults to Friends and exposes only Friends and Groups modes", async () => {
    const view = await renderPanel({
      state: readyState(directory({ friends: [friend("friend", "friendship", "Friend", "accepted")] })),
    });

    const tabs = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(["Friends", "Groups"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(view.container.textContent).toContain("Friend");
    expect(view.container.textContent).not.toContain("New group");

    await unmount(view.root);
  });

  it("hides the recent section when there are no eligible people", async () => {
    const view = await renderPanel();

    expect(view.container.textContent).not.toContain("Watched with recently");
    expect(view.container.textContent).toContain("No friends yet.");

    await unmount(view.root);
  });

  it("renders one Add friend action for each recent person", async () => {
    const onAddFriend = vi.fn(async () => true);
    const view = await renderPanel({
      state: readyState(
        directory({ recentPeople: [recent("recent-a", "Recent A"), recent("recent-b", "Recent B")] }),
      ),
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
    const onCreateGroup = vi.fn(async () => true);
    const view = await renderPanel({
      state: readyState(directory({ groups: [group("group", null, "Friday crew", ["A", "B"])] })),
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
      await flushPromises();
    });
    expect(onCreateGroup).toHaveBeenCalledWith("Weekend");

    await unmount(view.root);
  });

  it("keeps the dashboard command available in every explicit state", async () => {
    for (const state of legalPresentationStates()) {
      const view = await renderPanel({ state });
      expect(getButton(view.container, "Open dashboard")).not.toBeNull();
      await unmount(view.root);
    }
  });

  it("keeps signed-out, loading, error, stale, and empty presentation states explicit", async () => {
    const signedOut = await renderPanel({ state: { status: "signed-out" } });
    expect(signedOut.container.querySelector('[data-state="signed-out"]')?.textContent).toContain("Sign in to see your people.");
    await unmount(signedOut.root);

    const loading = await renderPanel({ state: { status: "loading" } });
    expect(loading.container.querySelector('[data-state="loading"]')?.textContent).toContain("Loading people...");
    await unmount(loading.root);

    const error = await renderPanel({ state: { status: "error", errorMessage: "Could not load people." } });
    expect(error.container.querySelector('[data-state="error"]')?.textContent).toContain("Could not load people.");
    expect(getButton(error.container, "Retry")).not.toBeNull();
    await unmount(error.root);

    const cachedError = await renderPanel({
      state: { status: "stale-error", directory: directory(), errorMessage: "Could not refresh people." },
    });
    expect(cachedError.container.querySelector('[data-state="error"]')?.textContent).toContain("Could not refresh people.");
    expect(getButton(cachedError.container, "Retry")).not.toBeNull();
    await unmount(cachedError.root);

    const stale = await renderPanel({ state: { status: "stale", directory: directory() } });
    expect(stale.container.querySelector('[data-state="stale"]')?.textContent).toContain("Showing saved people while we reconnect.");
    expect(stale.container.querySelector('[data-state="empty"]')?.textContent).toContain("No friends yet.");
    await unmount(stale.root);
  });

  it("disables the keyed Add friend action while its parent reports it pending", async () => {
    const onAddFriend = vi.fn(async () => true);
    const view = await renderPanel({
      state: readyState(
        directory({ recentPeople: [recent("recent-a", "Recent A"), recent("recent-b", "Recent B")] }),
      ),
      pendingActionKey: "add-friend:recent-a",
      onAddFriend,
    });

    const buttons = [...view.container.querySelectorAll<HTMLButtonElement>(".popup-people-add-button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[0]?.textContent).toContain("Adding...");
    expect(buttons[1]?.disabled).toBe(false);
    await click(buttons[0]!);
    expect(onAddFriend).not.toHaveBeenCalled();

    await unmount(view.root);
  });

  it("disables quick creation while its keyed action is pending", async () => {
    const view = await renderPanel({ pendingActionKey: "create-group" });
    await click(getButton(view.container, "Groups"));

    const input = getGroupInput(view.container);
    const button = getButton(view.container, "Create group");
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Creating...");

    await unmount(view.root);
  });

  it("preserves a failed group name and resets it only after explicit success", async () => {
    const onCreateGroup = vi.fn<PopupPeoplePanelProps["onCreateGroup"]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const view = await renderPanel({ onCreateGroup });
    await click(getButton(view.container, "Groups"));

    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await submit(input.form!);
    expect(input.value).toBe("Weekend");

    await submit(input.form!);
    expect(input.value).toBe("");
    expect(onCreateGroup).toHaveBeenNthCalledWith(1, "Weekend");
    expect(onCreateGroup).toHaveBeenNthCalledWith(2, "Weekend");

    await unmount(view.root);
  });

  it("renders a keyed parent action notice in an aria-live region", async () => {
    const view = await renderPanel({
      actionNotice: {
        actionKey: "create-group",
        tone: "error",
        text: "Could not create group.",
      },
    });

    const liveRegion = view.container.querySelector<HTMLElement>('[aria-live="polite"]');
    expect(liveRegion?.textContent).toContain("Could not create group.");
    expect(liveRegion?.querySelector('[data-tone="error"]')).not.toBeNull();

    await unmount(view.root);
  });

  it("renders nonblank content for every legal presentation state", async () => {
    for (const state of legalPresentationStates()) {
      const view = await renderPanel({ state });
      const content = view.container.querySelector<HTMLElement>(".popup-people-content");
      expect(content?.dataset.presentationState).toBe(state.status);
      expect(content?.textContent?.trim()).not.toBe("");
      await unmount(view.root);
    }
  });
});

type PanelProps = Partial<Omit<PopupPeoplePanelProps, "state">> & {
  state?: PopupPeoplePresentationState;
};

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
        actionNotice={null}
        pendingActionKey={null}
        onAddFriend={vi.fn(async () => true)}
        onCreateGroup={vi.fn(async () => true)}
        onOpenDashboard={vi.fn()}
        onRefresh={vi.fn()}
        onSignIn={vi.fn()}
        state={readyState(directory())}
        {...props}
      />,
    );
  });
  return { container, root };
}

function readyState(directoryValue: SocialDirectory): PopupPeoplePresentationState {
  return { status: "ready", directory: directoryValue };
}

function legalPresentationStates(): PopupPeoplePresentationState[] {
  return [
    { status: "signed-out" },
    { status: "loading" },
    { status: "error", errorMessage: "Could not load people." },
    { status: "ready", directory: directory() },
    { status: "stale", directory: directory() },
    { status: "stale-error", directory: directory(), errorMessage: "Could not refresh people." },
  ];
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

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
  });
}

function getGroupInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[name="group-name"]');
  if (!input) throw new Error("Group name input not found");
  return input;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

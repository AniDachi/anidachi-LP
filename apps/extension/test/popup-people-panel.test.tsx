import type {
  AccountInboxResponse,
  FriendGroup,
  FriendListItem,
  RecentPerson,
  RoomInvite,
  RoomInvitesResponse,
  SocialDirectory,
  SocialSnapshot,
} from "@anidachi/protocol";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedAccountInboxForUser,
  publishAccountInboxForUser,
} from "../src/account-inbox-cache";
import { listAccountInbox, markAccountInboxItemsSeen } from "../src/account-inbox-client";
import type { AccountOwnedState } from "../src/account-sync";
import {
  getCachedExtensionSession,
  requestCurrentExtensionSession,
  requestSilentWebsiteSignIn,
  requestWebsiteSignIn,
} from "../src/auth-client";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import {
  mapSocialStateToPeoplePresentation,
  PopupApp,
  PopupInboxPanel,
  PopupNavigation,
  popupInboxBadgeCount,
} from "../src/popup-app";
import { buildPopupInboxModel } from "../src/popup-people-model";
import {
  PopupPeoplePanel,
  type PopupPeoplePanelProps,
  type PopupPeoplePresentationState,
} from "../src/popup-people-panel";
import {
  acceptFriendRequest,
  saveFriendGroup,
  createFriendInviteLink,
  removeFriend,
  archiveFriendGroup,
  declineFriendRequest,
  listRoomInvites,
  listSocialDirectory,
} from "../src/social-client";
import {
  getCachedSocialSnapshotForUser,
  setCachedSocialSnapshotForUser,
} from "../src/social-snapshot-cache";

vi.mock("../src/auth-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/auth-client")>()),
  getCachedExtensionSession: vi.fn(),
  requestCurrentExtensionSession: vi.fn(),
  requestSilentWebsiteSignIn: vi.fn(),
  requestWebsiteSignIn: vi.fn(),
}));

vi.mock("../src/account-inbox-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/account-inbox-client")>()),
  listAccountInbox: vi.fn(),
  markAccountInboxItemsSeen: vi.fn(),
}));

vi.mock("../src/account-inbox-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/account-inbox-cache")>()),
  getCachedAccountInboxForUser: vi.fn(),
  publishAccountInboxForUser: vi.fn(),
  subscribeToAccountInboxForUser: vi.fn(() => () => {}),
}));

vi.mock("../src/social-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/social-client")>()),
  acceptFriendRequest: vi.fn(),
  saveFriendGroup: vi.fn(),
  createFriendInviteLink: vi.fn(),
  removeFriend: vi.fn(),
  archiveFriendGroup: vi.fn(),
  declineFriendRequest: vi.fn(),
  listRoomInvites: vi.fn(),
  listSocialDirectory: vi.fn(),
}));

vi.mock("../src/social-snapshot-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/social-snapshot-cache")>()),
  getCachedSocialSnapshotForUser: vi.fn(),
  setCachedSocialSnapshotForUser: vi.fn(),
}));

vi.mock("../src/popup-watch-history", () => ({
  PopupWatchHistoryPanel: ({ refreshSignal = 0 }: { refreshSignal?: number }) => (
    <div aria-label="Watch History" data-refresh-signal={refreshSignal} />
  ),
}));

const NOW = "2026-08-07T12:00:00.000Z";
const VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const RECENT_USER_ID = "00000000-0000-4000-8000-000000000002";
const INCOMING_USER_ID = "00000000-0000-4000-8000-000000000003";
const INCOMING_FRIENDSHIP_ID = "00000000-0000-4000-8000-000000000004";
const INBOX_INVITE_ID = "00000000-0000-4000-8000-000000000005";
const MISSED_INVITE_ID = "00000000-0000-4000-8000-000000000006";
const TOKENS: ExtensionAuthTokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: {
    id: VIEWER_ID,
    email: "viewer@example.com",
    displayName: "Viewer",
    avatarUrl: null,
    plan: "plus",
  },
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PopupPeoplePanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("defaults to Friends and exposes only Friends and Groups modes", async () => {
    const view = await renderPanel({
      state: readyState(
        directory({
          friends: [friend("friend", "friendship", "Friend", "accepted")],
        }),
      ),
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
    expect(view.container.textContent).toContain("Invite a friend with a link to get started.");

    await unmount(view.root);
  });

  it("uses deliberate one-time links instead of recent-person requests", async () => {
    const onCreateInviteLink = vi.fn(async () => ({ url: "https://staging.anidachi.app/friend/invite/example", expiresAt: "2099-01-01T00:00:00Z" }));
    const view = await renderPanel({ state: readyState(directory({ recentPeople: [recent("recent-a", "Recent A")] })), onCreateInviteLink });
    expect(view.container.textContent).not.toContain("Recent A");
    await click(getButton(view.container, "Invite"));
    expect(onCreateInviteLink).not.toHaveBeenCalled();
    await click(getButton(view.container, "Create link"));
    expect(onCreateInviteLink).toHaveBeenCalledTimes(1);
    const input = view.container.querySelector<HTMLInputElement>('input[readonly]')!;
    expect(input.value).toContain("/friend/invite/example");
    await click(getButton(view.container, "Close"));
    await click(getButton(view.container, "Invite"));
    expect(view.container.querySelector<HTMLInputElement>('input[readonly]')?.value).toBe(input.value);
    expect(onCreateInviteLink).toHaveBeenCalledTimes(1);
    await unmount(view.root);
  });

  it("stages a group name and selected friends in one atomic save", async () => {
    const onSaveGroup = vi.fn(async () => true);
    const view = await renderPanel({ state: readyState(directory({ friends: [friend(RECENT_USER_ID, "friendship", "Ren", "accepted")], groups: [group("group", null, "Friday crew", ["A", "B"])] })), onSaveGroup });
    await click(getButton(view.container, "Groups"));
    expect(view.container.textContent).toContain("Friday crew");
    expect(view.container.querySelector('input[name="group-name"]')).toBeNull();
    await click(getButton(view.container, "New group"));
    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await act(async () => view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(onSaveGroup).not.toHaveBeenCalled();
    await submit(input.form!);
    expect(onSaveGroup).toHaveBeenCalledWith({ groupId: expect.any(String), name: "Weekend", memberIds: [RECENT_USER_ID], create: true, expectedUpdatedAt: null });
    expect(view.container.querySelector("dialog")).toBeNull();
    await unmount(view.root);
  });

  it("keeps the dashboard command available in every explicit state", async () => {
    for (const state of legalPresentationStates()) {
      const view = await renderPanel({ state });
      expect(getButton(view.container, "Manage on website")).not.toBeNull();
      await unmount(view.root);
    }
  });

  it("keeps signed-out, loading, error, stale, and empty presentation states explicit", async () => {
    const signedOut = await renderPanel({ state: { status: "signed-out" } });
    expect(signedOut.container.querySelector('[data-state="signed-out"]')?.textContent).toContain(
      "Sign in to see your people.",
    );
    await unmount(signedOut.root);

    const loading = await renderPanel({ state: { status: "loading" } });
    expect(loading.container.querySelector('[data-state="loading"]')?.textContent).toContain(
      "Loading people...",
    );
    await unmount(loading.root);

    const error = await renderPanel({
      state: { status: "error", errorMessage: "Could not load people." },
    });
    expect(error.container.querySelector('[data-state="error"]')?.textContent).toContain(
      "Could not load people.",
    );
    expect(getButton(error.container, "Retry")).not.toBeNull();
    await unmount(error.root);

    const cachedError = await renderPanel({
      state: {
        status: "stale-error",
        directory: directory(),
        errorMessage: "Could not refresh people.",
      },
    });
    expect(cachedError.container.querySelector('[data-state="error"]')?.textContent).toContain(
      "Could not refresh people.",
    );
    expect(getButton(cachedError.container, "Retry")).not.toBeNull();
    await unmount(cachedError.root);

    const stale = await renderPanel({
      state: { status: "stale", directory: directory() },
    });
    expect(stale.container.querySelector('[data-state="stale"]')?.textContent).toContain(
      "Showing saved people while we reconnect.",
    );
    expect(stale.container.querySelector('[data-state="empty"]')?.textContent).toContain(
      "Invite a friend with a link to get started.",
    );
    await unmount(stale.root);
  });

  it("disables new actions while another social mutation is pending", async () => {
    const view = await renderPanel({ pendingActionKey: "save-group:example" });
    expect(getButton(view.container, "Invite").disabled).toBe(true);
    expect(getButton(view.container, "Refresh people").disabled).toBe(true);
    await click(getButton(view.container, "Groups"));
    expect(getButton(view.container, "New group").disabled).toBe(true);
    await unmount(view.root);
  });

  it("preserves a failed group draft and request ID until explicit success", async () => {
    const onSaveGroup = vi.fn<PopupPeoplePanelProps["onSaveGroup"]>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = await renderPanel({ onSaveGroup });
    await click(getButton(view.container, "Groups"));
    await click(getButton(view.container, "New group"));
    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await submit(input.form!);
    expect(input.value).toBe("Weekend");
    await submit(input.form!);
    expect(onSaveGroup).toHaveBeenCalledTimes(2);
    expect(onSaveGroup.mock.calls[1]?.[0]).toEqual(onSaveGroup.mock.calls[0]?.[0]);
    expect(view.container.querySelector("dialog")).toBeNull();
    await unmount(view.root);
  });

  it("retains selected friends while searching and confirms discarding a draft", async () => {
    const onSaveGroup = vi.fn(async () => true);
    const view = await renderPanel({ state: readyState(directory({ friends: [friend("ren", "f1", "Ren", "accepted"), friend("mei", "f2", "Mei", "accepted")] })), onSaveGroup });
    await click(getButton(view.container, "Groups")); await click(getButton(view.container, "New group"));
    const box = view.container.querySelector<HTMLInputElement>('input[aria-label="Ren"]')!;
    await act(async () => box.click());
    await setInputValue(view.container.querySelector<HTMLInputElement>('input[aria-label="Search group friends"]')!, "Mei");
    expect(view.container.querySelector('input[aria-label="Ren"]')).toBeNull();
    expect(view.container.textContent).toContain("1 / 100");
    await click(getButton(view.container, "Cancel"));
    expect(view.container.textContent).toContain("Discard unsaved changes?");
    await click(getButton(view.container, "Keep editing"));
    expect(view.container.textContent).toContain("1 / 100");
    await click(getButton(view.container, "Cancel")); await click(getButton(view.container, "Discard"));
    expect(onSaveGroup).not.toHaveBeenCalled(); expect(view.container.querySelector("dialog")).toBeNull();
    await unmount(view.root);
  });

  it("sends the captured group revision when editing", async () => {
    const onSaveGroup = vi.fn(async () => true);
    const view = await renderPanel({ state: readyState(directory({ groups: [group(INBOX_INVITE_ID, null, "Anime night", [])] })), onSaveGroup });
    await click(getButton(view.container, "Groups")); await click(getButton(view.container, "Edit Anime night"));
    const input = getGroupInput(view.container); await setInputValue(input, "Friday"); await submit(input.form!);
    expect(onSaveGroup).toHaveBeenCalledWith({ groupId: INBOX_INVITE_ID, name: "Friday", memberIds: [], create: false, expectedUpdatedAt: NOW });
    await unmount(view.root);
  });

  it("never removes a friend before confirmation and preserves a failed confirmation", async () => {
    const onRemoveFriend = vi.fn(async () => false);
    const view = await renderPanel({ state: readyState(directory({ friends: [friend(RECENT_USER_ID, "f1", "Ren", "accepted")] })), onRemoveFriend });
    await click(getButton(view.container, "Remove friend"));
    expect(onRemoveFriend).not.toHaveBeenCalled();
    const dialog = view.container.querySelector("dialog")!;
    await click(getButton(dialog, "Remove friend"));
    expect(onRemoveFriend).toHaveBeenCalledWith(RECENT_USER_ID);
    expect(view.container.querySelector("dialog")).toBe(dialog);
    await click(getButton(dialog, "Cancel"));
    expect(view.container.textContent).toContain("Ren");
    await unmount(view.root);
  });

  it("preserves the generated link when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const view = await renderPanel({ onCreateInviteLink: vi.fn(async () => ({ url: "https://staging.anidachi.app/friend/invite/example", expiresAt: "2099-01-01T00:00:00Z" })) });
    await click(getButton(view.container, "Invite")); await click(getButton(view.container, "Create link"));
    await click(getButton(view.container, "Copy link"));
    expect(view.container.textContent).toContain("copy it manually");
    expect(view.container.querySelector<HTMLInputElement>('input[readonly]')?.value).toContain("/friend/invite/example");
    await unmount(view.root);
  });

  it("returns keyboard focus to the same friend menu on Escape and dialog cancellation", async () => {
    const view = await renderPanel({ state: readyState(directory({ friends: [friend(RECENT_USER_ID, "f1", "Ren", "accepted"), friend(INCOMING_USER_ID, "f2", "Mei", "accepted")] })) });
    const menu = view.container.querySelector<HTMLDetailsElement>("details")!;
    const summary = menu.querySelector("summary")!;
    const remove = getButton(menu, "Remove friend");
    await act(async () => { menu.open = true; remove.focus(); remove.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(menu.open).toBe(false); expect(document.activeElement).toBe(summary);
    await act(async () => { menu.open = true; remove.focus(); }); await click(remove);
    await click(getButton(view.container.querySelector("dialog")!, "Cancel"));
    expect(document.activeElement).toBe(summary);
    await unmount(view.root);
  });

  it("renders a keyed parent action notice in an aria-live region", async () => {
    const view = await renderPanel({
      actionNotice: {
        actionKey: "save-group:example",
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

describe("Popup People integration boundaries", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("maps every account-owned social state to the approved People presentation state", () => {
    const snapshot = socialSnapshot();
    const cases: Array<{
      state: AccountOwnedState<SocialSnapshot>;
      expected: PopupPeoplePresentationState;
    }> = [
      {
        state: {
          status: "signed-out",
          ownerUserId: null,
          data: null,
          error: null,
        },
        expected: { status: "signed-out" },
      },
      {
        state: {
          status: "loading",
          ownerUserId: "viewer-1",
          data: null,
          error: null,
        },
        expected: { status: "loading" },
      },
      {
        state: {
          status: "loading",
          ownerUserId: "viewer-1",
          data: snapshot,
          error: null,
        },
        expected: { status: "stale", directory: snapshot.directory },
      },
      {
        state: {
          status: "error",
          ownerUserId: "viewer-1",
          data: null,
          error: "Offline",
        },
        expected: { status: "error", errorMessage: "Offline" },
      },
      {
        state: {
          status: "error",
          ownerUserId: "viewer-1",
          data: snapshot,
          error: "Offline",
        },
        expected: {
          status: "stale-error",
          directory: snapshot.directory,
          errorMessage: "Offline",
        },
      },
      {
        state: {
          status: "ready",
          ownerUserId: "viewer-1",
          data: snapshot,
          error: null,
        },
        expected: { status: "ready", directory: snapshot.directory },
      },
    ];

    for (const testCase of cases) {
      expect(mapSocialStateToPeoplePresentation(testCase.state)).toEqual(testCase.expected);
    }
  });

  it("renders clean Watch, People, and Inbox navigation without counters", async () => {
    const onSelect = vi.fn();
    const view = await renderElement(<PopupNavigation activeTab="resources" onSelect={onSelect} />);

    const tabs = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.querySelector(".popup-tab-label")?.textContent)).toEqual([
      "Watch",
      "People",
      "Inbox",
    ]);
    expect(view.container.querySelector(".popup-tab-count")).toBeNull();
    expect(view.container.querySelector(".popup-tabs svg")).toBeNull();

    await click(tabs[2]!);
    expect(onSelect).toHaveBeenCalledWith("inbox");
    await unmount(view.root);
  });

  it("renders incoming friend requests before room invites without an outgoing subsection", async () => {
    const onAcceptFriendRequest = vi.fn();
    const onDeclineFriendRequest = vi.fn();
    const onAcceptInvite = vi.fn();
    const onDeclineInvite = vi.fn();
    const inbox = accountInbox([
      inboxFriendRequest(
        INCOMING_FRIENDSHIP_ID,
        INCOMING_USER_ID,
        "A very long incoming display name",
        NOW,
      ),
      inboxRoomInvite(INBOX_INVITE_ID, "active", NOW),
      inboxRoomInvite(MISSED_INVITE_ID, "missed", NOW),
    ]);
    const view = await renderElement(
      <PopupInboxPanel
        busyFriendRequestActionKey={null}
        busyInviteId={null}
        onAcceptFriendRequest={onAcceptFriendRequest}
        onAcceptInvite={onAcceptInvite}
        onDeclineFriendRequest={onDeclineFriendRequest}
        onDeclineInvite={onDeclineInvite}
        onOpenDashboard={vi.fn()}
        onRefresh={vi.fn()}
        onSignIn={vi.fn()}
        model={buildPopupInboxModel(inbox)}
        state={{
          status: "ready",
          ownerUserId: VIEWER_ID,
          data: inbox,
          error: null,
        }}
      />,
    );

    const headings = [...view.container.querySelectorAll(".inbox-heading")].map((heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toEqual(["Friend requests1", "Room invites1", "Missed1"]);
    expect(view.container.textContent).not.toContain("Outgoing Person");
    expect(view.container.textContent).not.toContain("Outgoing requests");

    await click(
      getButton(view.container, "Accept friend request from A very long incoming display name"),
    );
    await click(
      getButton(view.container, "Decline friend request from A very long incoming display name"),
    );
    await click(getButton(view.container, "Join room invite from Room Host"));
    await click(getButton(view.container, "Decline room invite from Room Host"));
    expect(onAcceptFriendRequest).toHaveBeenCalledWith(INCOMING_FRIENDSHIP_ID);
    expect(onDeclineFriendRequest).toHaveBeenCalledWith(INCOMING_FRIENDSHIP_ID);
    expect(onAcceptInvite).toHaveBeenCalledWith(INBOX_INVITE_ID);
    expect(onDeclineInvite).toHaveBeenCalledWith(INBOX_INVITE_ID);
    expect(view.container.textContent).toContain("Missed invite");

    await unmount(view.root);
  });

  it("uses the canonical unseen count for the navigation badge", async () => {
    const inbox = accountInbox([
      inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Incoming", NOW),
      inboxRoomInvite(INBOX_INVITE_ID, "active", NOW),
    ]);
    const model = buildPopupInboxModel(inbox);
    const view = await renderElement(
      <PopupInboxPanel
        busyFriendRequestActionKey={null}
        busyInviteId={null}
        model={model}
        onAcceptFriendRequest={vi.fn()}
        onAcceptInvite={vi.fn()}
        onDeclineFriendRequest={vi.fn()}
        onDeclineInvite={vi.fn()}
        onOpenDashboard={vi.fn()}
        onRefresh={vi.fn()}
        onSignIn={vi.fn()}
        state={{
          status: "ready",
          ownerUserId: VIEWER_ID,
          data: inbox,
          error: null,
        }}
      />,
    );

    expect(popupInboxBadgeCount(model)).toBe(0);
    expect(view.container.querySelectorAll(".inbox-friend")).toHaveLength(1);
    expect(view.container.querySelectorAll(".inbox-room")).toHaveLength(1);
    await unmount(view.root);
  });

  it("marks cached inbox data stale and disables actions until refresh settles", async () => {
    const inbox = accountInbox([
      inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Incoming", NOW),
      inboxRoomInvite(INBOX_INVITE_ID, "active", NOW),
    ]);
    const view = await renderElement(
      <PopupInboxPanel
        busyFriendRequestActionKey={null}
        busyInviteId={null}
        model={buildPopupInboxModel(inbox)}
        onAcceptFriendRequest={vi.fn()}
        onAcceptInvite={vi.fn()}
        onDeclineFriendRequest={vi.fn()}
        onDeclineInvite={vi.fn()}
        onOpenDashboard={vi.fn()}
        onRefresh={vi.fn()}
        onSignIn={vi.fn()}
        state={{
          status: "loading",
          ownerUserId: VIEWER_ID,
          data: inbox,
          error: null,
        }}
      />,
    );

    expect(view.container.querySelector('[data-state="stale"]')?.textContent).toContain(
      "Refreshing inbox",
    );
    for (const button of view.container.querySelectorAll<HTMLButtonElement>(
      ".inbox-actions button",
    )) {
      expect(button.disabled).toBe(true);
    }
    await unmount(view.root);
  });
});

describe("PopupApp social mutations", () => {
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    installPopupChrome();
    vi.mocked(getCachedExtensionSession).mockResolvedValue(TOKENS);
    vi.mocked(requestCurrentExtensionSession).mockResolvedValue(TOKENS);
    vi.mocked(requestSilentWebsiteSignIn).mockResolvedValue(null);
    vi.mocked(requestWebsiteSignIn).mockResolvedValue(TOKENS);
    vi.mocked(getCachedAccountInboxForUser).mockResolvedValue(null);
    vi.mocked(publishAccountInboxForUser).mockImplementation(async (_userId, inbox) => inbox);
    vi.mocked(listAccountInbox).mockResolvedValue(accountInbox([]));
    vi.mocked(markAccountInboxItemsSeen).mockImplementation(async (_accessToken, _items) =>
      accountInbox([], {
        actionable: 0,
        unseen: 0,
        activeRoomInvites: 0,
        pendingFriendRequests: 0,
      }),
    );
    vi.mocked(getCachedSocialSnapshotForUser).mockResolvedValue(null);
    vi.mocked(setCachedSocialSnapshotForUser).mockResolvedValue(undefined);
    vi.mocked(listRoomInvites).mockResolvedValue(roomInvites([]));
    vi.mocked(createFriendInviteLink).mockResolvedValue({ url: "http://localhost:3003/friend/invite/example", expiresAt: "2099-01-01T00:00:00Z" });
    vi.mocked(saveFriendGroup).mockResolvedValue(group("new-group", null, "Weekend", []));
    vi.mocked(removeFriend).mockResolvedValue(undefined);
    vi.mocked(archiveFriendGroup).mockResolvedValue(undefined);
    vi.mocked(acceptFriendRequest).mockResolvedValue(
      friend(INCOMING_USER_ID, INCOMING_FRIENDSHIP_ID, "Incoming", "accepted"),
    );
    vi.mocked(declineFriendRequest).mockResolvedValue(
      friend(INCOMING_USER_ID, INCOMING_FRIENDSHIP_ID, "Incoming", "declined"),
    );
  });

  afterEach(async () => {
    if (root) await unmount(root);
    root = null;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("shows the active account identity in the compact Popup header", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    const view = await renderPopupApp();
    root = view.root;

    const profileCopy = view.container.querySelector(".popup-profile-copy");
    expect(profileCopy?.textContent).toContain("Viewer");
    expect(profileCopy?.textContent).toContain("Plus");
    expect(profileCopy?.textContent).not.toContain("AniDachi");
    expect(view.container.querySelectorAll(".popup-header-actions button")).toHaveLength(1);
    expect(
      view.container.querySelector(".popup-header-actions button")?.getAttribute("aria-label"),
    ).toBe("Open settings");
  });

  it("does not refetch or remount Watch History when the initial social sync finishes", async () => {
    let resolveDirectory: ((value: SocialDirectory) => void) | null = null;
    vi.mocked(listSocialDirectory).mockImplementation(() =>
      new Promise<SocialDirectory>((resolve) => {
        resolveDirectory = resolve;
      })
    );
    const view = await renderPopupApp();
    root = view.root;
    const visiblePanel = view.container.querySelector('[aria-label="Watch History"]');
    expect(visiblePanel?.getAttribute("data-refresh-signal")).toBe("0");

    await act(async () => {
      resolveDirectory?.(directory());
      await Promise.resolve();
    });

    await waitFor(() => expect(setCachedSocialSnapshotForUser).toHaveBeenCalled());
    expect(visiblePanel?.getAttribute("data-refresh-signal")).toBe("0");
    expect(view.container.querySelector('[aria-label="Watch History"]')).toBe(visiblePanel);
  });

  it("refreshes history once when the same owner's credentials change, not when their profile changes", async () => {
    const view = await renderPopupApp();
    root = view.root;
    const panel = view.container.querySelector('[aria-label="Watch History"]');
    const listeners = vi.mocked(chrome.storage.onChanged.addListener).mock.calls.map(([listener]) => listener);
    const publish = async (oldValue: ExtensionAuthTokens, newValue: ExtensionAuthTokens) => {
      await act(async () => {
        for (const listener of listeners) listener({ authTokens: { oldValue, newValue } }, "local");
      });
    };
    const refreshed = { ...TOKENS, accessToken: "access-2", refreshToken: "refresh-2" };
    await publish(TOKENS, refreshed);
    expect(panel?.getAttribute("data-refresh-signal")).toBe("1");
    expect(view.container.querySelector('[aria-label="Watch History"]')).toBe(panel);
    await publish(refreshed, { ...refreshed, user: { ...refreshed.user, displayName: "Updated" } });
    expect(panel?.getAttribute("data-refresh-signal")).toBe("1");
    await publish(refreshed, { ...refreshed, accessToken: "access-3" });
    expect(panel?.getAttribute("data-refresh-signal")).toBe("2");
  });

  it("refreshes history when startup replaces cached credentials before social loading finishes", async () => {
    let resolveSession!: (value: ExtensionAuthTokens) => void;
    vi.mocked(requestCurrentExtensionSession).mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    vi.mocked(listSocialDirectory).mockImplementation(() => new Promise(() => {}));
    const view = await renderElement(<PopupApp />);
    root = view.root;
    await waitFor(() => expect(resolveSession).toBeTypeOf("function"));
    const panel = view.container.querySelector('[aria-label="Watch History"]');
    expect(panel?.getAttribute("data-refresh-signal")).toBe("0");
    await act(async () => {
      resolveSession({ ...TOKENS, accessToken: "renewed-access", refreshToken: "renewed-refresh" });
    });
    expect(panel?.getAttribute("data-refresh-signal")).toBe("1");
    expect(view.container.querySelector('[aria-label="Watch History"]')).toBe(panel);
  });

  it("creates a friend link for the captured owner without refreshing history or social data", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    const view = await renderPopupApp(); root = view.root;
    await click(await findButton(view.container, "People")); await click(await findButton(view.container, "Invite"));
    expect(createFriendInviteLink).not.toHaveBeenCalled();
    await click(getButton(view.container, "Create link"));
    expect(createFriendInviteLink).toHaveBeenCalledWith("access-1", VIEWER_ID);
    expect(listSocialDirectory).toHaveBeenCalledTimes(1);
  });

  it("quick-creates one group and refreshes the canonical social snapshot", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "People"));
    await click(await findButton(view.container, "Groups"));
    await click(getButton(view.container, "New group"));
    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await submit(input.form!);
    await waitFor(() =>
      expect(saveFriendGroup).toHaveBeenCalledWith("access-1", VIEWER_ID, {
        name: "Weekend",
        groupId: expect.any(String),
        memberIds: [], create: true, expectedUpdatedAt: null,
      }),
    );
    await waitFor(() => expect(listSocialDirectory).toHaveBeenCalledTimes(2));
  });

  it("acknowledges a committed group when refresh fails and clears the form", async () => {
    vi.mocked(listSocialDirectory)
      .mockResolvedValueOnce(directory())
      .mockRejectedValueOnce(new Error("Refresh offline"));
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "People"));
    await click(await findButton(view.container, "Groups"));
    await click(getButton(view.container, "New group"));
    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await submit(input.form!);

    await waitFor(() => expect(view.container.querySelector("dialog")).toBeNull());
    await waitFor(() =>
      expect(view.container.textContent).toContain(
        "Group created. Latest data could not be refreshed.",
      ),
    );
  });

  it("serializes concurrent Popup social mutations with a synchronous mutex", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    let finishCreate!: (value: FriendGroup) => void;
    vi.mocked(saveFriendGroup).mockImplementation(
      () =>
        new Promise<FriendGroup>((resolve) => {
          finishCreate = resolve;
        }),
    );
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "People"));
    await click(await findButton(view.container, "Groups"));
    await click(getButton(view.container, "New group"));
    const input = getGroupInput(view.container);
    await setInputValue(input, "Weekend");
    await act(async () => {
      input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(saveFriendGroup).toHaveBeenCalledTimes(1);
    finishCreate(group("new-group", null, "Weekend", []));
    await waitFor(() => expect(listSocialDirectory).toHaveBeenCalledTimes(2));
  });

  it("refreshes a rejected edit without losing the draft and reopens the latest revision", async () => {
    const original = group(INBOX_INVITE_ID, null, "Friday", []);
    const latest = { ...original, name: "Changed elsewhere", updatedAt: "2026-09-11T16:00:00.000Z" };
    vi.mocked(listSocialDirectory).mockResolvedValueOnce(directory({ groups: [original] })).mockResolvedValue(directory({ groups: [latest] }));
    vi.mocked(saveFriendGroup).mockRejectedValueOnce(new Error("This group changed elsewhere. Reopen it to load the latest version.")).mockResolvedValue(latest);
    const view = await renderPopupApp(); root = view.root;
    await click(await findButton(view.container, "People")); await click(getButton(view.container, "Groups"));
    await click(getButton(view.container, "Edit Friday"));
    const input = getGroupInput(view.container); await setInputValue(input, "My draft"); await submit(input.form!);
    expect(input.value).toBe("My draft"); expect(listSocialDirectory).toHaveBeenCalledTimes(2);
    await click(getButton(view.container, "Cancel")); await click(getButton(view.container, "Discard"));
    await click(getButton(view.container, "Edit Changed elsewhere"));
    const reopened = getGroupInput(view.container); expect(reopened.value).toBe("Changed elsewhere");
    await setInputValue(reopened, "Updated draft"); await submit(reopened.form!);
    expect(saveFriendGroup).toHaveBeenLastCalledWith("access-1", VIEWER_ID, expect.objectContaining({ expectedUpdatedAt: latest.updatedAt }));
  });

  it("discards a late invitation link after switching accounts", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    let finishLink!: (value: { url: string; expiresAt: string }) => void;
    vi.mocked(createFriendInviteLink).mockImplementation(() => new Promise(resolve => { finishLink = resolve; }));
    const view = await renderPopupApp(); root = view.root;
    await click(await findButton(view.container, "People")); await click(getButton(view.container, "Invite")); await click(getButton(view.container, "Create link"));
    const other = { ...TOKENS, accessToken: "other-access", user: { ...TOKENS.user, id: RECENT_USER_ID, displayName: "Other account" } };
    const listeners = vi.mocked(chrome.storage.onChanged.addListener).mock.calls.map(([listener]) => listener);
    vi.mocked(requestCurrentExtensionSession).mockResolvedValue(other);
    await act(async () => { for (const listener of listeners) listener({ authTokens: { oldValue: TOKENS, newValue: other } }, "local"); });
    await act(async () => finishLink({ url: "https://staging.anidachi.app/friend/invite/old-owner-secret", expiresAt: "2099-01-01T00:00:00Z" }));
    expect(view.container.innerHTML).not.toContain("old-owner-secret"); expect(view.container.querySelector("dialog")).toBeNull();
    await click(await findButton(view.container, "People")); await click(await findButton(view.container, "Invite"));
    expect(view.container.querySelector('input[readonly]')).toBeNull(); expect(getButton(view.container, "Create link")).not.toBeNull();
  });

  it("opens the authenticated friends dashboard from People", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "People"));
    await click(await findButton(view.container, "Manage on website"));
    await waitFor(() =>
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "http://localhost:3003/account/friends",
      }),
    );
  });

  it("opens the authenticated room-invite dashboard from Inbox", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "Inbox"));
    await click(await findButton(view.container, "View on website"));
    await waitFor(() =>
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "http://localhost:3003/account/invites",
      }),
    );
  });

  it("accepts and declines incoming requests by friendship ID and refreshes after each action", async () => {
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    vi.mocked(listAccountInbox).mockResolvedValue(
      accountInbox([inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Incoming", NOW)]),
    );
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "Inbox"));
    await click(await findButton(view.container, "Accept friend request from Incoming"));
    await waitFor(() =>
      expect(acceptFriendRequest).toHaveBeenCalledWith("access-1", INCOMING_FRIENDSHIP_ID),
    );
    await waitFor(() => expect(listSocialDirectory).toHaveBeenCalledTimes(2));

    await click(await findButton(view.container, "Decline friend request from Incoming"));
    await waitFor(() =>
      expect(declineFriendRequest).toHaveBeenCalledWith("access-1", INCOMING_FRIENDSHIP_ID),
    );
    await waitFor(() => expect(listSocialDirectory).toHaveBeenCalledTimes(3));
  });

  it("marks displayed unseen inbox items seen once when Inbox opens", async () => {
    const unseen = accountInbox(
      [
        inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Incoming", null),
        inboxRoomInvite(INBOX_INVITE_ID, "active", null),
        inboxRoomInvite(MISSED_INVITE_ID, "missed", NOW),
      ],
      {
        actionable: 2,
        unseen: 2,
        activeRoomInvites: 1,
        pendingFriendRequests: 1,
      },
    );
    const seen = accountInbox(
      unseen.items.map((item) => ({ ...item, seenAt: NOW })),
      { ...unseen.counts, unseen: 0 },
    );
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    vi.mocked(listAccountInbox).mockResolvedValue(unseen);
    vi.mocked(markAccountInboxItemsSeen).mockResolvedValue(seen);
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "Inbox"));
    await waitFor(() =>
      expect(markAccountInboxItemsSeen).toHaveBeenCalledWith("access-1", [
        { kind: "friend-request", id: INCOMING_FRIENDSHIP_ID },
        { kind: "room-invite", id: INBOX_INVITE_ID },
      ]),
    );
    await waitFor(() => expect(publishAccountInboxForUser).toHaveBeenCalledWith(VIEWER_ID, seen, expect.any(Object)));
    expect(markAccountInboxItemsSeen).toHaveBeenCalledTimes(1);
    const inboxTab = await findButton(view.container, "Inbox");
    await waitFor(() => expect(inboxTab.querySelector(".popup-tab-count")).toBeNull());
  });

  it("uses the canonical publication result for a late mark-seen response after a newer inbox refresh", async () => {
    const unseen = accountInbox(
      [inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Incoming", null)],
      {
        actionable: 1,
        unseen: 1,
        activeRoomInvites: 0,
        pendingFriendRequests: 1,
      },
    );
    const refreshed = accountInbox(
      [inboxFriendRequest(INCOMING_FRIENDSHIP_ID, INCOMING_USER_ID, "Refreshed person", NOW)],
      {
        actionable: 1,
        unseen: 0,
        activeRoomInvites: 0,
        pendingFriendRequests: 1,
      },
    );
    const staleSeen = accountInbox([], {
      actionable: 0,
      unseen: 0,
      activeRoomInvites: 0,
      pendingFriendRequests: 0,
    });
    refreshed.meta.serverTime = "2026-08-09T12:00:01.000Z";
    let resolveSeen!: (value: AccountInboxResponse) => void;
    vi.mocked(listSocialDirectory).mockResolvedValue(directory());
    vi.mocked(listAccountInbox).mockResolvedValueOnce(unseen).mockResolvedValueOnce(refreshed);
    vi.mocked(markAccountInboxItemsSeen).mockImplementation(
      () =>
        new Promise<AccountInboxResponse>((resolve) => {
          resolveSeen = resolve;
        }),
    );
    const view = await renderPopupApp();
    root = view.root;

    await click(await findButton(view.container, "Inbox"));
    await waitFor(() => expect(markAccountInboxItemsSeen).toHaveBeenCalledTimes(1));
    await click(await findButton(view.container, "Refresh inbox"));
    await waitFor(() => expect(listAccountInbox).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.container.textContent).toContain("Refreshed person"));
    await waitFor(() =>
      expect(publishAccountInboxForUser).toHaveBeenCalledWith(VIEWER_ID, refreshed, expect.any(Object)),
    );
    vi.mocked(publishAccountInboxForUser).mockClear();
    vi.mocked(publishAccountInboxForUser).mockResolvedValue(refreshed);

    resolveSeen(staleSeen);
    await flushPromises();

    expect(view.container.textContent).toContain("Refreshed person");
    expect(publishAccountInboxForUser).toHaveBeenCalledWith(VIEWER_ID, staleSeen, expect.any(Object));
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
        onSaveGroup={vi.fn(async () => true)}
        onCreateInviteLink={vi.fn(async () => null)}
        onDeleteGroup={vi.fn(async () => true)}
        onRemoveFriend={vi.fn(async () => true)}
        onDismissNotice={vi.fn()}
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

async function renderElement(element: ReactNode): Promise<RenderedView> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return { container, root };
}

async function renderPopupApp(): Promise<RenderedView> {
  const view = await renderElement(<PopupApp />);
  await findButton(view.container, "Watch");
  await waitFor(() => expect(listSocialDirectory).toHaveBeenCalledTimes(1));
  return view;
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
    {
      status: "stale-error",
      directory: directory(),
      errorMessage: "Could not refresh people.",
    },
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

function socialSnapshot(overrides: Partial<SocialSnapshot> = {}): SocialSnapshot {
  return {
    directory: directory(),
    invites: roomInvites([]),
    ...overrides,
  };
}

function roomInvites(inbox: RoomInvite[]): RoomInvitesResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1 },
    inbox,
    sent: [],
  };
}

function accountInbox(
  items: AccountInboxResponse["items"],
  counts: AccountInboxResponse["counts"] = {
    unseen: items.filter((item) => item.seenAt === null).length,
    actionable: items.filter((item) => item.state !== "missed").length,
    activeRoomInvites: items.filter(
      (item) => item.kind === "room-invite" && item.state === "active",
    ).length,
    pendingFriendRequests: items.filter((item) => item.kind === "friend-request").length,
  },
): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId: VIEWER_ID },
    items,
    counts,
    nextCursor: null,
  };
}

function inboxRoomInvite(
  inviteId: string,
  state: "active" | "missed",
  seenAt: string | null,
): Extract<AccountInboxResponse["items"][number], { kind: "room-invite" }> {
  const item = {
    kind: "room-invite" as const,
    inviteId,
    roomId: `room-${inviteId}`,
    sender: {
      userId: RECENT_USER_ID,
      handle: "host",
      displayName: "Room Host",
      avatarUrl: null,
    },
    targetKind: "direct" as const,
    targetGroupId: null,
    targetGroupName: null,
    message: "Ready to watch?",
    roomTitle: "Friday watch",
    sourceUrl: "https://www.youtube.com/watch?v=video",
    videoFingerprint: "youtube:video",
    createdAt: NOW,
    activityAt: NOW,
    seenAt,
  };
  return state === "active"
    ? { ...item, state: "active", missedAt: null }
    : { ...item, state: "missed", missedAt: NOW };
}

function inboxFriendRequest(
  friendshipId: string,
  userId: string,
  displayName: string,
  seenAt: string | null,
): Extract<AccountInboxResponse["items"][number], { kind: "friend-request" }> {
  return {
    kind: "friend-request",
    friendshipId,
    sender: { userId, handle: null, displayName, avatarUrl: null },
    state: "pending",
    createdAt: NOW,
    activityAt: NOW,
    seenAt,
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

function group(
  id: string,
  archivedAt: string | null,
  name: string,
  memberNames: string[],
): FriendGroup {
  return {
    id,
    name,
    archivedAt,
    createdAt: NOW,
    updatedAt: NOW,
    members: memberNames.map((displayName, index) => ({
      user: {
        userId: `${id}-member-${index}`,
        handle: null,
        displayName,
        avatarUrl: null,
      },
      addedAt: NOW,
    })),
  };
}

function recent(userId: string, displayName = userId): RecentPerson {
  return {
    user: { userId, handle: null, displayName, avatarUrl: null },
    lastWatchedAt: NOW,
  };
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
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

async function waitFor(assertion: () => void): Promise<void> {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 2_000 });
  });
}

async function findButton(container: HTMLElement, name: string): Promise<HTMLButtonElement> {
  let button: HTMLButtonElement | null = null;
  await waitFor(() => {
    button =
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) =>
          !candidate.closest("[hidden]") && (candidate.getAttribute("aria-label") === name ||
          candidate.querySelector(".popup-tab-label")?.textContent === name ||
          candidate.textContent?.trim() === name),
      ) ?? null;
    if (!button) {
      const available = [...container.querySelectorAll<HTMLButtonElement>("button")]
        .map((candidate) => candidate.getAttribute("aria-label") ?? candidate.textContent?.trim())
        .filter(Boolean)
        .join(", ");
      throw new Error(`Button not found: ${name}. Available: ${available}`);
    }
  });
  return button!;
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label") === name || candidate.textContent?.trim() === name,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  return button;
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}

function installPopupChrome(): void {
  vi.stubGlobal("chrome", {
    storage: {
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    tabs: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  });
}

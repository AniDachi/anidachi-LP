import { describe, expect, it } from "vitest";
import {
  accountErrorState,
  accountLoadingState,
  accountReadyState,
  createAccountRequestGate,
  signedOutAccountState,
} from "../src/account-sync";

describe("account request gate", () => {
  it("invalidates captured work when the active account changes", () => {
    const gate = createAccountRequestGate();
    gate.activate("user-a");
    const requestA = gate.capture("user-a");
    expect(requestA).not.toBeNull();

    gate.activate("user-b");
    expect(gate.isCurrent(requestA!)).toBe(false);
    expect(gate.capture("user-a")).toBeNull();
    expect(gate.isCurrent(gate.capture("user-b")!)).toBe(true);
  });

  it("invalidates captured work on sign-out", () => {
    const gate = createAccountRequestGate("user-a");
    const request = gate.capture("user-a")!;
    gate.activate(null);
    expect(gate.isCurrent(request)).toBe(false);
  });

  it("does not let a stale caller reactivate its account", () => {
    const gate = createAccountRequestGate("user-a");
    const requestA = gate.capture("user-a")!;
    gate.activate("user-b");

    expect(gate.capture(requestA.userId)).toBeNull();
    expect(gate.currentUserId()).toBe("user-b");
  });
});

describe("account-owned state", () => {
  it("preserves cached data only for the same owner", () => {
    const readyA = accountReadyState("user-a", { friends: ["a"] });
    expect(accountLoadingState("user-a", readyA).data).toEqual({ friends: ["a"] });
    expect(accountLoadingState("user-b", readyA).data).toBeNull();
    expect(accountErrorState("user-b", readyA, "offline").data).toBeNull();
  });

  it("preserves same-owner data while reporting an error", () => {
    const readyA = accountReadyState("user-a", { friends: ["a"] });
    expect(accountErrorState("user-a", readyA, "offline")).toEqual({
      status: "error",
      ownerUserId: "user-a",
      data: { friends: ["a"] },
      error: "offline",
    });
  });

  it("represents sign-out without an owner or data", () => {
    expect(signedOutAccountState()).toEqual({
      status: "signed-out",
      ownerUserId: null,
      data: null,
      error: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  accountIdentityChanged,
  accountErrorState,
  accountLoadingState,
  accountReadyState,
  createAsyncGenerationGate,
  createAccountRequestGate,
  signedOutAccountState,
} from "../src/account-sync";

describe("account identity changes", () => {
  it("does not reactivate an account when only its tokens refresh", () => {
    expect(accountIdentityChanged("user-a", "user-a")).toBe(false);
  });

  it("reactivates ownership when the user changes or signs out", () => {
    expect(accountIdentityChanged("user-a", "user-b")).toBe(true);
    expect(accountIdentityChanged("user-a", null)).toBe(true);
  });
});

describe("async generation gate", () => {
  it("invalidates an older flow when a newer flow starts", () => {
    const gate = createAsyncGenerationGate();
    const first = gate.begin();
    const second = gate.begin();

    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it("lets related work capture the current generation without invalidating peers", () => {
    const gate = createAsyncGenerationGate();
    const activeGeneration = gate.begin();

    expect(gate.capture()).toBe(activeGeneration);
    expect(gate.capture()).toBe(activeGeneration);

    gate.begin();
    expect(gate.isCurrent(activeGeneration)).toBe(false);
  });
});

describe("account request gate", () => {
  it("invalidates captured work when the active account changes", () => {
    const gate = createAccountRequestGate();
    gate.activate("user-a");
    const requestA = gate.capture("user-a");
    expect(requestA).not.toBeNull();
    if (!requestA) throw new Error("Expected an account request token");

    gate.activate("user-b");
    expect(gate.isCurrent(requestA)).toBe(false);
    expect(gate.capture("user-a")).toBeNull();
    const requestB = gate.capture("user-b");
    expect(requestB).not.toBeNull();
    if (!requestB) throw new Error("Expected an account request token");
    expect(gate.isCurrent(requestB)).toBe(true);
  });

  it("invalidates captured work on sign-out", () => {
    const gate = createAccountRequestGate("user-a");
    const request = gate.capture("user-a");
    if (!request) throw new Error("Expected an account request token");
    gate.activate(null);
    expect(gate.isCurrent(request)).toBe(false);
  });

  it("does not revive an old signed-out scope after an account round trip", () => {
    const gate = createAccountRequestGate();
    const signedOutScope = gate.captureCurrent();

    gate.activate("user-a");
    gate.activate(null);

    expect(gate.isCurrent(signedOutScope)).toBe(false);
    expect(gate.isCurrent(gate.captureCurrent())).toBe(true);
  });

  it("does not let a stale caller reactivate its account", () => {
    const gate = createAccountRequestGate("user-a");
    const requestA = gate.capture("user-a");
    if (!requestA) throw new Error("Expected an account request token");
    gate.activate("user-b");

    expect(gate.capture(requestA.userId)).toBeNull();
    expect(gate.currentUserId()).toBe("user-b");
  });
});

describe("account-owned state", () => {
  it("preserves cached data only for the same owner", () => {
    const readyA = accountReadyState("user-a", { friends: ["a"] });
    expect(accountLoadingState("user-a", readyA).data).toEqual({
      friends: ["a"],
    });
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

  it("hides account A data before account B finishes loading", () => {
    const readyA = accountReadyState("user-a", { items: ["a"] });
    const loadingB = accountLoadingState("user-b", readyA);

    expect(loadingB).toEqual({
      status: "loading",
      ownerUserId: "user-b",
      data: null,
      error: null,
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

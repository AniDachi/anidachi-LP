export type AccountRequestToken = Readonly<{
  userId: string;
  generation: number;
}>;

export type AccountRequestGate = {
  activate(userId: string | null): void;
  capture(userId: string): AccountRequestToken | null;
  isCurrent(token: AccountRequestToken): boolean;
  currentUserId(): string | null;
};

export function createAccountRequestGate(
  initialUserId: string | null = null,
): AccountRequestGate {
  let activeUserId = initialUserId;
  let generation = 0;

  return {
    activate(userId) {
      if (userId === activeUserId) return;
      activeUserId = userId;
      generation += 1;
    },
    capture(userId) {
      return userId === activeUserId ? { userId, generation } : null;
    },
    isCurrent(token) {
      return token.userId === activeUserId && token.generation === generation;
    },
    currentUserId() {
      return activeUserId;
    },
  };
}

export type AccountOwnedState<T> =
  | { status: "loading"; ownerUserId: string; data: T | null; error: null }
  | { status: "ready"; ownerUserId: string; data: T; error: null }
  | { status: "error"; ownerUserId: string; data: T | null; error: string }
  | { status: "signed-out"; ownerUserId: null; data: null; error: null };

export function accountLoadingState<T>(
  userId: string,
  current?: AccountOwnedState<T> | null,
): AccountOwnedState<T> {
  return {
    status: "loading",
    ownerUserId: userId,
    data: sameOwnerData(userId, current),
    error: null,
  };
}

export function accountReadyState<T>(userId: string, data: T): AccountOwnedState<T> {
  return {
    status: "ready",
    ownerUserId: userId,
    data,
    error: null,
  };
}

export function accountErrorState<T>(
  userId: string,
  current: AccountOwnedState<T> | null | undefined,
  error: string,
): AccountOwnedState<T> {
  return {
    status: "error",
    ownerUserId: userId,
    data: sameOwnerData(userId, current),
    error,
  };
}

export function signedOutAccountState<T>(): AccountOwnedState<T> {
  return {
    status: "signed-out",
    ownerUserId: null,
    data: null,
    error: null,
  };
}

function sameOwnerData<T>(
  userId: string,
  current: AccountOwnedState<T> | null | undefined,
): T | null {
  return current?.ownerUserId === userId ? current.data : null;
}

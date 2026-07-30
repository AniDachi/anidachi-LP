import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InterfacePreferencesStorage } from "../src/use-interface-preferences";
import { useInterfacePreferences } from "../src/use-interface-preferences";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useInterfacePreferences", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("loads and normalizes valid stored preferences", async () => {
    const storage = createStorage({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
    const view = await render(<Harness storage={storage} />);
    await flush();

    expect(readPreferences(view.container)).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
    expect(readBoolean(view.container, "ready")).toBe(true);
    expect(readBoolean(view.container, "saving")).toBe(false);

    await unmount(view.root);
  });

  it("uses defaults when stored data is invalid", async () => {
    const view = await render(
      <Harness
        storage={createStorage({
          version: 99,
          mainControlVisibility: "always-visible",
          participantPillVisibility: "always-visible",
        })}
      />,
    );
    await flush();

    expect(readPreferences(view.container)).toEqual({
      version: 1,
      mainControlVisibility: "auto-hide",
      participantPillVisibility: "smart",
    });

    await unmount(view.root);
  });

  it("serializes rapid writes and retains the final state", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const write = vi
      .fn<InterfacePreferencesStorage["write"]>()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    const storage = createStorage(undefined, write);
    const view = await render(<Harness storage={storage} />);
    await flush();

    await click(getButton(view.container, "Pin main control"));
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(readBoolean(view.container, "saving")).toBe(true);

    await click(getButton(view.container, "Pin participant pills"));
    await flush();
    expect(write).toHaveBeenCalledTimes(1);

    firstWrite.resolve();
    await flush();
    expect(write).toHaveBeenCalledTimes(2);

    secondWrite.resolve();
    await flush();
    expect(readPreferences(view.container)).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
    expect(readBoolean(view.container, "saving")).toBe(false);
    expect(readText(view.container, "error")).toBe("");

    await unmount(view.root);
  });

  it("restores the latest successful snapshot when the latest write fails", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const write = vi
      .fn<InterfacePreferencesStorage["write"]>()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    const view = await render(<Harness storage={createStorage(undefined, write)} />);
    await flush();

    await click(getButton(view.container, "Pin main control"));
    firstWrite.resolve();
    await flush();

    await click(getButton(view.container, "Pin participant pills"));
    secondWrite.reject(new Error("Storage unavailable"));
    await flush();

    expect(readPreferences(view.container)).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "smart",
    });
    expect(readBoolean(view.container, "saving")).toBe(false);
    expect(readText(view.container, "error")).toBe("Couldn't save interface settings.");

    await unmount(view.root);
  });

  it("does not update React state after unmount during a pending read", async () => {
    const read = deferred<unknown>();
    const onSnapshot = vi.fn();
    const view = await render(
      <Harness
        onSnapshot={onSnapshot}
        storage={{
          read: () => read.promise,
          write: vi.fn(),
        }}
      />,
    );
    const snapshotsBeforeUnmount = onSnapshot.mock.calls.length;

    await unmount(view.root);
    read.resolve({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
    await flush();

    expect(onSnapshot).toHaveBeenCalledTimes(snapshotsBeforeUnmount);
  });

  it("does not update React state after unmount during a pending write", async () => {
    const write = deferred<void>();
    const onSnapshot = vi.fn();
    const view = await render(
      <Harness
        onSnapshot={onSnapshot}
        storage={createStorage(undefined, () => write.promise)}
      />,
    );
    await flush();
    await click(getButton(view.container, "Pin main control"));
    const snapshotsBeforeUnmount = onSnapshot.mock.calls.length;

    await unmount(view.root);
    write.resolve();
    await flush();

    expect(onSnapshot).toHaveBeenCalledTimes(snapshotsBeforeUnmount);
  });
});

function Harness({
  onSnapshot,
  storage,
}: {
  onSnapshot?(snapshot: string): void;
  storage: InterfacePreferencesStorage;
}) {
  const controller = useInterfacePreferences(storage);
  const serializedPreferences = JSON.stringify(controller.preferences);
  onSnapshot?.(
    JSON.stringify({
      error: controller.error,
      preferences: controller.preferences,
      ready: controller.ready,
      saving: controller.saving,
    }),
  );

  return (
    <div
      data-error={controller.error ?? ""}
      data-preferences={serializedPreferences}
      data-ready={String(controller.ready)}
      data-saving={String(controller.saving)}
    >
      <button
        onClick={() => controller.update({ mainControlVisibility: "always-visible" })}
        type="button"
      >
        Pin main control
      </button>
      <button
        onClick={() => controller.update({ participantPillVisibility: "always-visible" })}
        type="button"
      >
        Pin participant pills
      </button>
    </div>
  );
}

interface RenderedView {
  container: HTMLDivElement;
  root: Root;
}

async function render(node: ReactNode): Promise<RenderedView> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function unmount(root: Root): Promise<void> {
  await act(async () => {
    root.unmount();
  });
}

function createStorage(
  storedValue: unknown = undefined,
  write: InterfacePreferencesStorage["write"] = vi.fn(),
): InterfacePreferencesStorage {
  return {
    read: vi.fn().mockResolvedValue(storedValue),
    write,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${name}`);
  }
  return button;
}

function readPreferences(container: HTMLElement) {
  return JSON.parse(container.firstElementChild?.getAttribute("data-preferences") ?? "null");
}

function readBoolean(container: HTMLElement, key: string): boolean {
  return container.firstElementChild?.getAttribute(`data-${key}`) === "true";
}

function readText(container: HTMLElement, key: string): string {
  return container.firstElementChild?.getAttribute(`data-${key}`) ?? "";
}

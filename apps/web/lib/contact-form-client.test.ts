import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import type { Root } from "react-dom/client";

const dom = new Window({ url: "http://localhost/account/bug-report" });
for (const [key, value] of Object.entries({
  window: dom,
  self: dom,
  document: dom.document,
  navigator: dom.navigator,
  HTMLElement: dom.HTMLElement,
  Node: dom.Node,
  Event: dom.Event,
  React,
  IS_REACT_ACT_ENVIRONMENT: true,
}))
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
  });

let createRoot: typeof import("react-dom/client").createRoot;
let ContactForm: typeof import("../components/contact-form").ContactForm;
before(async () => {
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactForm } = await import("../components/contact-form"));
});
const originalFetch = globalThis.fetch;
const contact = { name: "Alex Chen", email: "alex@example.invalid" };
let root: Root | undefined;
let container: HTMLDivElement;

async function mount(variant: "public" | "bug-report" = "bug-report") {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      React.createElement(ContactForm, {
        variant,
        initialContact: contact,
      }),
    ),
  );
}

function field(label: string) {
  const element = [
    ...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    ),
  ].find(
    (input) =>
      input.labels?.[0]?.querySelector("span")?.textContent?.trim() === label,
  );
  assert.ok(element, `Missing field: ${label}`);
  return element;
}

async function fill(label: string, value: string) {
  const element = field(label);
  const prototype =
    element.tagName === "TEXTAREA"
      ? dom.HTMLTextAreaElement.prototype
      : dom.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === text,
  );
  assert.ok(button);
  await act(async () => button.click());
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
});

test("account bug reports use support transport and preserve contact details after acknowledgement", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({ ok: true });
  };
  await mount();
  assert.equal(container.querySelector("select"), null);
  assert.equal(container.querySelector("form")!.noValidate, false);
  assert.equal(field("Name").value, contact.name);
  assert.equal(field("Email").value, contact.email);
  const title = "a".repeat(field("Short title").maxLength);
  await fill("Short title", title);
  await fill("What happened?", "Microphone stays muted after I join the room.");
  await submit();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/contact");
  assert.deepEqual(requests[0].body, {
    ...contact,
    category: "support",
    subject: `[Bug report] ${title}`,
    message: "Microphone stays muted after I join the room.",
    company_website: "",
  });
  assert.equal(String(requests[0].body.subject).length, 160);
  assert.match(
    container.querySelector('[role="status"]')!.textContent!,
    /Bug report sent/,
  );
  await click("Report another bug");
  assert.equal(field("Short title").value, "");
  assert.equal(field("What happened?").value, "");
  assert.equal(field("Email").value, contact.email);
});

test("failed storage keeps the report draft and allows a retry without false success", async () => {
  let attempts = 0;
  globalThis.fetch = async () =>
    ++attempts === 1
      ? Response.json(
          { error: "Could not send your message. Please try again." },
          { status: 503 },
        )
      : Response.json({ ok: true });
  await mount();
  await fill("Short title", "Microphone issue");
  await fill("What happened?", "It stays muted after joining.");
  await submit();
  assert.equal(container.querySelector('[role="status"]'), null);
  assert.match(
    container.querySelector('[role="alert"]')!.textContent!,
    /Please try again/,
  );
  assert.equal(field("Short title").value, "Microphone issue");
  assert.equal(field("What happened?").value, "It stays muted after joining.");
  await submit();
  assert.equal(attempts, 2);
  assert.match(container.textContent!, /Bug report sent/);
});

test("an in-flight report cannot be submitted twice or edited before acknowledgement", async () => {
  let requests = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => {
    requests++;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  };
  await mount();
  await fill("Short title", "Microphone issue");
  await fill("What happened?", "It stays muted after joining.");
  await submit();
  assert.equal(field("Short title").disabled, true);
  assert.equal(field("What happened?").disabled, true);
  assert.equal(
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!
      .disabled,
    true,
  );
  await submit();
  assert.equal(requests, 1);
  await act(async () => resolve(Response.json({ ok: true })));
});

test("a blank bug title is not disguised by the subject prefix", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ ok: true });
  };
  await mount();
  await fill("Short title", "   ");
  await submit();
  assert.equal(requests, 0);
  assert.match(
    container.querySelector('[role="alert"]')!.textContent!,
    /short title/,
  );
});

test("public contact retains its topics, unprefixed subject and post-send reset", async () => {
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ ok: true });
  };
  await mount("public");
  assert.equal(container.querySelectorAll("select option").length, 6);
  assert.equal(field("Subject").maxLength, 160);
  await fill("Subject", "A support question");
  await fill("Message", "How can I update my account details?");
  await submit();
  assert.equal(body.subject, "A support question");
  assert.equal(body.category, "support");
  await click("Send another message");
  assert.equal(field("Name").value, "");
  assert.equal(field("Email").value, "");
});

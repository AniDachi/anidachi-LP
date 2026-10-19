import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WebsiteCheckoutReturn } from "../components/website-checkout-return";

let root: Root | undefined;
const originalFetch = globalThis.fetch;
afterEach(async () => {
  await act(async () => root?.unmount()); root = undefined;
  document.body.innerHTML = ""; globalThis.fetch = originalFetch;
  dom.happyDOM.setURL("http://localhost/success");
});
test("a pending owner response is rechecked after leaving the page, even when it is visible again", async () => {
  dom.happyDOM.setURL("http://localhost/success");
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  let reads = 0;
  globalThis.fetch = async () => ++reads === 1 ? pending : Response.json({ ownerUserId: "replacement" });
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  await act(async () => root!.render(React.createElement(WebsiteCheckoutReturn, { owner: "original" })));
  await act(async () => new Promise(done => setTimeout(done, 10)));
  assert.equal(reads, 1);
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    resolve(Response.json({ ownerUserId: "original" }));
  });
  assert.equal(reads, 2);
  assert.equal(window.location.pathname, "/success");
  assert.match(el.textContent!, /account changed/);
});

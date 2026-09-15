import { createRequire } from "node:module";
import { Window } from "happy-dom";
import * as React from "react";

// Next handles CSS imports in browser builds; these tests exercise DOM behavior.
createRequire(import.meta.url).extensions[".css"] = () => undefined;
(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
export const dom = new Window({ url: "http://localhost/account/watch-library" });
for (const [key, value] of Object.entries({
  window: dom, self: dom, document: dom.document, navigator: dom.navigator,
  Node: dom.Node, Element: dom.Element, HTMLElement: dom.HTMLElement,
  HTMLInputElement: dom.HTMLInputElement, Event: dom.Event, CustomEvent: dom.CustomEvent,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
dom.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
dom.HTMLDialogElement.prototype.show = function () { this.setAttribute("open", ""); };
dom.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };

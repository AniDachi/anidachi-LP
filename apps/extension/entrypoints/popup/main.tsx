import { createRoot } from "react-dom/client";
import { PopupApp } from "../../src/popup-app";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Anidachi popup root element was not found.");
}

createRoot(rootElement).render(<PopupApp />);

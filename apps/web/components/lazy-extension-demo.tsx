"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ChromeExtensionDemo = dynamic(
  () => import("@/components/chrome-extension-demo").then((m) => m.ChromeExtensionDemo),
  { ssr: false },
);

/**
 * Loads the homepage demo only when it nears the viewport, so the hub's first screen stays light.
 * The reserved height keeps the layout from jumping when the demo mounts. The wrapper id differs
 * from the demo's own `#demo` section so the anchor exists before the demo loads.
 */
export function LazyExtensionDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} id="product-demo" className="min-h-[60vh] scroll-mt-20">
      {visible ? <ChromeExtensionDemo /> : null}
    </div>
  );
}

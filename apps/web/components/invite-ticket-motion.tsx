"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { InviteTicketStamp } from "./invite-ticket-stamp";
import styles from "./invite-ticket.module.css";

export function InviteTicketMotion({ face, children }: { face: ReactNode; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const turner = useRef<HTMLDivElement>(null);
  const faceArea = useRef<HTMLElement>(null);

  function steadyControls() {
    const surface = stage.current;
    if (!surface || surface.hasAttribute("data-controls")) return;
    surface.setAttribute("data-controls", "");
    surface.removeAttribute("data-tilted");
    turner.current?.getAnimations().forEach(animation => animation.cancel());
  }

  function spin() {
    const card = turner.current;
    if (!card || card.getAnimations().length) return;
    stage.current?.removeAttribute("data-controls");
    stage.current?.removeAttribute("data-tilted");
    const gold = "rotateY(-180deg)";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Show the embossing briefly without turning it in space.
      card.animate([{ transform: gold }, { transform: gold }], 700);
      return;
    }
    const ease = "cubic-bezier(.45, 0, .25, 1)";
    card.animate([
      { transform: "rotateY(0deg)", easing: ease },
      { transform: gold, offset: .42 },
      { transform: gold, offset: .60, easing: ease },
      { transform: "rotateY(-360deg)" },
    ], { duration: 1450 });
  }

  useEffect(() => {
    const surface = stage.current;
    const cover = faceArea.current;
    if (!surface || !cover) return;

    const motion = window.matchMedia("(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      surface.removeAttribute("data-tilted");
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.buttons) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // Layout dimensions stay fixed while the artwork turns or tilts.
        const bounds = surface.getBoundingClientRect();
        const left = pointerX - bounds.left;
        const top = pointerY - bounds.top;
        if (left < 0 || top < 0 || left > bounds.width || top > bounds.height) return;
        if (left >= cover.offsetWidth || top >= cover.offsetHeight) {
          steadyControls();
          return;
        }
        surface.removeAttribute("data-controls");
        if (!motion.matches || turner.current?.getAnimations().length) return;
        const x = left / cover.offsetWidth * 2 - 1;
        const y = top / cover.offsetHeight * 2 - 1;
        surface.style.setProperty("--ticket-yaw", `${x * 3.2}deg`);
        surface.style.setProperty("--ticket-pitch", `${-y * 3.6}deg`);
        surface.style.setProperty("--foil-light", `${50 + 28 * x}%`);
        surface.setAttribute("data-tilted", "");
      });
    };

    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", reset);
    surface.addEventListener("pointercancel", reset);
    motion.addEventListener("change", reset);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", reset);
      surface.removeEventListener("pointercancel", reset);
      motion.removeEventListener("change", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return (
    <div ref={stage} className={styles.stage}>
      <article className={styles.ticket} aria-label="Room invitation">
        <div ref={turner} className={styles.turner}>
          <div className={styles.front}>
            <header className={styles.face} ref={faceArea}>
              <span className={`noise-overlay ${styles.grain}`} aria-hidden="true" />
              {face}
              <button className={styles.flip} type="button" aria-label="Spin ticket" onClick={spin} />
            </header>
            <section className={styles.stub} aria-label="Room access" onFocusCapture={steadyControls}>
              <span className={`noise-overlay ${styles.grain}`} aria-hidden="true" />
              {children}
            </section>
          </div>
          <div className={styles.reverse} aria-hidden="true">
            <span className={styles.foil}>
              <span className={styles.seal}>
                <InviteTicketStamp />
                <span>AniDachi</span>
              </span>
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

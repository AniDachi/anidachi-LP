import { composedClosest, disneyControlsPortal, findDisneyPlusElement, isDisneyPlusMainVideo } from "./dom";
import { disneyPlusWatchId } from "./url";

const SLIDER = ".progress-bar__seekable-range[role='slider']";
const AD_UI = '[data-testid="ad-countdown"], .progress-bar__ad, [aria-label="Advertisement" i], [aria-label="Anúncio" i]';
export type DisneyPlusPosition = { currentTime: number; duration: number };
type Sample = DisneyPlusPosition & { node: HTMLElement };
type Anchor = { sample: Sample; raw: number; lastRaw: number; lastObserved: number; src: string };

function readNumber(node: Element, attribute: string): number | null {
  const value = node.getAttribute(attribute);
  if (value === null || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export class DisneyPlusTimeline {
  private anchor: Anchor | null = null;
  private stale: Sample | null = null;
  private slider: HTMLElement | null = null;
  private lastWake = -Infinity;

  constructor(private video: HTMLVideoElement, private player: HTMLElement, readonly id: string | null) {}

  get surface(): HTMLElement {
    return this.player.closest<HTMLElement>(".pbx-player-surface") ?? this.player;
  }

  isCurrent(): boolean {
    return !!this.id && disneyPlusWatchId(location.href) === this.id &&
      !!(this.video.currentSrc || this.video.src) && isDisneyPlusMainVideo(this.video, this.player);
  }

  reset(): void {
    if (this.anchor) this.stale = this.anchor.sample;
    this.anchor = null;
  }

  discardPrevious(previous: DisneyPlusTimeline): void {
    this.stale = previous.anchor?.sample ?? previous.stale;
  }

  private controlsRoot(): HTMLElement | null {
    return disneyControlsPortal(this.video.ownerDocument);
  }

  hasAdUI(): boolean {
    if (!this.id || !this.player.isConnected) return false;
    const root = this.controlsRoot();
    const marker = root && findDisneyPlusElement<HTMLElement>(root, AD_UI);
    return !!marker && !composedClosest(marker, "[hidden], [aria-hidden='true']") &&
      marker.getBoundingClientRect().width > 0;
  }

  private sample(): Sample | null {
    const root = this.controlsRoot();
    if (!root) return null;
    if (!this.slider?.isConnected || composedClosest(this.slider, "disney-web-player-ui") !== root) {
      this.slider = findDisneyPlusElement(root, SLIDER);
    }
    const node = this.slider;
    if (!node || !composedClosest(node, ".progress-bar__container.progress-bar__vod") ||
        composedClosest(node, "[aria-disabled='true'], [hidden]")) return null;
    const duration = readNumber(node, "aria-valuemax");
    if (duration === null || duration <= 0) return null;
    // aria-valuenow can remain at the last seek cursor while the film advances.
    // The filled VOD bar continues to track the actual content position.
    const fill = node.querySelector<HTMLElement>('[data-qa="progress-bar.progress"]')?.style.width;
    const percent = fill && /^(?:\d+\.?\d*|\.\d+)%$/.test(fill) ? Number.parseFloat(fill) : NaN;
    let currentTime = percent >= 0 && percent <= 100 ? duration * percent / 100 : NaN;
    if (!Number.isFinite(currentTime)) {
      const remaining = findDisneyPlusElement(root, '[data-qa="time-remaining-indicator.container"]')?.textContent?.trim();
      if (!remaining || !/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(remaining)) return null;
      const seconds = remaining.split(":").reduce((total, part) => total * 60 + Number(part), 0);
      if (seconds > duration) return null;
      currentTime = duration - seconds;
    }
    return { node, currentTime, duration };
  }

  getPosition(): DisneyPlusPosition | null {
    const raw = this.video.currentTime;
    if (!this.isCurrent() || this.video.readyState < 2 || !Number.isFinite(raw) || !this.controlsRoot() || this.hasAdUI()) {
      this.reset();
      return null;
    }
    const now = performance.now();
    const src = this.video.currentSrc || this.video.src;
    let anchor = this.anchor;
    if (anchor) {
      const elapsed = Math.max(0, now - anchor.lastObserved) / 1000;
      const delta = raw - anchor.lastRaw;
      // The native media clock is relative to a streaming segment. Only its continuous
      // displacement from a confirmed Disney+ content clock is meaningful.
      if (anchor.src !== src || delta < -0.5 || delta > elapsed * Math.max(1, this.video.playbackRate) + 2) {
        this.reset();
        anchor = null;
      }
    }
    const sample = this.sample();
    if (!sample && this.slider?.isConnected) {
      // An exposed but disabled, non-VOD, or malformed seek bar cannot authenticate content.
      this.reset();
      return null;
    }
    if (sample && this.stale && (this.stale.node !== sample.node ||
        this.stale.currentTime !== sample.currentTime || this.stale.duration !== sample.duration)) this.stale = null;
    if (sample && !this.stale && (!anchor || sample.node !== anchor.sample.node ||
        sample.currentTime !== anchor.sample.currentTime || sample.duration !== anchor.sample.duration)) {
      anchor = this.anchor = { sample, src, raw, lastRaw: raw, lastObserved: now };
    }
    if (!anchor) return null;
    anchor.lastRaw = raw;
    anchor.lastObserved = now;
    return {
      currentTime: Math.max(0, Math.min(anchor.sample.duration, anchor.sample.currentTime + raw - anchor.raw)),
      duration: anchor.sample.duration,
    };
  }

  wakeControls(): void {
    if (!this.isCurrent() || performance.now() - this.lastWake < 1000) return;
    this.lastWake = performance.now();
    const rect = this.video.getBoundingClientRect();
    const options = { bubbles: true, composed: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    this.controlsRoot()?.dispatchEvent(new MouseEvent("mousemove", options));
  }

  seekTo(target: number): boolean {
    const position = this.getPosition();
    const sample = this.sample();
    if (!position || !sample || !Number.isFinite(target) || target < 0 || target > position.duration) return false;
    const rect = sample.node.getBoundingClientRect();
    if (rect.width <= 0) return false;
    const fraction = target / sample.duration;
    const options = { bubbles: true, composed: true, cancelable: true, button: 0,
      clientX: rect.left + rect.width * fraction, clientY: rect.top + rect.height / 2 };
    // PointerEvent preserves fractional viewport coordinates, including on long films.
    const pointer = { ...options, pointerType: "mouse", pointerId: 1, isPrimary: true };
    sample.node.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
    sample.node.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0 }));
    return true;
  }
}

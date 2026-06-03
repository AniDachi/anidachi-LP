type StudyEvent =
  | "canplay"
  | "durationchange"
  | "loadeddata"
  | "loadedmetadata"
  | "pause"
  | "play"
  | "playing"
  | "ratechange"
  | "seeked"
  | "seeking"
  | "stalled"
  | "timeupdate"
  | "waiting";

interface StudyRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface StudyElement {
  aria: string | null;
  className: string | null;
  id: string | null;
  path: string;
  rect: StudyRect;
  role: string | null;
  tag: string;
  testId: string | null;
  text: string | null;
}

interface StudyVideoSnapshot extends StudyElement {
  buffered: Array<[number, number]>;
  currentSrc: string | null;
  currentTime: number;
  duration: number | null;
  ended: boolean;
  muted: boolean;
  networkState: number;
  paused: boolean;
  playbackRate: number;
  readyState: number;
  seeking: boolean;
  src: string | null;
}

interface StudyTimelineEvent {
  at: number;
  buffered: Array<[number, number]>;
  currentTime: number;
  duration: number | null;
  event: StudyEvent | "control-click" | "fullscreenchange" | "keydown";
  key?: string;
  networkState?: number;
  paused?: boolean;
  readyState?: number;
  selector?: string;
  text?: string | null;
}

const EVENT_NAMES: StudyEvent[] = [
  "canplay",
  "durationchange",
  "loadeddata",
  "loadedmetadata",
  "pause",
  "play",
  "playing",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "timeupdate",
  "waiting",
];

const MAX_TIMELINE_EVENTS = 240;

export function startCrunchyrollStudyIfEnabled(): (() => void) | null {
  if (!isCrunchyrollStudyEnabled()) {
    return null;
  }

  return startCrunchyrollStudy();
}

function isCrunchyrollStudyEnabled(): boolean {
  if (!location.hostname.endsWith("crunchyroll.com")) {
    return false;
  }

  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  return (
    params.get("anidachiCrunchyrollStudy") === "1" ||
    hashParams.get("anidachiCrunchyrollStudy") === "1" ||
    localStorage.getItem("anidachiCrunchyrollStudy") === "1"
  );
}

function startCrunchyrollStudy(): () => void {
  const watchedVideos = new WeakSet<HTMLVideoElement>();
  const disposers: Array<() => void> = [];
  const timeline: StudyTimelineEvent[] = [];

  const record = (event: StudyTimelineEvent) => {
    timeline.push(event);
    if (timeline.length > MAX_TIMELINE_EVENTS) {
      timeline.splice(0, timeline.length - MAX_TIMELINE_EVENTS);
    }
  };

  const logSnapshot = (reason: string) => {
    logStudyPayload({
      reason,
      snapshot: getCrunchyrollStudySnapshot(),
      timeline: timeline.slice(-60),
    });
  };

  const watchVideo = (video: HTMLVideoElement) => {
    if (watchedVideos.has(video)) {
      return;
    }

    watchedVideos.add(video);
    for (const eventName of EVENT_NAMES) {
      const listener = () => {
        if (eventName === "timeupdate" && Math.round(performance.now()) % 3 !== 0) {
          return;
        }

        record({
          at: Math.round(performance.now()),
          buffered: readBuffered(video),
          currentTime: finite(video.currentTime, 0),
          duration: finiteOrNull(video.duration),
          event: eventName,
          networkState: video.networkState,
          paused: video.paused,
          readyState: video.readyState,
        });

        if (eventName !== "timeupdate") {
          logSnapshot(`video:${eventName}`);
        }
      };
      video.addEventListener(eventName, listener, true);
      disposers.push(() => video.removeEventListener(eventName, listener, true));
    }
  };

  const scanVideos = () => {
    for (const video of document.querySelectorAll("video")) {
      watchVideo(video);
    }
  };

  const clickListener = (event: MouseEvent) => {
    const element =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-testid], button, [role='button']")
        : null;
    if (
      !element?.closest(
        "#player-container, .video-player-wrapper, [data-testid='player-controls-root']",
      )
    ) {
      return;
    }

    const video = document.querySelector("video");
    record({
      at: Math.round(performance.now()),
      buffered: video instanceof HTMLVideoElement ? readBuffered(video) : [],
      currentTime: video instanceof HTMLVideoElement ? finite(video.currentTime, 0) : 0,
      duration: video instanceof HTMLVideoElement ? finiteOrNull(video.duration) : null,
      event: "control-click",
      paused: video instanceof HTMLVideoElement ? video.paused : undefined,
      selector: getSelector(element),
      text: getText(element),
    });
    logSnapshot("control-click");
  };

  const keyListener = (event: KeyboardEvent) => {
    const video = document.querySelector("video");
    record({
      at: Math.round(performance.now()),
      buffered: video instanceof HTMLVideoElement ? readBuffered(video) : [],
      currentTime: video instanceof HTMLVideoElement ? finite(video.currentTime, 0) : 0,
      duration: video instanceof HTMLVideoElement ? finiteOrNull(video.duration) : null,
      event: "keydown",
      key: event.key,
      paused: video instanceof HTMLVideoElement ? video.paused : undefined,
    });
  };

  const fullscreenListener = () => {
    const video = document.querySelector("video");
    record({
      at: Math.round(performance.now()),
      buffered: video instanceof HTMLVideoElement ? readBuffered(video) : [],
      currentTime: video instanceof HTMLVideoElement ? finite(video.currentTime, 0) : 0,
      duration: video instanceof HTMLVideoElement ? finiteOrNull(video.duration) : null,
      event: "fullscreenchange",
      paused: video instanceof HTMLVideoElement ? video.paused : undefined,
      selector:
        document.fullscreenElement instanceof HTMLElement
          ? getSelector(document.fullscreenElement)
          : undefined,
    });
    logSnapshot("fullscreenchange");
  };

  const requestListener = () => {
    logSnapshot("manual-request");
  };

  scanVideos();
  document.addEventListener("click", clickListener, true);
  document.addEventListener("keydown", keyListener, true);
  document.addEventListener("fullscreenchange", fullscreenListener, true);
  window.addEventListener("anidachi-crunchyroll-study-request", requestListener);
  disposers.push(() => document.removeEventListener("click", clickListener, true));
  disposers.push(() => document.removeEventListener("keydown", keyListener, true));
  disposers.push(() => document.removeEventListener("fullscreenchange", fullscreenListener, true));
  disposers.push(() =>
    window.removeEventListener("anidachi-crunchyroll-study-request", requestListener),
  );

  const scanInterval = window.setInterval(scanVideos, 1200);
  const snapshotInterval = window.setInterval(() => logSnapshot("interval"), 5000);
  disposers.push(() => window.clearInterval(scanInterval));
  disposers.push(() => window.clearInterval(snapshotInterval));

  logSnapshot("started");

  return () => {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
    logStudyPayload({ reason: "stopped" });
  };
}

function getCrunchyrollStudySnapshot() {
  const controls = getVisibleControls();
  const videos = Array.from(document.querySelectorAll("video")).map(videoSnapshot);
  const playerContainer = document.querySelector<HTMLElement>("#player-container");
  const playerControlsRoot = document.querySelector<HTMLElement>(
    "[data-testid='player-controls-root']",
  );
  const bitmovinContainer = document.querySelector<HTMLElement>(".bitmovinplayer-container");

  return {
    containers: {
      bitmovinContainer: elementSnapshot(bitmovinContainer),
      fullscreenElement: elementSnapshot(document.fullscreenElement),
      playerContainer: elementSnapshot(playerContainer),
      playerControlsRoot: elementSnapshot(playerControlsRoot),
      videoPlayerWrapper: elementSnapshot(document.querySelector(".video-player-wrapper")),
    },
    controls,
    title: document.title,
    url: location.href,
    videos,
  };
}

function getVisibleControls(): StudyElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-testid], button, [role='button'], [role='slider'], input[type='range']",
    ),
  )
    .map(elementSnapshot)
    .filter((item): item is StudyElement =>
      Boolean(item && item.rect.width > 0 && item.rect.height > 0),
    )
    .filter((item) => {
      const key = `${item.testId ?? ""} ${item.aria ?? ""} ${item.role ?? ""}`.toLowerCase();
      return /player|play|pause|seek|scrub|timeline|time|jump|full|control|slider|volume|speed|track|subtitle|audio/.test(
        key,
      );
    });
}

function videoSnapshot(video: HTMLVideoElement): StudyVideoSnapshot {
  const base = elementSnapshot(video);
  if (!base) {
    throw new Error("Expected video element snapshot");
  }

  return {
    ...base,
    buffered: readBuffered(video),
    currentSrc: video.currentSrc || null,
    currentTime: finite(video.currentTime, 0),
    duration: finiteOrNull(video.duration),
    ended: video.ended,
    muted: video.muted,
    networkState: video.networkState,
    paused: video.paused,
    playbackRate: finite(video.playbackRate, 1),
    readyState: video.readyState,
    seeking: video.seeking,
    src: video.src || null,
  };
}

function elementSnapshot(element: Element | null): StudyElement | null {
  if (
    !(element instanceof HTMLElement) &&
    !(element instanceof SVGElement) &&
    !(element instanceof HTMLVideoElement)
  ) {
    return null;
  }

  return {
    aria: element.getAttribute("aria-label"),
    className: cleanClassName(element.getAttribute("class")),
    id: element.id || null,
    path: getElementPath(element),
    rect: getRect(element),
    role: element.getAttribute("role"),
    tag: element.tagName.toLowerCase(),
    testId: element.getAttribute("data-testid"),
    text: getText(element),
  };
}

function getRect(element: Element): StudyRect {
  const rect = element.getBoundingClientRect();
  return {
    height: Math.round(rect.height),
    width: Math.round(rect.width),
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  };
}

function readBuffered(video: HTMLVideoElement): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < video.buffered.length; index += 1) {
    ranges.push([round(video.buffered.start(index)), round(video.buffered.end(index))]);
  }
  return ranges;
}

function getElementPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && parts.length < 10) {
    parts.unshift(getSelector(current));
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function getSelector(element: Element): string {
  const id = element.id ? `#${element.id}` : "";
  const testId = element.getAttribute("data-testid")
    ? `[data-testid="${element.getAttribute("data-testid")}"]`
    : "";
  const className = cleanClassName(element.getAttribute("class"));
  const classes = className ? `.${className.split(/\s+/).slice(0, 2).join(".")}` : "";
  return `${element.tagName.toLowerCase()}${id}${testId}${classes}`;
}

function getText(element: Element): string | null {
  const text = (element.textContent ?? "").trim().replace(/\s+/g, " ");
  return text ? text.slice(0, 120) : null;
}

function cleanClassName(className: string | null): string | null {
  return className?.trim().replace(/\s+/g, " ").slice(0, 180) || null;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? round(value) : fallback;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? round(value) : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function logStudyPayload(payload: unknown): void {
  console.info("[Anidachi Crunchyroll Study]", JSON.stringify(payload));
}

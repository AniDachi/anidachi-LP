import { useCallback, useEffect, useRef, useState } from "react";

/** Presentation only: the actual room/media stop immediately. Never supplies
 * quota or delays server work. A new login/room retires the old transition. */
export function useRoomClosingPresentation(options: {
  loginKey: string | null; roomId: string | null; pending: boolean;
  ready: boolean; failed: boolean;
}) {
  const latest = useRef(options); latest.current = options;
  const [transition, setTransition] = useState<{ loginKey: string; roomId: string; at: number } | null>(null);
  const [timedOutAt, setTimedOutAt] = useState<number | null>(null);
  const begin = useCallback(() => {
    const { loginKey, roomId } = latest.current;
    if (!loginKey || !roomId) return;
    setTransition(previous => previous?.loginKey === loginKey && previous.roomId === roomId
      ? previous : { loginKey, roomId, at: performance.now() });
  }, []);
  const cancel = useCallback(() => setTransition(null), []);
  const inScope = transition !== null && transition.loginKey === options.loginKey &&
    (options.roomId === null || options.roomId === transition.roomId);
  const complete = options.roomId === null && !options.pending && (options.ready || options.failed);
  const unavailable = inScope && !complete && timedOutAt === transition?.at;
  const closing = inScope && !complete && !unavailable;
  useEffect(() => {
    if (!transition) return;
    if (!inScope || complete) { setTransition(null); return; }
    const timer = setTimeout(() => setTimedOutAt(transition.at), Math.max(0, transition.at + 12_000 - performance.now()));
    return () => clearTimeout(timer);
  }, [transition, inScope, complete]);
  return { closing, unavailable, begin, cancel };
}

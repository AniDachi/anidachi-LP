import { useEffect, useRef } from "react";

interface OverlayUnmountCleanupOptions {
  stopMicrophonePublication: () => void;
}

export function useOverlayUnmountCleanup({
  stopMicrophonePublication,
}: OverlayUnmountCleanupOptions): void {
  const stopMicrophonePublicationRef = useRef(stopMicrophonePublication);

  useEffect(() => {
    stopMicrophonePublicationRef.current = stopMicrophonePublication;
  }, [stopMicrophonePublication]);

  useEffect(
    () => () => {
      stopMicrophonePublicationRef.current();
    },
    [],
  );
}

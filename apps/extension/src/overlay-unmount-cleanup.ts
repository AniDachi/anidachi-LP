import { useEffect, useRef } from "react";

interface OverlayUnmountCleanupOptions {
  stopMicrophonePublication: () => void;
  stopVoiceCapture: (send?: boolean) => void;
}

export function useOverlayUnmountCleanup({
  stopMicrophonePublication,
  stopVoiceCapture,
}: OverlayUnmountCleanupOptions): void {
  const stopMicrophonePublicationRef = useRef(stopMicrophonePublication);
  const stopVoiceCaptureRef = useRef(stopVoiceCapture);

  useEffect(() => {
    stopMicrophonePublicationRef.current = stopMicrophonePublication;
  }, [stopMicrophonePublication]);

  useEffect(() => {
    stopVoiceCaptureRef.current = stopVoiceCapture;
  }, [stopVoiceCapture]);

  useEffect(
    () => () => {
      stopMicrophonePublicationRef.current();
      stopVoiceCaptureRef.current(false);
    },
    [],
  );
}

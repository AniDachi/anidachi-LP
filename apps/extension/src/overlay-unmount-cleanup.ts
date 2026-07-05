import { useEffect, useRef } from "react";

interface OverlayUnmountCleanupOptions {
  stopLiveVoiceTalk: () => void;
  stopVoiceCapture: (send?: boolean) => void;
}

export function useOverlayUnmountCleanup({
  stopLiveVoiceTalk,
  stopVoiceCapture,
}: OverlayUnmountCleanupOptions): void {
  const stopLiveVoiceTalkRef = useRef(stopLiveVoiceTalk);
  const stopVoiceCaptureRef = useRef(stopVoiceCapture);

  useEffect(() => {
    stopLiveVoiceTalkRef.current = stopLiveVoiceTalk;
  }, [stopLiveVoiceTalk]);

  useEffect(() => {
    stopVoiceCaptureRef.current = stopVoiceCapture;
  }, [stopVoiceCapture]);

  useEffect(
    () => () => {
      stopLiveVoiceTalkRef.current();
      stopVoiceCaptureRef.current(false);
    },
    [],
  );
}

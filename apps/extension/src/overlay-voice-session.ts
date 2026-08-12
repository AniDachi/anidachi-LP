import type { VoiceMode } from "./media-types";

export type MicrophoneRelease = "immediate" | "warm";

export interface VoiceSessionContext {
  listenerScope: string | null;
  localHasMediaSeat: boolean;
  roomId: string | null;
}

export interface VoiceSessionState extends VoiceSessionContext {
  mode: VoiceMode;
  pushToTalkHeld: boolean;
  release: MicrophoneRelease;
}

export type VoiceSessionAction =
  | ({ type: "context" } & VoiceSessionContext)
  | { type: "mode"; mode: VoiceMode }
  | { type: "push-to-talk"; held: boolean }
  | { type: "terminal-failure" };

export function createVoiceSessionState({
  listenerScope,
  localHasMediaSeat,
  mode,
  roomId,
}: VoiceSessionContext & { mode: VoiceMode }): VoiceSessionState {
  return {
    listenerScope,
    localHasMediaSeat,
    mode,
    pushToTalkHeld: false,
    release: "immediate",
    roomId,
  };
}

export function reduceVoiceSession(
  state: VoiceSessionState,
  action: VoiceSessionAction,
): VoiceSessionState {
  if (action.type === "context") {
    const listenerScopeChanged = action.listenerScope !== state.listenerScope;
    const terminalContextChange =
      listenerScopeChanged ||
      action.roomId !== state.roomId ||
      (state.localHasMediaSeat && !action.localHasMediaSeat);
    if (terminalContextChange) {
      return {
        ...state,
        listenerScope: action.listenerScope,
        localHasMediaSeat: action.localHasMediaSeat,
        mode: "push-to-talk",
        pushToTalkHeld: false,
        release: "immediate",
        roomId: action.roomId,
      };
    }
    return {
      ...state,
      listenerScope: action.listenerScope,
      localHasMediaSeat: action.localHasMediaSeat,
      roomId: action.roomId,
    };
  }

  if (action.type === "mode") {
    if (action.mode === state.mode) {
      return state;
    }
    return {
      ...state,
      mode: action.mode,
      pushToTalkHeld: false,
      release: action.mode === "open-mic" ? "warm" : "immediate",
    };
  }

  if (action.type === "terminal-failure") {
    return stopVoiceSessionImmediately(state);
  }

  if (
    !state.roomId ||
    !state.localHasMediaSeat ||
    (action.type === "push-to-talk" && state.mode !== "push-to-talk")
  ) {
    return state;
  }

  return {
    ...state,
    pushToTalkHeld: action.held,
    release: "warm",
  };
}

export function isVoiceSessionPublishing(state: VoiceSessionState): boolean {
  if (!state.roomId || !state.localHasMediaSeat) {
    return false;
  }
  return state.mode === "open-mic" || state.pushToTalkHeld;
}

export function getVoiceIndicatorParticipantIds({
  localParticipantId,
  measuredSpeakerIds,
  state,
}: {
  localParticipantId: string | null;
  measuredSpeakerIds: readonly string[];
  state: VoiceSessionState;
}): string[] {
  const indicatorIds = new Set(measuredSpeakerIds);
  if (localParticipantId && state.mode === "push-to-talk") {
    indicatorIds.delete(localParticipantId);
    if (state.pushToTalkHeld && isVoiceSessionPublishing(state)) {
      indicatorIds.add(localParticipantId);
    }
  }
  return [...indicatorIds];
}

function stopVoiceSessionImmediately(
  state: VoiceSessionState,
): VoiceSessionState {
  return {
    ...state,
    mode: "push-to-talk",
    pushToTalkHeld: false,
    release: "immediate",
  };
}

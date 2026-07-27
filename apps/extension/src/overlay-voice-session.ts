import type { VoiceMode } from "./media-types";

export type MicrophoneRelease = "immediate" | "warm";

export interface VoiceSessionContext {
  listenerScope: string | null;
  localHasMediaSeat: boolean;
  roomId: string | null;
}

export interface VoiceSessionState extends VoiceSessionContext {
  mode: VoiceMode;
  openMicEnabled: boolean;
  pushToTalkHeld: boolean;
  release: MicrophoneRelease;
}

export type VoiceSessionAction =
  | ({ type: "context" } & VoiceSessionContext)
  | { type: "mode"; mode: VoiceMode }
  | { type: "open-mic"; enabled: boolean }
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
    openMicEnabled: false,
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
        mode: listenerScopeChanged ? "push-to-talk" : state.mode,
        openMicEnabled: false,
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
      openMicEnabled: false,
      pushToTalkHeld: false,
      release: "immediate",
    };
  }

  if (action.type === "terminal-failure") {
    return stopVoiceSessionImmediately(state);
  }

  if (
    !state.roomId ||
    !state.localHasMediaSeat ||
    (action.type === "open-mic" && state.mode !== "open-mic") ||
    (action.type === "push-to-talk" && state.mode !== "push-to-talk")
  ) {
    return state;
  }

  if (action.type === "open-mic") {
    return {
      ...state,
      openMicEnabled: action.enabled,
      pushToTalkHeld: false,
      release: action.enabled ? "warm" : "immediate",
    };
  }

  return {
    ...state,
    openMicEnabled: false,
    pushToTalkHeld: action.held,
    release: "warm",
  };
}

export function isVoiceSessionPublishing(state: VoiceSessionState): boolean {
  if (!state.roomId || !state.localHasMediaSeat) {
    return false;
  }
  return state.mode === "open-mic"
    ? state.openMicEnabled
    : state.pushToTalkHeld;
}

function stopVoiceSessionImmediately(
  state: VoiceSessionState,
): VoiceSessionState {
  return {
    ...state,
    openMicEnabled: false,
    pushToTalkHeld: false,
    release: "immediate",
  };
}

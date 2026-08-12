import type { VoiceMode } from "./media-types";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";

export interface VoiceSettingsPanelProps {
  feedback?: string | null;
  mode: VoiceMode;
  onModeChange: (mode: VoiceMode) => void;
}

export function VoiceSettingsPanel({
  feedback,
  mode,
  onModeChange,
}: VoiceSettingsPanelProps) {
  return (
    <div
      {...overlayHotkeyBoundaryProps}
      className="settings-panel-stack voice-settings-panel"
    >
      <div
        aria-label="Microphone mode"
        className="segmented-control voice-mode-control"
        onKeyDown={(event) => {
          const nextMode = getNextVoiceMode(event.key);
          if (!nextMode) {
            return;
          }
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-voice-mode="${nextMode}"]`)
            ?.focus();
          if (nextMode !== mode) {
            onModeChange(nextMode);
          }
        }}
        role="radiogroup"
      >
        <VoiceModeButton
          active={mode === "push-to-talk"}
          label="Push to talk"
          mode="push-to-talk"
          onSelect={() => onModeChange("push-to-talk")}
        />
        <VoiceModeButton
          active={mode === "open-mic"}
          label="Open mic"
          mode="open-mic"
          onSelect={() => onModeChange("open-mic")}
        />
      </div>

      {feedback ? (
        <div className="footnote voice-settings-feedback" role="alert">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}

interface VoiceModeButtonProps {
  active: boolean;
  label: string;
  mode: VoiceMode;
  onSelect: () => void;
}

function VoiceModeButton({
  active,
  label,
  mode,
  onSelect,
}: VoiceModeButtonProps) {
  return (
    <button
      aria-checked={active}
      aria-label={label}
      className={active ? "selected" : undefined}
      data-voice-mode={mode}
      onClick={() => {
        if (!active) {
          onSelect();
        }
      }}
      role="radio"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      {label}
    </button>
  );
}

function getNextVoiceMode(key: string): VoiceMode | null {
  if (key === "ArrowRight" || key === "ArrowDown" || key === "End") {
    return "open-mic";
  }
  if (key === "ArrowLeft" || key === "ArrowUp" || key === "Home") {
    return "push-to-talk";
  }
  return null;
}

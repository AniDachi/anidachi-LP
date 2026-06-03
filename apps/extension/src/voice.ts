import { VOICE_KEYWORD_EMOJI } from "./constants";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export function mapVoiceToEmoji(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  for (const [keyword, emoji] of Object.entries(VOICE_KEYWORD_EMOJI)) {
    if (normalized.includes(keyword)) {
      return emoji;
    }
  }

  return null;
}

export function startVoiceRecognition(options: {
  onText: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): () => void {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Recognition) {
    options.onError("Speech recognition is not available in this browser.");
    options.onEnd();
    return () => {};
  }

  const recognition = new Recognition();
  recognition.lang = navigator.language || "ru-RU";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) {
      options.onText(transcript);
    }
  };
  recognition.onerror = (event) => options.onError(event.error ?? "Speech recognition failed.");
  recognition.onend = options.onEnd;
  recognition.start();

  return () => recognition.stop();
}

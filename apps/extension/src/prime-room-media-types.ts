import {z} from "zod";
import type {MicrophoneStatus, MicrophoneTerminalFailure} from "./media-types";
import type {P2PMediaDiagnostics} from "./p2p-media";

const preference = z.object({muted: z.boolean(), volume: z.number().min(0).max(1)});
export const PrimeMediaCommandSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("reconcile")}),
  z.object({type: z.literal("state")}),
  z.object({type: z.literal("gesture"), device: z.enum(["camera","microphone"])}),
  z.object({type: z.literal("camera"), enabled: z.boolean()}),
  z.object({type: z.literal("microphone"), enabled: z.boolean(), mode: z.enum(["open-mic","push-to-talk"]), release: z.enum(["immediate","warm"]), requestId: z.string().optional()}),
  z.object({type: z.literal("output"), id: z.string(), preference}),
  z.object({type: z.literal("outputs"), preferences: z.record(z.string(), preference)}),
  z.object({type: z.literal("unlock")}),
  z.object({type: z.literal("stats"), id: z.string()}),
]);
export type PrimeMediaCommand = z.infer<typeof PrimeMediaCommandSchema>;
export interface PrimeMediaState {
  type: "prime-media-state";
  videos: {participantId: string; local: boolean; revision: string}[];
  activeSpeakerIds: string[];
  microphoneStatus: MicrophoneStatus;
  microphoneTerminalFailure: MicrophoneTerminalFailure | null;
  voiceMessage: string | null;
}
export const emptyPrimeMediaState: PrimeMediaState = {
  type: "prime-media-state", videos: [], activeSpeakerIds: [], microphoneStatus: "off",
  microphoneTerminalFailure: null, voiceMessage: null,
};
export type PrimeMediaReply = PrimeMediaState | {type: "prime-media-stats"; id: string; stats: P2PMediaDiagnostics | null};
export interface PrimeMediaBridge {
  sendMediaCommand(value: unknown): void;
  subscribeMedia(listener: (value: unknown) => void): () => void;
}
export function primeMediaBridge(client: unknown): PrimeMediaBridge | null {
  const candidate = client as Partial<PrimeMediaBridge> | null;
  return typeof candidate?.subscribeMedia === "function" && typeof candidate.sendMediaCommand === "function"
    ? candidate as PrimeMediaBridge : null;
}

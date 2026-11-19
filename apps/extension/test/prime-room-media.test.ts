// @vitest-environment happy-dom
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {Participant, RoomMediaV2Snapshot, ServerEvent} from "@anidachi/protocol";
import {RoomMediaSession} from "../src/room-media-session";
import type {RoomClient} from "../src/room-client";

const mocks = vi.hoisted(() => ({
  controller: {setCameraEnabled: vi.fn(), setCaptureAuthority: vi.fn(), setMicrophonePublishing: vi.fn(),
    updateParticipants: vi.fn(), replaceParticipantAudioOutputs: vi.fn(), disconnect: vi.fn()},
  access: {update: vi.fn(), attach: vi.fn(), detach: vi.fn(), close: vi.fn()},
}));
vi.mock("../src/p2p-media", async original => ({...await original<typeof import("../src/p2p-media")>(),
  P2PMediaController: class { constructor() {return mocks.controller;} }}));
vi.mock("../src/p2p-ice", () => ({loadP2PIceServers: async () => [], refreshP2PIceServers: async () => []}));
vi.mock("../src/prime-media-owner-access", () => ({PrimeMediaOwnerAccess: class {constructor() {return mocks.access;}}}));
import {createPrimeRoomMedia} from "../src/prime-room-media";

const room = {tabId: 5, roomId: "room", roomToken: "test", participantSessionId: "self"};
const local: Participant = {id:"u", participantSessionId:"self", role:"host",displayName:"Host",
  cameraEnabled:false, mediaSeat:"none", syncStatus:"synced", lastSeenAt:1, connected:true};
const first: RoomMediaV2Snapshot = {type:"ROOM_MEDIA_SNAPSHOT",roomId:"room",roomGeneration:1,snapshotSequence:1,
  capabilities:{mediaProtocolVersion:2,hostPlanCode:"pro",maxParticipants:15,maxMicrophones:8,maxCameras:4,
    capabilityRevision:1,capabilitiesValidUntil:"2027-01-01T00:00:00Z"},closingAt:null,
  participants:[{participantSessionId:"self",cameraGranted:false,microphoneGranted:false,cameraIntentSequence:0,
    microphoneIntentSequence:0,cameraRevocationEpoch:0,microphoneRevocationEpoch:0}]};
async function setup() {
  const media = new RoomMediaSession("room","self");
  const client = {media,send:vi.fn(),releaseFailedMedia:vi.fn()} as unknown as RoomClient;
  const owner = createPrimeRoomMedia(client,local,vi.fn(),room);
  const receive = (event: ServerEvent) => {media.consume(event); owner.onEvent(event);};
  receive({type:"ROOM_SNAPSHOT",roomId:"room",roomGeneration:1,sourceGeneration:1,serverSeq:1,participants:[local]});
  receive(first);
  expect(mocks.controller.replaceParticipantAudioOutputs).not.toHaveBeenCalled();
  owner.onCommand({type:"outputs", preferences:{guest:{muted:true,volume:1}}});
  await Promise.resolve();
  expect(mocks.controller.replaceParticipantAudioOutputs).toHaveBeenCalledWith({guest:{muted:true,volume:1}});
  return {owner,media,receive};
}
beforeEach(() => vi.clearAllMocks());
describe("persistent Prime call owner", () => {
  it("preserves an open microphone and camera across document detach, then revokes without a page",async () => {
    const {owner,media,receive} = await setup();
    const camera = media.intent("camera",true)!;
    const mic = media.intent("microphone",true)!;
    expect(mocks.controller.setCameraEnabled).not.toHaveBeenCalledWith(true);
    const grants = {...first.participants[0], cameraGranted:true, microphoneGranted:true,
      cameraIntentSequence:camera.intentSequence, microphoneIntentSequence:mic.intentSequence};
    receive({...first,snapshotSequence:2,participants:[grants]});
    owner.onCommand({type:"microphone",enabled:true,mode:"open-mic",release:"warm",requestId:mic.requestId});
    expect(mocks.controller.setCameraEnabled).toHaveBeenLastCalledWith(true);
    expect(mocks.controller.setMicrophonePublishing).toHaveBeenLastCalledWith(true,"warm","open-mic");
    mocks.controller.setCameraEnabled.mockClear(); mocks.controller.setMicrophonePublishing.mockClear();
    owner.onDetach(); owner.onAttach(); owner.onDetach();
    expect(mocks.controller.disconnect).not.toHaveBeenCalled();
    expect(mocks.controller.setCameraEnabled).not.toHaveBeenCalled();
    expect(mocks.controller.setMicrophonePublishing).not.toHaveBeenCalled();
    receive({...first,snapshotSequence:3,participants:[{...grants,cameraGranted:false,microphoneGranted:false,cameraRevocationEpoch:1,microphoneRevocationEpoch:1}]});
    expect(mocks.controller.setCaptureAuthority).toHaveBeenLastCalledWith(false,false,{camera:undefined,microphone:undefined});
    expect(mocks.controller.setMicrophonePublishing).toHaveBeenLastCalledWith(false,"warm","open-mic");
    owner.close(); owner.close();
    expect(mocks.controller.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.access.close).toHaveBeenCalledTimes(1);
  });
  it("releases a held push-to-talk on detach and rejects stale requests", async () => {
    const {owner,media,receive} = await setup();
    const mic = media.intent("microphone",true)!;
    receive({...first,snapshotSequence:2,participants:[{...first.participants[0],microphoneGranted:true,microphoneIntentSequence:mic.intentSequence}]});
    owner.onCommand({type:"microphone",enabled:true,mode:"push-to-talk",release:"warm",requestId:"wrong"});
    expect(mocks.controller.setMicrophonePublishing).not.toHaveBeenCalledWith(true,"warm","push-to-talk");
    owner.onCommand({type:"microphone",enabled:true,mode:"push-to-talk",release:"warm",requestId:mic.requestId});
    owner.onDetach();
    expect(mocks.controller.setMicrophonePublishing).toHaveBeenLastCalledWith(false,"immediate","push-to-talk");
    owner.close();
  });
});

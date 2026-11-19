// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {PrimeMediaOwnerAccess} from "../src/prime-media-owner-access";
const send = vi.fn();
const scope = {tabId:3,roomId:"room",participantSessionId:"me"};
let owner: PrimeMediaOwnerAccess;
beforeEach(() => {
  send.mockReset();
  vi.stubGlobal("chrome",{runtime:{sendMessage:send,onMessage:{addListener:vi.fn()}}});
  owner = new PrimeMediaOwnerAccess(scope);
});
afterEach(() => {owner.close();vi.unstubAllGlobals();});
describe("scoped Prime media access",() => {
  it("redeems each tile ticket and grant just once and clears the frame immediately on revocation",() => {
    const source = document.createElement("video");
    const stream = new MediaStream();
    source.srcObject = stream;
    owner.update([{participantId:"p",local:false,element:source}]);
    expect(owner.handle({action:"ticket",participantId:"elsewhere"})).toBeNull();
    const ticket = owner.handle({action:"ticket",participantId:"p"})!;
    const grant = owner.handle({action:"redeem",ticket})!;
    expect(owner.handle({action:"redeem",ticket})).toBeNull();
    const target = document.createElement("video");
    expect(owner.bind(grant,target)).toBeTypeOf("function");
    expect(owner.bind(grant,target)).toBeUndefined();
    expect(target.srcObject).toBe(stream);
    const unused = owner.handle({action:"ticket",participantId:"p"})!;
    owner.update([]);
    expect(target.srcObject).toBeNull();
    expect(owner.handle({action:"redeem",ticket:unused})).toBeNull();
    owner.detach();
    owner.update([{participantId:"p",local:false,element:source}]);
    expect(owner.handle({action:"ticket",participantId:"p"})).toBeNull();
    owner.attach();
    expect(owner.handle({action:"ticket",participantId:"p"})).toBeTypeOf("string");
  });
  it("never acquires a device after a pending permission is revoked",async () => {
    let valid = true;
    const getUserMedia = vi.fn();
    const query = vi.fn(async () => ({state:"prompt"}));
    vi.stubGlobal("navigator",{permissions:{query},mediaDevices:{getUserMedia}});
    send.mockResolvedValue(8);
    const capture = owner.capture("camera",{video:true},()=>valid,()=>valid);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({action:"open"})));
    const {ticket} = send.mock.calls[0][0];
    expect(owner.handle({action:"permission",ticket})).toBe("camera");
    valid = false;
    owner.update([]);
    expect(owner.handle({action:"settle",ticket,allowed:true})).toBeNull();
    await expect(capture).rejects.toThrow();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it("checks camera and microphone independently and never prompts for automatic restoration",async () => {
    const getUserMedia = vi.fn(async () => ({}));
    const query = vi.fn(async ({name}) => ({state:name === "camera" ? "granted" : "prompt"}));
    vi.stubGlobal("navigator",{permissions:{query},mediaDevices:{getUserMedia}});
    await owner.capture("camera",{video:true},()=>true,()=>false);
    await expect(owner.capture("microphone",{audio:true},()=>true,()=>false)).rejects.toThrow();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});

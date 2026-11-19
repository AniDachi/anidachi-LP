import {beforeEach, describe, expect, it, vi} from "vitest";
const data = vi.hoisted(() => {
  const room = {ownerUserId:"user",roomId:"room",participantSessionId:"session"};
  return {room, player:vi.fn(), read:vi.fn(async()=>room), auth:vi.fn(async()=>({user:{id:"user"}}))};
});
vi.mock("../src/prime-room-background",()=>({isAttachedPrimePlayerDocument:data.player}));
vi.mock("../src/auth-tokens",()=>({getStoredAuthTokens:data.auth}));
vi.mock("../src/room-session-storage",()=>({loadRoomSessionForTab:data.read}));
import {mediaAccessChannel, mediaOwnerChannel} from "../src/prime-media-access";
import {installPrimeMediaBackground} from "../src/prime-media-background";

const player = "https://www.amazon.ca/dp/B0EXAMPLE1";
let listener: (message: unknown, sender: Partial<chrome.runtime.MessageSender>, respond: (v: unknown)=>void)=>boolean|void;
const send = vi.fn();
const tab = {id:42,url:player} as chrome.tabs.Tab;
const extension = "chrome-extension://test/";
beforeEach(() => {
  send.mockReset();
  data.player.mockReset();
  vi.stubGlobal("chrome",{runtime:{id:"test",getURL:(s:string)=>extension+s,sendMessage:send,
    onMessage:{addListener:(next:typeof listener)=>{listener=next;}}},tabs:{get:async()=>tab}});
  installPrimeMediaBackground();
});
function request(message: object, sender: Partial<chrome.runtime.MessageSender>) {
  return new Promise(resolve=>listener({channel:mediaAccessChannel,...message},{id:"test",...sender},resolve));
}
describe("Prime-only media on ambiguous Amazon product routes",() => {
  it("binds tile issuance to the exact attached player document",async () => {
    const sender = {tab,url:player,documentId:"doc",frameId:0};
    data.player.mockResolvedValue(false);
    expect(await request({action:"ticket",participantId:"other"},sender)).toBeNull();
    expect(data.player).toHaveBeenCalledWith(tab,data.room,"doc");
    expect(send).not.toHaveBeenCalled();
    data.player.mockResolvedValue(true); send.mockResolvedValue("ticket");
    expect(await request({action:"ticket",participantId:"other"},sender)).toBe("ticket");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({channel:mediaOwnerChannel,
      scope:{tabId:42,roomId:"room",participantSessionId:"session"}}));
  });
  it("denies ticket redemption after the owning tab stops showing the player",async () => {
    data.player.mockResolvedValue(false);
    const ticket = crypto.randomUUID();
    expect(await request({action:"redeem",ticket},{tab,url:extension+"prime-media-tile.html#"+ticket,frameId:4})).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});

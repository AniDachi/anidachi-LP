import {deviceConstraints, mediaAccessChannel} from "../../src/prime-media-access";

const params = new URLSearchParams(location.hash.slice(1));
const request = {channel: mediaAccessChannel, roomTabId: Number(params.get("roomTabId")), ticket: params.get("ticket")};
const info = document.querySelector("#info")!;
const button = document.querySelector("button")!;
const verify = () => chrome.runtime.sendMessage({...request, action: "permission"});
async function mount() {
  const device = await verify();
  if (device !== "camera" && device !== "microphone") { info.textContent = "This device request has expired."; return; }
  info.textContent = `Allow AniDachi to use your ${device} for this Prime Video room. Chrome will ask for your permission.`;
  button.hidden = false;
  button.textContent = `Allow ${device}`;
  let settled = false;
  const settle = (allowed: boolean) => {
    if (settled) return;
    settled = true;
    void chrome.runtime.sendMessage({...request, action: "settle", allowed}).catch(() => {});
  };
  window.addEventListener("pagehide", () => settle(false), {once: true});
  button.onclick = async () => {
    button.disabled = true;
    try {
      if (await verify() !== device) { info.textContent = "This device request has expired."; return; }
      const sample = await navigator.mediaDevices.getUserMedia(deviceConstraints(device));
      sample.getTracks().forEach(track => track.stop());
      info.textContent = "Permission granted. Return to your Prime Video room.";
      settle(true);
    } catch {
      info.textContent = "Device access was declined. You can return to your room.";
      settle(false);
    }
  };
}
void mount().catch(() => { info.textContent = "This device request has expired."; });

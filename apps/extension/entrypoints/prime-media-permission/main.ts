import {deviceConstraints, mediaAccessChannel} from "../../src/prime-media-access";

async function requestPermission() {
  if (window.top === window) return;
  const request = {channel: mediaAccessChannel, ticket: location.hash.slice(1)};
  const device = await chrome.runtime.sendMessage({...request, action: "permission"});
  if (device !== "camera" && device !== "microphone") return;

  let allowed = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(deviceConstraints(device));
    stream.getTracks().forEach(track => track.stop());
    allowed = true;
  } finally {
    await chrome.runtime.sendMessage({...request, action: "settle", allowed});
  }
}
void requestPermission().catch(() => {});

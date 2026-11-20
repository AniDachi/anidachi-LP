import type { RoomMediaKind } from "@anidachi/protocol";
import type { GhostVideo } from "./media-types";
import {
  mediaOwnerChannel, sameMediaScope,
  type OwnerAccess, type PrimeDevicePrompt, type PrimeMediaScope, type PrimeTileWindow,
} from "./prime-media-access";

type Ticket = { id: string; expires: number };
type Binding = { id: string; target: HTMLVideoElement };
type Permission = {
  device: RoomMediaKind;
  valid: () => boolean;
  finish: (granted: boolean) => void;
  documentId?: string;
};

const owners = new Set<PrimeMediaOwnerAccess>();
let installed = false;

/** Installed only by the private offscreen entry point. */
function installAccess() {
  if (installed) return;
  installed = true;
  (window as PrimeTileWindow).bindPrimeRoomTile = (grant, target) => {
    for (const owner of owners) {
      const release = owner.bind(grant, target);
      if (release) return release;
    }
  };
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.channel !== mediaOwnerChannel || sender.tab || sender.documentId ||
        sender.id !== location.hostname || sender.url !== new URL("background.js", location.href).href) return;
    const owner = [...owners].find(item => message.scope && sameMediaScope(item.scope, message.scope));
    reply(owner?.handle(message.request) ?? null);
  });
}

export class PrimeMediaOwnerAccess {
  private attached = true;
  private attachmentGeneration = 0;
  private tickets = new Map<string, Ticket>();
  private grants = new Map<string, Ticket>();
  private bindings = new Set<Binding>();
  private permissions = new Map<string, Permission>();
  private streams = new Map<string, MediaStream>();
  constructor(readonly scope: PrimeMediaScope, private publishPrompts: (prompts: PrimeDevicePrompt[]) => void) {
    installAccess();
    owners.add(this);
  }

  update(videos: GhostVideo[]) {
    this.streams = new Map(videos.flatMap(video => {
      const stream = video.element.srcObject as MediaStream | null;
      return stream ? [[video.participantId, stream] as const] : [];
    }));
    for (const binding of this.bindings) {
      const stream = this.streams.get(binding.id) ?? null;
      if (binding.target.srcObject !== stream) {
        binding.target.srcObject = null;
        this.bindings.delete(binding);
      }
    }
    for (const entries of [this.tickets, this.grants]) {
      for (const [key, item] of entries) if (!this.streams.has(item.id) || item.expires < Date.now()) entries.delete(key);
    }
    for (const permission of this.permissions.values()) if (!permission.valid()) permission.finish(false);
  }

  handle(request: OwnerAccess) {
    if (request.action === "ticket" && this.attached && this.streams.has(request.participantId)) {
      // Expire abandoned frame mounts, and bound allocations even in an unresponsive tab.
      if (this.tickets.size >= 32) this.tickets.delete(this.tickets.keys().next().value!);
      const ticket = crypto.randomUUID();
      this.tickets.set(ticket, {id: request.participantId, expires: Date.now() + 30_000});
      return ticket;
    }
    if (request.action === "redeem") {
      const item = this.tickets.get(request.ticket);
      this.tickets.delete(request.ticket);
      if (!item || item.expires < Date.now() || !this.streams.has(item.id)) return null;
      if (this.grants.size >= 32) this.grants.delete(this.grants.keys().next().value!);
      const grant = crypto.randomUUID();
      this.grants.set(grant, item);
      return grant;
    }
    if (request.action === "permission" || request.action === "settle") {
      const pending = this.permissions.get(request.ticket);
      if (!pending?.valid()) return null;
      if (request.action === "permission") {
        if (pending.documentId) return null;
        pending.documentId = request.documentId;
      } else {
        if (pending.documentId !== request.documentId) return null;
        pending.finish(request.allowed);
      }
      return pending.device;
    }
    return null;
  }

  bind(grant: string, target: HTMLVideoElement) {
    const entry = this.grants.get(grant);
    if (!entry) return;
    this.grants.delete(grant);
    const stream = this.streams.get(entry.id);
    if (entry.expires < Date.now() || !stream) return;
    const binding = {id: entry.id, target};
    this.bindings.add(binding);
    target.srcObject = stream;
    return () => { target.srcObject = null; this.bindings.delete(binding); };
  }

  attach() { this.attached = true; }

  detach() {
    this.attached = false;
    this.attachmentGeneration++;
    this.tickets.clear();
    this.grants.clear();
    for (const binding of this.bindings) binding.target.srcObject = null;
    this.bindings.clear();
    for (const permission of this.permissions.values()) permission.finish(false);
  }

  close() {
    this.detach();
    this.streams.clear();
    owners.delete(this);
  }

  async capture(device: RoomMediaKind, constraints: MediaStreamConstraints, valid: () => boolean, promptAllowed: () => boolean) {
    if (!valid()) throw new DOMException("Capture expired", "AbortError");
    const generation = this.attachmentGeneration;
    const status = await navigator.permissions.query({name: device as PermissionName});
    if (!valid()) throw new DOMException("Capture expired", "AbortError");
    if (status.state !== "granted") {
      // Releasing push-to-talk stops publication, but the user can still finish giving microphone consent.
      const mayAsk = () => this.attached && generation === this.attachmentGeneration && promptAllowed() &&
        (device === "microphone" || valid());
      if (status.state !== "prompt" || !mayAsk() || !await this.requestPermission(device, mayAsk))
        throw new DOMException("Device permission was denied", "NotAllowedError");
    }
    if (!valid()) throw new DOMException("Capture expired", "AbortError");
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private requestPermission(device: RoomMediaKind, valid: () => boolean): Promise<boolean> {
    const ticket = crypto.randomUUID();
    for (const pending of this.permissions.values()) if (pending.device === device) pending.finish(false);
    return new Promise(resolve => {
      const timer = window.setTimeout(() => pending.finish(false), 120_000);
      const pending: Permission = {
        device, valid, finish: granted => {
          if (!this.permissions.delete(ticket)) return;
          window.clearTimeout(timer);
          this.notifyPrompts();
          resolve(granted && valid());
        },
      };
      this.permissions.set(ticket, pending);
      this.notifyPrompts();
    });
  }

  private notifyPrompts() {
    this.publishPrompts(Array.from(this.permissions, ([ticket, {device}]) => ({ticket, device})));
  }
}

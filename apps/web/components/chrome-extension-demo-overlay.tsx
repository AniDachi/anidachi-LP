"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Check,
  Copy,
  Mic,
  Radio,
  RefreshCw,
  SendHorizontal,
  SmilePlus,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import Image from "next/image";
import { AnidachiLogo } from "@/components/anidachi-logo";

export const EMOJI_LIST = ["😂", "😱", "❤️", "🔥", "😭", "👀"];

export type Participant = {
  id: string;
  displayName: string;
  initials: string;
  role: "host" | "guest";
  cameraEnabled: boolean;
  avatarUrl?: string;
  speaking?: boolean;
  nameColor?: string;
};

export type ReactionPop = {
  id: string;
  emoji: string;
  right: number;
};

export type LiveChatLine = {
  id: string;
  name: string;
  color: string;
  text: string;
};

export const FRIENDS: Participant[] = [
  {
    id: "1",
    displayName: "You",
    initials: "YO",
    role: "host",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/host.jpg",
    nameColor: "#ff8a3d",
  },
  {
    id: "2",
    displayName: "Natsuki",
    initials: "NA",
    role: "guest",
    cameraEnabled: false,
    avatarUrl: "/demo/avatars/natsuki.jpg",
    nameColor: "#7dd3a7",
  },
  {
    id: "3",
    displayName: "Haruto",
    initials: "HA",
    role: "guest",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/haruto.jpg",
    speaking: true,
    nameColor: "#93c5fd",
  },
];

const SETTINGS_TABS = ["Reactions", "Layout", "Interface", "Voice"] as const;

export function DemoOverlayKeyframes() {
  return (
    <style>{`
      @keyframes anidachi-pop {
        0%   { opacity:0; transform: translate3d(-4px,10px,0) scale(0.82); }
        16%  { opacity:1; transform: translate3d(0,0,0) scale(1); }
        78%  { opacity:1; }
        100% { opacity:0; transform: translate3d(10px,-42px,0) scale(0.92); }
      }
      @keyframes cam-enter {
        0%   { opacity:0; transform: translateY(8px) scale(0.8); }
        100% { opacity:1; transform: translateY(0) scale(1); }
      }
      @keyframes demo-edge-glow {
        0%   { opacity:0; transform: translateY(-4px) scaleX(0.7); }
        30%  { opacity:0.96; transform: translateY(0) scaleX(1); }
        100% { opacity:0; transform: translateY(-2px) scaleX(0.85); }
      }
      @keyframes demo-chat-in {
        0%   { opacity:0; transform: translateY(6px); }
        100% { opacity:1; transform: translateY(0); }
      }
      @keyframes demo-composer-in {
        0%   { opacity:0; transform: translateY(10px) scale(0.98); }
        100% { opacity:1; transform: translateY(0) scale(1); }
      }
      @keyframes anidachi-room-rail-avatar-pulse {
        0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.12), 0 0 16px rgba(34,197,94,0.22); }
        50% { box-shadow: 0 0 0 5px rgba(34,197,94,0.05), 0 0 24px rgba(34,197,94,0.34); }
      }
      @keyframes anidachi-room-rail-bar-1 {
        0%, 100% { height: 5px; }
        45% { height: 12px; }
      }
      @keyframes anidachi-room-rail-bar-2 {
        0%, 100% { height: 10px; }
        50% { height: 5px; }
      }
      @keyframes anidachi-room-rail-bar-3 {
        0%, 100% { height: 6px; }
        52% { height: 14px; }
      }

      .demo-anidachi-overlay {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: rgba(255, 255, 255, 0.92);
        --ad-accent: #ff8a3d;
        --ad-accent-strong: #f97316;
        --ad-surface: rgba(255, 255, 255, 0.065);
        --ad-surface-strong: rgba(255, 255, 255, 0.1);
        --ad-border: rgba(255, 255, 255, 0.12);
        --ad-border-strong: rgba(255, 255, 255, 0.18);
        --ad-text: rgba(255, 255, 255, 0.93);
      }
      .demo-anidachi-overlay button {
        font: inherit;
      }

      .demo-anidachi-overlay .top-bubble {
        height: 32px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--ad-border-strong);
        background: rgba(9, 9, 11, 0.68);
        backdrop-filter: blur(22px) saturate(1.12);
        display: flex;
        align-items: center;
        gap: 7px;
        cursor: pointer;
        box-shadow: 0 14px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08);
        pointer-events: auto;
      }
      .demo-anidachi-overlay.is-compact .top-bubble {
        height: 28px;
        padding: 0 8px;
        gap: 6px;
        background: rgba(9, 9, 11, 0.78);
      }
      .demo-anidachi-overlay .top-bubble-logo {
        width: 24px;
        height: 24px;
        flex: 0 0 auto;
        border-radius: 999px;
        object-fit: contain;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 5px 14px rgba(249,115,22,0.16);
      }
      .demo-anidachi-overlay.is-compact .top-bubble-logo {
        width: 18px;
        height: 18px;
      }
      .demo-anidachi-overlay .top-bubble-open-mic {
        width: 16px;
        height: 16px;
        margin-right: -2px;
        border-radius: 999px;
        color: rgba(255,255,255,0.68);
        display: grid;
        place-items: center;
      }
      .demo-anidachi-overlay .top-bubble-open-mic.speaking {
        color: rgba(134, 239, 172, 0.98);
        filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.56));
      }
      .demo-anidachi-overlay .sync-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #9ca3af;
      }
      .demo-anidachi-overlay .sync-dot.connected { background: #7dd3a7; }
      .demo-anidachi-overlay .sync-dot.warning { background: #fbbf24; }
      .demo-anidachi-overlay .bubble-count {
        font-size: 12px;
        font-weight: 650;
        color: rgba(255,255,255,0.93);
        line-height: 1;
      }
      .demo-anidachi-overlay.is-compact .bubble-count { font-size: 11px; }

      .demo-anidachi-overlay .mini-panel {
        position: absolute;
        top: 48px;
        right: 10px;
        width: min(324px, calc(100% - 20px));
        max-height: calc(100% - 58px);
        overflow: auto;
        padding: 13px;
        border-radius: 18px;
        border: 1px solid var(--ad-border);
        background:
          linear-gradient(180deg, rgba(23,22,25,0.94) 0%, rgba(9,9,11,0.84) 100%),
          rgba(10,10,12,0.82);
        backdrop-filter: blur(28px) saturate(1.12);
        box-shadow: 0 24px 70px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06);
        color: var(--ad-text);
        z-index: 30;
        scrollbar-width: none;
        pointer-events: auto;
        transform-origin: top right;
        transition: opacity 150ms ease, transform 150ms ease;
      }
      .demo-anidachi-overlay .mini-panel::-webkit-scrollbar { display: none; }
      .demo-anidachi-overlay.is-compact .mini-panel {
        top: 3.5%;
        right: 2.5%;
        width: 88%;
        max-height: 62%;
        padding: 12px;
        border-radius: 16px;
        backdrop-filter: blur(12px) saturate(1.12);
      }
      .demo-anidachi-overlay .mini-panel.is-closed {
        opacity: 0;
        transform: scale(0.95);
        pointer-events: none;
      }

      .demo-anidachi-overlay .panel-header {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        align-items: start;
        column-gap: 12px;
        min-height: 36px;
        margin-bottom: 10px;
        padding: 1px 1px 11px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .demo-anidachi-overlay .panel-account {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }
      .demo-anidachi-overlay .panel-account-avatar {
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        border-radius: 999px;
        display: grid;
        place-items: center;
        overflow: hidden;
        font-size: 12px;
        font-weight: 760;
        color: rgba(255,244,234,0.96);
        background:
          linear-gradient(135deg, rgba(255,138,61,0.34), rgba(255,255,255,0.08)),
          rgba(255,255,255,0.06);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.18);
      }
      .demo-anidachi-overlay.is-compact .panel-account-avatar {
        width: 28px;
        height: 28px;
      }
      .demo-anidachi-overlay .panel-account-copy {
        min-width: 0;
        display: grid;
        gap: 3px;
      }
      .demo-anidachi-overlay .panel-account-title-row {
        display: flex;
        align-items: baseline;
        gap: 4px;
        min-width: 0;
      }
      .demo-anidachi-overlay .panel-account-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 780;
        line-height: 1.1;
        color: var(--ad-text);
      }
      .demo-anidachi-overlay.is-compact .panel-account-name { font-size: 13px; }
      .demo-anidachi-overlay .panel-account-title-row .plan-badge {
        flex: 0 0 auto;
        padding: 0;
        border: 0;
        background: transparent;
        font-size: 8px;
        font-weight: 820;
        line-height: 1.1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255,205,166,0.94);
        transform: translateY(-2px);
      }
      .demo-anidachi-overlay .panel-room-summary,
      .demo-anidachi-overlay .panel-account-helper {
        color: rgba(255,255,255,0.5);
        font-size: 10.5px;
        font-weight: 650;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .demo-anidachi-overlay .panel-camera-control {
        position: relative;
        width: 48px;
        height: 26px;
        padding: 0;
        border-radius: 999px;
        border: 1px solid var(--ad-border);
        background: var(--ad-surface);
        cursor: default;
      }
      .demo-anidachi-overlay .panel-camera-control-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: rgba(255,255,255,0.09);
        box-shadow: inset 0 1px rgba(255,255,255,0.05);
        transform: translateX(22px);
        color: rgba(134,239,172,0.98);
      }

      .demo-anidachi-overlay .panel-actions {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 6px;
        min-height: 36px;
      }
      .demo-anidachi-overlay .ad-button {
        border: 1px solid var(--ad-border);
        background: var(--ad-surface);
        color: var(--ad-text);
        border-radius: 999px;
        height: 36px;
        padding: 0 11px;
        font-size: 12px;
        font-weight: 760;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }
      .demo-anidachi-overlay .ad-button.primary {
        flex: 1 1 auto;
        border-color: transparent;
        background: linear-gradient(135deg, #ffb15f, var(--ad-accent-strong));
        color: rgba(28,17,9,0.96);
        box-shadow: 0 10px 24px rgba(249,115,22,0.2);
      }
      .demo-anidachi-overlay .ad-button.primary.room-exit {
        border-color: rgba(248,113,113,0.24);
        background: rgba(51,35,37,0.88);
        color: rgba(255,255,255,0.9);
        box-shadow: none;
        flex-basis: 112px;
      }
      .demo-anidachi-overlay.is-compact .ad-button {
        height: 32px;
        font-size: 11px;
      }
      .demo-anidachi-overlay .panel-action-icons {
        display: flex;
        flex: 0 0 auto;
        gap: 6px;
      }
      .demo-anidachi-overlay .panel-icon-action {
        width: 36px;
        height: 36px;
        padding: 0;
        border-radius: 999px;
        border: 1px solid var(--ad-border);
        background: var(--ad-surface);
        color: rgba(255,255,255,0.78);
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .demo-anidachi-overlay.is-compact .panel-icon-action {
        width: 32px;
        height: 32px;
      }
      .demo-anidachi-overlay .panel-icon-action.success {
        border-color: rgba(52,211,153,0.38);
        background: rgba(34,197,94,0.1);
        color: rgba(110,231,183,0.96);
      }

      .demo-anidachi-overlay .section-title {
        margin: 14px 0 7px;
        font-size: 10px;
        font-weight: 760;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.58);
      }
      .demo-anidachi-overlay .settings-section-title {
        margin: 18px 0 2px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.07);
      }

      .demo-anidachi-overlay .room-people-section { margin-top: 12px; }
      .demo-anidachi-overlay .room-people-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .demo-anidachi-overlay .room-people-heading span:last-child {
        color: rgba(255,255,255,0.38);
        font-size: 10px;
        font-weight: 720;
        letter-spacing: 0;
        text-transform: none;
      }
      .demo-anidachi-overlay .room-people-list {
        display: grid;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.065);
        background: rgba(255,255,255,0.018);
      }
      .demo-anidachi-overlay .room-people-entry + .room-people-entry {
        border-top: 1px solid rgba(255,255,255,0.055);
      }
      .demo-anidachi-overlay .room-people-row {
        min-height: 50px;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 9px;
      }
      .demo-anidachi-overlay.is-compact .room-people-row {
        min-height: 42px;
        padding: 6px 8px;
      }
      .demo-anidachi-overlay .room-people-main {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
      }
      .demo-anidachi-overlay .room-people-avatar {
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        border-radius: 999px;
        overflow: hidden;
        display: grid;
        place-items: center;
        font-size: 10.5px;
        font-weight: 760;
        background: linear-gradient(135deg, rgba(255,138,61,0.24), rgba(255,255,255,0.08));
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
      }
      .demo-anidachi-overlay .room-people-row.host .room-people-avatar {
        border-color: rgba(255,138,61,0.18);
        background: rgba(255,138,61,0.11);
        color: rgba(255,235,220,0.96);
      }
      .demo-anidachi-overlay .room-people-row.speaking .room-people-avatar {
        box-shadow: 0 0 0 2px rgba(97,220,154,0.72);
      }
      .demo-anidachi-overlay .room-people-copy { min-width: 0; display: grid; gap: 2px; }
      .demo-anidachi-overlay .room-people-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(255,255,255,0.9);
        font-size: 12px;
        font-weight: 700;
      }
      .demo-anidachi-overlay .room-people-role {
        font-size: 8px;
        font-weight: 800;
        text-transform: uppercase;
        color: rgba(232,156,107,0.92);
      }
      .demo-anidachi-overlay .room-people-you {
        font-size: 8px;
        font-weight: 800;
        text-transform: uppercase;
        color: rgba(255,255,255,0.36);
      }
      .demo-anidachi-overlay .room-people-status {
        color: rgba(255,255,255,0.42);
        font-size: 9px;
        font-weight: 620;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .demo-anidachi-overlay .room-people-media-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .demo-anidachi-overlay .room-people-seat-status {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: rgba(255,255,255,0.5);
      }
      .demo-anidachi-overlay .room-people-camera-status {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .demo-anidachi-overlay .room-people-camera-status.active { color: rgba(134,239,172,0.9); }
      .demo-anidachi-overlay .room-people-camera-status.inactive { color: rgba(248,113,113,0.68); }
      .demo-anidachi-overlay .room-people-side {
        flex: 0 0 auto;
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-start;
        padding-top: 3px;
      }

      .demo-anidachi-overlay .settings-category-scroll {
        display: flex;
        gap: 18px;
        overflow-x: auto;
        padding: 0 1px 4px;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,138,61,0.28) rgba(255,255,255,0.04);
      }
      .demo-anidachi-overlay .settings-category-tab {
        position: relative;
        height: 32px;
        flex: 0 0 auto;
        padding: 0 2px;
        border: 0;
        background: transparent;
        color: rgba(255,255,255,0.58);
        cursor: pointer;
        pointer-events: auto;
        font-size: 10.5px;
        font-weight: 690;
      }
      .demo-anidachi-overlay .settings-category-tab.active {
        color: rgba(255,238,224,0.96);
      }
      .demo-anidachi-overlay .settings-category-tab.active::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 22px;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ffad63, var(--ad-accent-strong));
        box-shadow: 0 0 8px rgba(249,115,22,0.22);
        transform: translateX(-50%);
      }
      .demo-anidachi-overlay .toggle {
        width: 100%;
        min-height: 36px;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.105);
        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.028)), rgba(255,255,255,0.035);
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        cursor: default;
        font-size: 12px;
        font-weight: 650;
      }
      .demo-anidachi-overlay .reaction-shortcut-grid {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 6px;
        padding: 7px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.105);
        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.028)), rgba(255,255,255,0.035);
      }
      .demo-anidachi-overlay .reaction-shortcut {
        min-width: 0;
        height: 46px;
        padding: 5px 3px 6px;
        border: 1px solid transparent;
        border-radius: 9px;
        background: rgba(255,255,255,0.035);
        color: var(--ad-text);
        cursor: pointer;
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 4px;
      }
      .demo-anidachi-overlay.is-compact .reaction-shortcut { height: 38px; }
      .demo-anidachi-overlay .reaction-shortcut:disabled { opacity: 0.42; cursor: not-allowed; }
      .demo-anidachi-overlay .reaction-shortcut-key {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(0,0,0,0.2);
        color: rgba(255,255,255,0.5);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 760;
      }
      .demo-anidachi-overlay .reaction-shortcut-emoji { font-size: 17px; line-height: 1; }

      .demo-anidachi-overlay .cam-stack {
        position: absolute;
        right: 76px;
        bottom: 12%;
        display: flex;
        flex-direction: row-reverse;
        justify-content: flex-start;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
        z-index: 10;
      }
      .demo-anidachi-overlay.is-compact .cam-stack {
        right: 58px;
        bottom: 10%;
        gap: 6px;
      }
      .demo-anidachi-overlay .cam-bubble {
        width: 44px;
        height: 44px;
        border-radius: 999px;
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.24);
        background: rgba(15,15,28,0.82);
        box-shadow: 0 0 0 1px rgba(8,10,18,0.5), 0 10px 28px rgba(0,0,0,0.34);
        animation: cam-enter 0.2s ease-out;
      }
      .demo-anidachi-overlay.is-compact .cam-bubble {
        width: 36px;
        height: 36px;
      }
      .demo-anidachi-overlay .cam-bubble.speaking {
        border-color: rgba(125,255,202,0.92);
        box-shadow: 0 0 18px rgba(52,211,153,0.34), 0 10px 28px rgba(0,0,0,0.3);
      }

      .demo-anidachi-overlay .room-rail {
        position: absolute;
        top: 54px;
        right: 0;
        bottom: 92px;
        width: min(184px, calc(100% - 10px));
        z-index: 20;
        pointer-events: none;
      }
      .demo-anidachi-overlay.is-compact .room-rail {
        top: 38px;
        bottom: 72px;
        width: min(148px, calc(100% - 8px));
      }
      .demo-anidachi-overlay .room-rail-list {
        display: grid;
        justify-items: end;
        gap: 7px;
      }
      .demo-anidachi-overlay .room-rail-slot {
        position: relative;
        min-height: 42px;
        width: 176px;
      }
      .demo-anidachi-overlay.is-compact .room-rail-slot { width: 140px; min-height: 36px; }
      .demo-anidachi-overlay .room-rail-pill {
        position: absolute;
        top: 50%;
        right: 0;
        width: 0;
        height: 40px;
        padding: 0;
        border: 0 solid transparent;
        border-radius: 999px 0 0 999px;
        background: transparent;
        color: rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        gap: 7px;
        opacity: 0;
        overflow: hidden;
        transform: translateY(-50%);
        transition: width 260ms cubic-bezier(0.2,0.8,0.2,1), padding 260ms cubic-bezier(0.2,0.8,0.2,1), opacity 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
      }
      .demo-anidachi-overlay.is-compact .room-rail-pill { height: 34px; }
      .demo-anidachi-overlay .room-rail.open .room-rail-pill {
        width: 162px;
        padding: 4px 8px 4px 4px;
        border-width: 1px;
        border-color: rgba(255,255,255,0.12);
        background: rgba(13,13,16,0.74);
        opacity: 1;
        box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06);
      }
      .demo-anidachi-overlay.is-compact .room-rail.open .room-rail-pill { width: 128px; }
      .demo-anidachi-overlay .room-rail-pill.speaking {
        width: 64px;
        padding: 4px 8px 4px 4px;
        border-width: 1px;
        border-color: rgba(125,211,167,0.58);
        background: linear-gradient(90deg, rgba(34,197,94,0.15), rgba(13,13,16,0.74)), rgba(13,13,16,0.74);
        opacity: 1;
        box-shadow: 0 0 20px rgba(34,197,94,0.22), 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06);
      }
      .demo-anidachi-overlay.is-compact .room-rail-pill.speaking { width: 52px; }
      .demo-anidachi-overlay .room-rail.open .room-rail-pill.speaking { width: 162px; }
      .demo-anidachi-overlay.is-compact .room-rail.open .room-rail-pill.speaking { width: 128px; }
      .demo-anidachi-overlay .room-rail-avatar {
        width: 31px;
        height: 31px;
        flex: 0 0 auto;
        border-radius: 999px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.9);
        font-size: 11px;
        font-weight: 820;
      }
      .demo-anidachi-overlay.is-compact .room-rail-avatar { width: 26px; height: 26px; font-size: 9px; }
      .demo-anidachi-overlay .room-rail-pill.speaking .room-rail-avatar {
        border-color: rgba(125,211,167,0.82);
        background: rgba(34,197,94,0.14);
        color: rgba(220,252,231,0.98);
        animation: anidachi-room-rail-avatar-pulse 1100ms ease-in-out infinite;
      }
      .demo-anidachi-overlay .room-rail-voice-bars {
        width: 17px;
        height: 17px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        opacity: 0;
      }
      .demo-anidachi-overlay .room-rail-pill.speaking .room-rail-voice-bars { opacity: 1; }
      .demo-anidachi-overlay .room-rail-voice-bars i {
        width: 3px;
        height: 5px;
        border-radius: 999px;
        background: rgba(125,211,167,0.96);
      }
      .demo-anidachi-overlay .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(1) {
        animation: anidachi-room-rail-bar-1 680ms ease-in-out infinite;
      }
      .demo-anidachi-overlay .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(2) {
        animation: anidachi-room-rail-bar-2 620ms ease-in-out infinite;
      }
      .demo-anidachi-overlay .room-rail-pill.speaking .room-rail-voice-bars i:nth-child(3) {
        animation: anidachi-room-rail-bar-3 740ms ease-in-out infinite;
      }
      .demo-anidachi-overlay .room-rail-copy {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 1px;
        opacity: 0;
        transform: translateX(8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .demo-anidachi-overlay .room-rail.open .room-rail-copy {
        opacity: 1;
        transform: translateX(0);
      }
      .demo-anidachi-overlay .room-rail-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(255,255,255,0.94);
        font-size: 11.5px;
        font-weight: 760;
        line-height: 1.1;
      }
      .demo-anidachi-overlay .room-rail-status {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(255,255,255,0.54);
        font-size: 9.5px;
        font-weight: 650;
        line-height: 1.1;
      }
      .demo-anidachi-overlay .room-rail-slot.speaking .room-rail-status {
        color: rgba(255,200,164,0.78);
      }

      .demo-anidachi-overlay .live-chat-column {
        position: absolute;
        left: 12px;
        top: 46%;
        width: min(205px, 42%);
        max-height: 38%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
        overflow: hidden;
        pointer-events: none;
        z-index: 10;
        mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 8px), transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 8px), transparent 100%);
      }
      .demo-anidachi-overlay.is-compact .live-chat-column {
        left: 3%;
        top: auto;
        bottom: 28%;
        width: 68%;
        max-height: 26%;
      }
      .demo-anidachi-overlay .live-chat-message {
        max-width: 100%;
        display: grid;
        justify-items: start;
        gap: 1px;
        animation: demo-chat-in 180ms ease-out both;
        text-shadow: 0 1px 1px rgba(0,0,0,0.86), 0 0 2px rgba(0,0,0,0.7), 0 0 5px rgba(0,0,0,0.35);
      }
      .demo-anidachi-overlay .live-chat-name {
        display: block;
        max-width: 100%;
        font-size: 10px;
        font-weight: 760;
        line-height: 1.1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .demo-anidachi-overlay .live-chat-text {
        color: rgba(255,255,255,0.92);
        font-size: 13px;
        line-height: 16px;
        font-weight: 660;
      }
      .demo-anidachi-overlay.is-compact .live-chat-text { font-size: 11px; line-height: 14px; }

      .demo-anidachi-overlay .message-composer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: clamp(56px, 12%, 92px);
        width: min(430px, calc(100% - 36px));
        min-height: 44px;
        margin: 0 auto;
        padding: 6px;
        border-radius: 18px;
        border: 1px solid var(--ad-border);
        background: rgba(9,9,11,0.82);
        backdrop-filter: blur(26px) saturate(1.1);
        box-shadow: 0 18px 56px rgba(0,0,0,0.34);
        display: flex;
        align-items: center;
        gap: 7px;
        pointer-events: none;
        z-index: 15;
        animation: demo-composer-in 220ms ease-out both;
      }
      .demo-anidachi-overlay.is-compact .message-composer {
        width: min(92%, 280px);
        min-height: 38px;
        padding: 4px;
        border-radius: 14px;
        bottom: 14%;
      }
      .demo-anidachi-overlay .message-composer-emoji-button {
        width: 34px;
        height: 34px;
        border: 1px solid var(--ad-border);
        border-radius: 999px;
        background: var(--ad-surface);
        color: rgba(255,255,255,0.72);
        display: grid;
        place-items: center;
        flex: 0 0 auto;
      }
      .demo-anidachi-overlay.is-compact .message-composer-emoji-button {
        width: 28px;
        height: 28px;
      }
      .demo-anidachi-overlay .message-composer-placeholder {
        min-width: 0;
        flex: 1;
        color: rgba(255,255,255,0.38);
        font-size: 13px;
        font-weight: 620;
      }
      .demo-anidachi-overlay.is-compact .message-composer-placeholder { font-size: 11px; }
      .demo-anidachi-overlay .message-composer-send {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffb15f, var(--ad-accent-strong));
        color: rgba(28,17,9,0.96);
        display: grid;
        place-items: center;
        opacity: 0.42;
        flex: 0 0 auto;
      }
      .demo-anidachi-overlay.is-compact .message-composer-send {
        width: 28px;
        height: 28px;
      }

      .demo-anidachi-overlay .catch-up {
        position: absolute;
        left: 50%;
        bottom: 32px;
        transform: translateX(-50%);
        min-height: 36px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(251,191,36,0.34);
        background: rgba(26,18,8,0.62);
        backdrop-filter: blur(18px);
        display: flex;
        align-items: center;
        gap: 9px;
        pointer-events: auto;
        font-size: 13px;
        font-weight: 680;
        z-index: 20;
        white-space: nowrap;
      }
      .demo-anidachi-overlay.is-compact .catch-up {
        bottom: 12%;
        min-height: 32px;
        padding: 0 10px;
        font-size: 11px;
        max-width: calc(100% - 12px);
      }
      .demo-anidachi-overlay .catch-up .ad-button.primary {
        height: 26px;
        flex: 0 0 auto;
        padding: 0 10px;
        font-size: 11px;
        box-shadow: none;
      }

      .demo-anidachi-overlay .layout-editor-v2 {
        min-width: 0;
        display: grid;
        gap: 10px;
      }
      .demo-anidachi-overlay .layout-preview-v2 {
        box-sizing: border-box;
        width: 100%;
        aspect-ratio: 16 / 9;
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.11);
        border-radius: 8px;
        background-color: rgba(5,5,8,0.78);
        background-image: linear-gradient(180deg, rgba(255,255,255,0.045), transparent 54%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), inset 0 0 0 9px rgba(0,0,0,0.08);
      }
      .demo-anidachi-overlay .layout-grid-preview-v2 {
        position: absolute;
        inset: 4%;
        z-index: 0;
        background-image:
          repeating-linear-gradient(to right, transparent 0, transparent calc(8.333% - 1px), rgba(255,255,255,0.04) calc(8.333% - 1px), rgba(255,255,255,0.04) 8.333%),
          repeating-linear-gradient(to bottom, transparent 0, transparent calc(12.5% - 1px), rgba(255,255,255,0.04) calc(12.5% - 1px), rgba(255,255,255,0.04) 12.5%);
        pointer-events: none;
      }
      .demo-anidachi-overlay .layout-video-slot-v2 {
        position: absolute;
        z-index: 2;
        box-sizing: border-box;
        border-radius: 999px;
        border: 1px solid rgba(110,231,183,0.52);
        background: linear-gradient(145deg, rgba(52,211,153,0.32), rgba(15,118,110,0.16)), rgba(10,22,19,0.86);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.28);
        padding: 0;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .demo-anidachi-overlay .layout-preview-v2.is-animating .layout-video-slot-v2,
      .demo-anidachi-overlay .layout-preview-v2.is-animating .layout-chat-preview-v2 {
        transition:
          right 700ms cubic-bezier(0.22, 1, 0.36, 1),
          bottom 700ms cubic-bezier(0.22, 1, 0.36, 1),
          left 700ms cubic-bezier(0.22, 1, 0.36, 1),
          top 700ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .demo-anidachi-overlay .layout-preview-v2.is-dragging .layout-video-slot-v2.is-leader,
      .demo-anidachi-overlay .layout-preview-v2.is-dragging .layout-chat-preview-v2 {
        cursor: grabbing;
        transition: none;
        z-index: 5;
      }
      .demo-anidachi-overlay .layout-video-slot-v2.is-ghost {
        z-index: 1;
        opacity: 0.42;
        border-color: rgba(110,231,183,0.3);
        box-shadow: none;
        pointer-events: none;
      }
      .demo-anidachi-overlay .layout-video-slot-v2.is-leader[data-selected="true"] {
        border-color: rgba(255,166,92,0.92);
        box-shadow: 0 0 0 2px rgba(249,115,22,0.2), 0 10px 22px rgba(0,0,0,0.32);
      }
      .demo-anidachi-overlay .layout-chat-preview-v2 {
        position: absolute;
        z-index: 3;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-start;
        gap: 3px;
        min-width: 0;
        padding: 7px;
        border: 1px solid rgba(125,184,255,0.42);
        border-radius: 7px;
        background: linear-gradient(180deg, rgba(71,120,188,0.14), rgba(28,51,82,0.22)), rgba(7,12,20,0.82);
        box-shadow: 0 8px 20px rgba(0,0,0,0.24);
        cursor: grab;
        touch-action: none;
        user-select: none;
        text-align: left;
      }
      .demo-anidachi-overlay .layout-chat-preview-v2[data-selected="true"] {
        border-color: rgba(255,166,92,0.88);
        box-shadow: 0 0 0 2px rgba(249,115,22,0.18), 0 10px 22px rgba(0,0,0,0.28);
      }
      .demo-anidachi-overlay .layout-chat-preview-v2 .live-chat-name {
        font-size: 8px;
      }
      .demo-anidachi-overlay .layout-chat-preview-v2 .live-chat-text {
        font-size: 9px;
        line-height: 11px;
      }
      .demo-anidachi-overlay .layout-object-selector-v2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 3px;
        border: 1px solid rgba(255,255,255,0.075);
        border-radius: 8px;
        background: rgba(255,255,255,0.025);
      }
      .demo-anidachi-overlay .layout-object-selector-v2 button {
        min-width: 0;
        height: 30px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: rgba(255,255,255,0.52);
        cursor: pointer;
        font-size: 11px;
        font-weight: 740;
      }
      .demo-anidachi-overlay .layout-object-selector-v2 button[aria-pressed="true"] {
        border-color: rgba(255,138,61,0.28);
        background: rgba(249,115,22,0.13);
        color: rgba(255,229,209,0.96);
      }
      .demo-anidachi-overlay .layout-controls-v2 { display: grid; gap: 8px; }
      .demo-anidachi-overlay .stepped-setting-slider-v2 {
        min-width: 0;
        display: grid;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid rgba(255,255,255,0.085);
        border-radius: 7px;
        background: rgba(255,255,255,0.03);
      }
      .demo-anidachi-overlay .stepped-setting-slider-header-v2 {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        font-size: 11px;
        font-weight: 690;
      }
      .demo-anidachi-overlay .stepped-setting-slider-header-v2 strong {
        color: rgba(255,181,116,0.86);
        font-size: 10px;
        font-weight: 710;
      }
      .demo-anidachi-overlay .stepped-setting-slider-input-v2 {
        width: 100%;
        height: 18px;
        margin: 0;
        appearance: none;
        background: transparent;
        cursor: pointer;
      }
      .demo-anidachi-overlay .stepped-setting-slider-input-v2::-webkit-slider-runnable-track {
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ffad63 0, var(--ad-accent-strong) var(--setting-slider-progress), rgba(255,255,255,0.13) var(--setting-slider-progress), rgba(255,255,255,0.13) 100%);
      }
      .demo-anidachi-overlay .stepped-setting-slider-input-v2::-webkit-slider-thumb {
        width: 14px;
        height: 14px;
        margin-top: -5.5px;
        appearance: none;
        border: 2px solid rgba(255,255,255,0.92);
        border-radius: 999px;
        background: var(--ad-accent);
        box-shadow: 0 3px 10px rgba(0,0,0,0.42);
      }
      .demo-anidachi-overlay .stepped-setting-slider-endpoints-v2 {
        display: flex;
        justify-content: space-between;
        color: rgba(255,255,255,0.38);
        font-size: 8px;
        font-weight: 650;
      }
      .demo-anidachi-overlay .layout-editor-actions-v2 {
        display: grid;
        grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
        gap: 6px;
      }
      .demo-anidachi-overlay .layout-editor-actions-v2 button {
        height: 34px;
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 7px;
        background: rgba(255,255,255,0.035);
        color: rgba(255,255,255,0.58);
        cursor: pointer;
        font-size: 11px;
        font-weight: 750;
      }
      .demo-anidachi-overlay .layout-editor-actions-v2 button:last-child {
        border-color: rgba(255,138,61,0.38);
        background: linear-gradient(180deg, rgba(255,161,86,0.94), rgba(249,115,22,0.94)), #f97316;
        color: rgba(18,8,3,0.96);
      }
      .demo-anidachi-overlay .layout-editor-actions-v2 button:disabled {
        cursor: default;
        opacity: 0.42;
      }
      .demo-anidachi-overlay .mode-control {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 36px;
        padding: 0 10px;
        border: 1px solid rgba(255,255,255,0.085);
        border-radius: 7px;
        font-size: 11px;
        font-weight: 690;
      }
      .demo-anidachi-overlay .segmented-control {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
      }
      .demo-anidachi-overlay .segmented-control button {
        height: 24px;
        padding: 0 9px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: rgba(255,255,255,0.52);
        cursor: pointer;
        font-size: 10px;
        font-weight: 740;
      }
      .demo-anidachi-overlay .segmented-control button.selected {
        background: rgba(249,115,22,0.18);
        color: rgba(255,229,209,0.96);
      }
      .demo-anidachi-overlay.is-compact .layout-preview-v2 {
        max-height: 118px;
      }
      .demo-anidachi-overlay .overlay-layout-ghost-preview {
        position: absolute;
        inset: 0;
        z-index: 19;
        overflow: hidden;
        pointer-events: none;
      }
      .demo-anidachi-overlay .overlay-layout-camera-ghost {
        position: absolute;
        border: 1px dashed rgba(110,231,183,0.82);
        border-radius: 999px;
        background: rgba(16,185,129,0.2);
        box-shadow: inset 0 0 0 1px rgba(236,253,245,0.12), 0 8px 24px rgba(0,0,0,0.22);
        opacity: 0.82;
      }
      .demo-anidachi-overlay .overlay-layout-ghost-preview.is-animating .overlay-layout-camera-ghost,
      .demo-anidachi-overlay .overlay-layout-ghost-preview.is-animating .layout-chat-preview-shell {
        transition:
          left 700ms cubic-bezier(0.22, 1, 0.36, 1),
          right 700ms cubic-bezier(0.22, 1, 0.36, 1),
          top 700ms cubic-bezier(0.22, 1, 0.36, 1),
          bottom 700ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .demo-anidachi-overlay .overlay-layout-ghost-preview.is-dragging .overlay-layout-camera-ghost,
      .demo-anidachi-overlay .overlay-layout-ghost-preview.is-dragging .layout-chat-preview-shell {
        transition: none;
      }
      .demo-anidachi-overlay .overlay-layout-camera-ghost.is-leader {
        border-style: solid;
        background: rgba(16,185,129,0.26);
        opacity: 0.9;
      }
      .demo-anidachi-overlay .layout-chat-preview-shell {
        position: absolute;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: stretch;
        gap: 5px;
        padding: 8px 10px;
        overflow: hidden;
        border: 1px dashed rgba(147,197,253,0.92);
        border-radius: 10px;
        background: rgba(30,64,175,0.22);
        box-shadow: 0 10px 28px rgba(0,0,0,0.2);
      }
      .demo-anidachi-overlay .settings-category-tab { cursor: pointer; }
    `}</style>
  );
}

function TopBubble({
  connected,
  warning,
  count,
  onClick,
  compact = false,
  showEdgeGlow = false,
  openMic = false,
  speaking = false,
}: {
  connected: boolean;
  warning?: boolean;
  count: number;
  onClick: () => void;
  compact?: boolean;
  showEdgeGlow?: boolean;
  openMic?: boolean;
  speaking?: boolean;
}) {
  const syncClass = warning ? "warning" : connected ? "connected" : "";

  return (
    <div className="relative">
      {showEdgeGlow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 right-0 h-0 w-[104px] rounded-full"
          style={{
            boxShadow:
              "0 3px 12px 6px rgba(255, 92, 20, 0.56), 0 13px 32px 12px rgba(249, 115, 22, 0.34)",
            animation: "demo-edge-glow 1.1s ease-out both",
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        className="top-bubble relative z-[1] transition-transform active:scale-95"
        aria-label={openMic ? "Open Anidachi controls. Open mic is on" : "Open Anidachi controls"}
      >
        <AnidachiLogo
          size={compact ? 18 : 24}
          alt=""
          className="top-bubble-logo"
          aria-hidden
        />
        {openMic ? (
          <span
            aria-hidden
            className={`top-bubble-open-mic ${speaking ? "speaking" : ""}`}
          >
            <Mic size={11} />
          </span>
        ) : null}
        <span className={`sync-dot ${syncClass}`} />
        <span className="bubble-count">{count}</span>
      </button>
    </div>
  );
}

function ParticipantAvatar({
  p,
  size = 44,
  className = "",
  forceAvatar = false,
}: {
  p: Participant;
  size?: number;
  className?: string;
  forceAvatar?: boolean;
}) {
  const src = forceAvatar || p.cameraEnabled ? p.avatarUrl : undefined;
  if (src) {
    return (
      <Image
        src={src}
        alt={p.displayName}
        width={size}
        height={size}
        className={`object-cover w-full h-full ${className}`}
        sizes={`${size}px`}
      />
    );
  }
  return (
    <div
      className={`w-full h-full grid place-items-center font-extrabold text-white/90 ${className}`}
      style={{ fontSize: size <= 28 ? 10 : 13 }}
    >
      {p.initials}
    </div>
  );
}

function CamBubble({
  p,
  speaking,
}: {
  p: Participant;
  speaking?: boolean;
}) {
  return (
    <div
      className={`cam-bubble ${speaking ? "speaking" : ""}`}
      title={p.displayName}
    >
      <ParticipantAvatar p={p} size={44} />
    </div>
  );
}

function RoomRail({
  participants,
  speakingId,
  open,
}: {
  participants: Participant[];
  speakingId?: string | null;
  open: boolean;
}) {
  if (!participants.length) return null;

  return (
    <div className={`room-rail ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="room-rail-list">
        {participants.map((p) => {
          const liveSpeaking = speakingId ? speakingId === p.id : Boolean(p.speaking);
          const roleLabel = p.role === "host" ? "host" : "guest";
          const statusLabel = liveSpeaking ? `${roleLabel} · speaking` : roleLabel;
          return (
            <div
              key={p.id}
              className={`room-rail-slot ${liveSpeaking ? "speaking" : ""}`}
            >
              <div className={`room-rail-pill ${liveSpeaking ? "speaking" : ""}`}>
                <span className="room-rail-avatar">
                  {p.cameraEnabled ? (
                    <ParticipantAvatar p={p} size={31} forceAvatar />
                  ) : (
                    p.initials
                  )}
                </span>
                <span className="room-rail-voice-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="room-rail-copy">
                  <span className="room-rail-name">{p.displayName}</span>
                  <span className="room-rail-status">{statusLabel}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveChatColumn({
  messages,
}: {
  messages: LiveChatLine[];
}) {
  if (!messages.length) return null;
  return (
    <div className="live-chat-column">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className="live-chat-message"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="live-chat-name" style={{ color: msg.color }}>
            {msg.name}
          </span>
          <span className="live-chat-text">{msg.text}</span>
        </div>
      ))}
    </div>
  );
}

function MessageComposerPeek() {
  return (
    <div className="message-composer">
      <span className="message-composer-emoji-button">
        <SmilePlus size={17} strokeWidth={2.2} />
      </span>
      <span className="message-composer-placeholder">Say something…</span>
      <span className="message-composer-send">
        <SendHorizontal size={15} />
      </span>
    </div>
  );
}

function PeopleMediaStatus({ p }: { p: Participant }) {
  if (!p.cameraEnabled && p.role !== "host") {
    return <span className="room-people-status">Chat only</span>;
  }
  const CameraIcon = p.cameraEnabled ? Video : VideoOff;
  return (
    <span className="room-people-status">
      <span className="room-people-media-status">
        <span className="room-people-seat-status">
          <Radio aria-hidden size={10} />
          Media seat
        </span>
        <span
          className={`room-people-camera-status ${p.cameraEnabled ? "active" : "inactive"}`}
          title={p.cameraEnabled ? "Camera on" : "Camera off"}
        >
          <CameraIcon aria-hidden size={10} />
        </span>
      </span>
    </span>
  );
}

const LAYOUT_CHAT_PREVIEW = [
  { color: "#c4a7ff", name: "Mika", text: "That scene was perfect." },
  { color: "#8bd5ca", name: "Ren", text: "Wait for the next part..." },
  { color: "#f5bde6", name: "You", text: "No way." },
] as const;

const CAM_SIZE_STEPS = [
  { label: "Small", pct: 11 },
  { label: "Normal", pct: 13.5 },
  { label: "Large", pct: 16.5 },
  { label: "XL", pct: 19 },
] as const;

type LayoutDraft = {
  video: { right: number; bottom: number };
  chat: { left: number; top: number };
};

const DEFAULT_LAYOUT_DRAFT: LayoutDraft = {
  video: { right: 5, bottom: 14 },
  chat: { left: 5, top: 46 },
};

const LAYOUT_CAM_DRAG = { right: 26, bottom: 34 };
const LAYOUT_CHAT_DRAG = { left: 7, top: 12 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function DemoLayoutEditor({
  active,
  draft,
  onDraftChange,
  onDraggingChange,
}: {
  active: boolean;
  draft: LayoutDraft;
  onDraftChange: (draft: LayoutDraft) => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const dragRef = useRef<{
    object: "video" | "chat";
    startX: number;
    startY: number;
    origin: LayoutDraft;
    width: number;
    height: number;
  } | null>(null);
  const [selectedObject, setSelectedObject] = useState<"video" | "chat">("video");
  const [sizeStep, setSizeStep] = useState(1);
  const [chatMode, setChatMode] = useState<"live" | "history">("live");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);

  draftRef.current = draft;

  const choreographyTimers = useRef<number[]>([]);

  const setDraggingState = (next: boolean) => {
    setDragging(next);
    onDraggingChange?.(next);
  };

  const stopChoreography = () => {
    choreographyTimers.current.forEach((id) => window.clearTimeout(id));
    choreographyTimers.current = [];
    setAnimating(false);
  };

  useEffect(() => {
    if (!active) return;
    setSelectedObject("video");
    setSizeStep(1);
    setChatMode("live");
    setDirty(false);
    setAnimating(true);
    onDraftChange(DEFAULT_LAYOUT_DRAFT);
    rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timers = [
      window.setTimeout(() => {
        setSizeStep(2);
        setDirty(true);
      }, 450),
      window.setTimeout(() => {
        onDraftChange({
          video: LAYOUT_CAM_DRAG,
          chat: DEFAULT_LAYOUT_DRAFT.chat,
        });
        setDirty(true);
      }, 700),
      window.setTimeout(() => setSelectedObject("chat"), 1500),
      window.setTimeout(() => {
        onDraftChange({
          video: LAYOUT_CAM_DRAG,
          chat: LAYOUT_CHAT_DRAG,
        });
        setDirty(true);
      }, 1650),
      window.setTimeout(() => {
        setDirty(false);
        setAnimating(false);
      }, 2800),
    ];
    choreographyTimers.current = timers;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      choreographyTimers.current = [];
      setAnimating(false);
      onDraggingChange?.(false);
    };
  }, [active, onDraftChange, onDraggingChange]);

  const beginDrag = (object: "video" | "chat", event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const preview = previewRef.current;
    if (!preview) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopChoreography();
    setSelectedObject(object);
    setDraggingState(true);
    const rect = preview.getBoundingClientRect();
    dragRef.current = {
      object,
      startX: event.clientX,
      startY: event.clientY,
      origin: draftRef.current,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    };
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const session = dragRef.current;
    if (!session) return;
    const dxPct = ((event.clientX - session.startX) / session.width) * 100;
    const dyPct = ((event.clientY - session.startY) / session.height) * 100;
    if (session.object === "video") {
      onDraftChange({
        ...session.origin,
        video: {
          right: clamp(session.origin.video.right - dxPct, 2, 52),
          bottom: clamp(session.origin.video.bottom - dyPct, 4, 58),
        },
      });
    } else {
      onDraftChange({
        ...session.origin,
        chat: {
          left: clamp(session.origin.chat.left + dxPct, 2, 58),
          top: clamp(session.origin.chat.top + dyPct, 4, 52),
        },
      });
    }
    setDirty(true);
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDraggingState(false);
  };

  const sizePct = CAM_SIZE_STEPS[sizeStep]?.pct ?? 13.5;
  const sizeLabel = CAM_SIZE_STEPS[sizeStep]?.label ?? "Normal";
  const sliderProgress = `${(sizeStep / (CAM_SIZE_STEPS.length - 1)) * 100}%`;

  return (
    <section ref={rootRef} className="layout-editor-v2" aria-label="Overlay layout editor">
      <div
        ref={previewRef}
        className={`layout-preview-v2 ${animating ? "is-animating" : ""} ${dragging ? "is-dragging" : ""}`}
        aria-label="Overlay layout preview"
      >
        <div className="layout-grid-preview-v2" aria-hidden="true" />
        {[0, 1, 2, 3].map((index) => {
          const isLeader = index === 0;
          const style = {
            width: `${sizePct}%`,
            height: `${sizePct * (16 / 9)}%`,
            right: `${draft.video.right + index * (sizePct + 2.2)}%`,
            bottom: `${draft.video.bottom}%`,
          };
          if (!isLeader) {
            return (
              <div
                key={index}
                aria-hidden="true"
                className="layout-video-slot-v2 is-ghost"
                style={style}
              />
            );
          }
          return (
            <button
              key={index}
              type="button"
              aria-label="Move video"
              data-layout-object="video"
              className="layout-video-slot-v2 is-leader"
              data-selected={selectedObject === "video" ? "true" : "false"}
              onClick={() => setSelectedObject("video")}
              onPointerDown={(event) => beginDrag("video", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={style}
            />
          );
        })}
        <button
          type="button"
          aria-label="Move chat"
          data-layout-object="chat"
          className="layout-chat-preview-v2"
          data-selected={selectedObject === "chat" ? "true" : "false"}
          onClick={() => setSelectedObject("chat")}
          onPointerDown={(event) => beginDrag("chat", event)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            left: `${draft.chat.left}%`,
            top: `${draft.chat.top}%`,
            width: "36%",
            height: "38%",
          }}
        >
          {LAYOUT_CHAT_PREVIEW.map((msg) => (
            <div className="live-chat-message" key={msg.name}>
              <span className="live-chat-name" style={{ color: msg.color }}>
                {msg.name}
              </span>
              <span className="live-chat-text">{msg.text}</span>
            </div>
          ))}
        </button>
      </div>

      <div className="layout-object-selector-v2" role="group" aria-label="Layout object">
        <button
          type="button"
          aria-pressed={selectedObject === "video"}
          onClick={() => setSelectedObject("video")}
        >
          Video
        </button>
        <button
          type="button"
          aria-pressed={selectedObject === "chat"}
          onClick={() => setSelectedObject("chat")}
        >
          Chat
        </button>
      </div>

      {selectedObject === "video" ? (
        <div className="layout-controls-v2">
          <div
            className="stepped-setting-slider-v2"
            style={{ ["--setting-slider-progress" as string]: sliderProgress }}
          >
            <div className="stepped-setting-slider-header-v2">
              <span>Camera size</span>
              <strong>{sizeLabel}</strong>
            </div>
            <input
              className="stepped-setting-slider-input-v2"
              type="range"
              min={0}
              max={CAM_SIZE_STEPS.length - 1}
              value={sizeStep}
              aria-label="Camera size"
              onChange={(event) => {
                setSizeStep(Number(event.currentTarget.value));
                setDirty(true);
              }}
            />
            <div className="stepped-setting-slider-endpoints-v2">
              <span>Small</span>
              <span>XL</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="layout-controls-v2">
          <div className="mode-control">
            <span>Chat mode</span>
            <div className="segmented-control" role="group" aria-label="Chat display mode">
              <button
                type="button"
                className={chatMode === "live" ? "selected" : ""}
                aria-pressed={chatMode === "live"}
                onClick={() => {
                  setChatMode("live");
                  setDirty(true);
                }}
              >
                Live
              </button>
              <button
                type="button"
                className={chatMode === "history" ? "selected" : ""}
                aria-pressed={chatMode === "history"}
                onClick={() => {
                  setChatMode("history");
                  setDirty(true);
                }}
              >
                History
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="layout-editor-actions-v2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            setSizeStep(1);
            setChatMode("live");
            onDraftChange(DEFAULT_LAYOUT_DRAFT);
            setDirty(false);
          }}
        >
          Revert
        </button>
        <button type="button" disabled={!dirty} onClick={() => setDirty(false)}>
          Apply
        </button>
      </div>
    </section>
  );
}

function LayoutGhostPreview({
  occupiedCameraSlots,
  showChatPlaceholder,
  compact = false,
  draft,
  animating = false,
  dragging = false,
}: {
  occupiedCameraSlots: number;
  showChatPlaceholder: boolean;
  compact?: boolean;
  draft: LayoutDraft;
  animating?: boolean;
  dragging?: boolean;
}) {
  const camSize = compact ? 36 : 52;
  const camGap = compact ? 7 : 7;
  const videoRight =
    (compact ? 6 : 30) + (draft.video.right - DEFAULT_LAYOUT_DRAFT.video.right);
  const videoBottom =
    (compact ? 10 : 12) + (draft.video.bottom - DEFAULT_LAYOUT_DRAFT.video.bottom);
  return (
    <div
      className={`overlay-layout-ghost-preview ${animating ? "is-animating" : ""} ${dragging ? "is-dragging" : ""}`}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((index) =>
        index < occupiedCameraSlots ? null : (
          <div
            key={index}
            className={`overlay-layout-camera-ghost ${index === 0 ? "is-leader" : ""}`}
            style={{
              width: camSize,
              height: camSize,
              right: `${videoRight + index * camGap}%`,
              bottom: `${videoBottom}%`,
            }}
          />
        ),
      )}
      {showChatPlaceholder ? (
        <div
          className="layout-chat-preview-shell"
          style={{
            left: `${draft.chat.left}%`,
            top: `${draft.chat.top}%`,
            width: compact ? 148 : 220,
            height: compact ? 86 : 128,
          }}
        >
          {LAYOUT_CHAT_PREVIEW.map((msg) => (
            <div className="live-chat-message" key={msg.name}>
              <span className="live-chat-name" style={{ color: msg.color }}>
                {msg.name}
              </span>
              <span className="live-chat-text">{msg.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniPanel({
  open,
  roomActive,
  participants,
  onCreateRoom,
  onCopyInvite,
  onSyncNow,
  onReact,
  copied,
  speakingId,
  settingsTab,
  onSettingsTabChange,
  layoutDraft,
  onLayoutDraftChange,
  onLayoutDraggingChange,
}: {
  open: boolean;
  roomActive: boolean;
  participants: Participant[];
  onCreateRoom: () => void;
  onCopyInvite: () => void;
  onSyncNow: () => void;
  onReact: (emoji: string) => void;
  copied: boolean;
  speakingId?: string | null;
  settingsTab: (typeof SETTINGS_TABS)[number];
  onSettingsTabChange: (tab: (typeof SETTINGS_TABS)[number]) => void;
  layoutDraft: LayoutDraft;
  onLayoutDraftChange: (draft: LayoutDraft) => void;
  onLayoutDraggingChange: (dragging: boolean) => void;
}) {
  const people = participants.length ? participants : [FRIENDS[0]];
  const mediaSeats = Math.min(
    4,
    people.filter((p) => p.cameraEnabled).length || (roomActive ? 1 : 0),
  );

  return (
    <div
      className={`mini-panel ${open ? "" : "is-closed"}`}
      aria-hidden={!open}
    >
      <div className="panel-header">
        <div className="panel-account">
          <span className="panel-account-avatar">{FRIENDS[0].initials}</span>
          <div className="panel-account-copy">
            <div className="panel-account-title-row">
              <strong className="panel-account-name">You</strong>
              <span className="plan-badge plus">Plus</span>
            </div>
            {roomActive ? (
              <span className="panel-room-summary">{mediaSeats} of 4 media seats</span>
            ) : (
              <span className="panel-account-helper">Create rooms and invite friends</span>
            )}
          </div>
        </div>
        {roomActive ? (
          <button
            type="button"
            className="panel-camera-control"
            aria-label="Camera on"
            title="Camera on"
          >
            <span className="panel-camera-control-thumb">
              <Video size={12} />
            </span>
          </button>
        ) : null}
      </div>

      <div className="panel-actions">
        <button
          type="button"
          onClick={onCreateRoom}
          className={`ad-button primary ${roomActive ? "room-exit" : ""}`}
        >
          {roomActive ? "Leave room" : "Create room"}
        </button>
        {roomActive ? (
          <div className="panel-action-icons" role="group" aria-label="Room actions">
            <button
              type="button"
              onClick={onCopyInvite}
              aria-label={copied ? "Invite copied" : "Copy invite"}
              title={copied ? "Invite copied" : "Copy invite"}
              className={`panel-icon-action ${copied ? "success" : ""}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              aria-label="Invite friends and groups"
              title="Invite friends and groups"
              className="panel-icon-action"
            >
              <UserPlus size={14} />
            </button>
            <button
              type="button"
              onClick={onSyncNow}
              aria-label="Sync now"
              title="Sync now"
              className="panel-icon-action"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {roomActive && settingsTab !== "Layout" ? (
        <section className="room-people-section" aria-label="Room participants">
          <div className="section-title room-people-heading">
            <span>People</span>
            <span>{people.length}</span>
          </div>
          <div className="room-people-list">
            {people.map((p) => {
              const liveSpeaking = speakingId ? speakingId === p.id : Boolean(p.speaking);
              const isSelf = p.id === FRIENDS[0].id;
              return (
                <div className="room-people-entry" key={p.id}>
                  <div
                    className={`room-people-row ${p.role === "host" ? "host" : ""} ${isSelf ? "self" : ""} ${liveSpeaking ? "speaking" : ""}`}
                  >
                    <div className="room-people-main">
                      <span className="room-people-avatar">
                        <ParticipantAvatar p={p} size={32} forceAvatar />
                      </span>
                      <span className="room-people-copy">
                        <span className="room-people-name">{p.displayName}</span>
                        <PeopleMediaStatus p={p} />
                      </span>
                    </div>
                    <div className="room-people-side">
                      {p.role === "host" ? (
                        <span className="room-people-role">Host</span>
                      ) : isSelf ? (
                        <span className="room-people-you">You</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="section-title settings-section-title">Settings</div>
      <div className="settings-shell">
        <div className="settings-category-scroll" role="tablist" aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => {
            const active = tab === settingsTab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                className={`settings-category-tab ${active ? "active" : ""}`}
                onClick={() => onSettingsTabChange(tab)}
              >
                {tab}
              </button>
            );
          })}
        </div>
        {settingsTab === "Reactions" ? (
          <div className="settings-panel-stack" style={{ display: "grid", gap: 6 }}>
            <button type="button" className="toggle" aria-pressed>
              <span>On-screen reactions</span>
              <span>On</span>
            </button>
            <div className="reaction-shortcut-grid" aria-label="Reaction shortcuts" role="group">
              {EMOJI_LIST.map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  disabled={!roomActive}
                  className="reaction-shortcut"
                  aria-label={`Reaction ${index + 1}`}
                >
                  <span className="reaction-shortcut-key">{index + 1}</span>
                  <span className="reaction-shortcut-emoji">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {settingsTab === "Layout" ? (
          <DemoLayoutEditor
            active={open}
            draft={layoutDraft}
            onDraftChange={onLayoutDraftChange}
            onDraggingChange={onLayoutDraggingChange}
          />
        ) : null}
        {settingsTab === "Interface" ? (
          <div className="settings-panel-stack" style={{ display: "grid", gap: 6 }}>
            <button type="button" className="toggle" aria-pressed>
              <span>Participant pills</span>
              <span>Speaking</span>
            </button>
          </div>
        ) : null}
        {settingsTab === "Voice" ? (
          <div className="settings-panel-stack" style={{ display: "grid", gap: 6 }}>
            <button type="button" className="toggle" aria-pressed>
              <span>Open mic</span>
              <span>On</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function getDemoCaption({
  panelOpen,
  roomActive,
  participants,
  showCatchUp,
  showComposer,
  settingsTab,
}: {
  panelOpen: boolean;
  roomActive: boolean;
  participants: Participant[];
  showCatchUp: boolean;
  showComposer?: boolean;
  settingsTab?: (typeof SETTINGS_TABS)[number];
}): string {
  if (showCatchUp) {
    return "If playback drifts, a banner appears. One tap brings everyone back in sync.";
  }
  if (settingsTab === "Layout" && panelOpen) {
    return "Drag cameras and chat on the grid, then Apply. The overlay follows that layout on the player.";
  }
  if (participants.length >= 3) {
    return "Live chat and reactions float over the video — tap an emoji or type in the composer.";
  }
  if (participants.length === 2) {
    return "Natsuki joined. Participant pills sit on the right edge of the player.";
  }
  if (showComposer && roomActive && !panelOpen) {
    return "Room is live. Chat from the composer or react without leaving the player.";
  }
  if (roomActive) {
    return "Room created! Copy the invite or invite friends from the panel.";
  }
  if (panelOpen) {
    return "Tap the bubble to open the panel. Hit Create room to start a session.";
  }
  return "The Anidachi bubble sits in the top-right corner of any Crunchyroll or YouTube player.";
}

export function useDemoOverlaySequence(visible: boolean, compact = false) {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const schedule = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, delay);
    timers.current.add(id);
    return id;
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const [roomActive, setRoomActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [reactions, setReactions] = useState<ReactionPop[]>([]);
  const [chatMessages, setChatMessages] = useState<LiveChatLine[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [showEdgeGlow, setShowEdgeGlow] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [settingsTab, setSettingsTab] =
    useState<(typeof SETTINGS_TABS)[number]>("Reactions");
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const reactionRight = compact ? 36 : 56;
    const reactionRight2 = compact ? 72 : 110;

    setShowEdgeGlow(true);
    schedule(() => setShowEdgeGlow(false), 1100);

    const seq: Array<() => void> = [
      () => {
        setCurrentStep(1);
        setPanelOpen(true);
        setShowComposer(false);
        setSettingsTab("Reactions");
      },
      () => {
        setCurrentStep(2);
        setRoomActive(true);
        schedule(() => setConnected(true), 700);
      },
      () => {
        setCurrentStep(3);
        setSettingsTab("Layout");
      },
      () => {
        setCurrentStep(4);
        setSettingsTab("Reactions");
        setParticipants([FRIENDS[0], FRIENDS[1]]);
        setChatMessages([
          {
            id: "c1",
            name: "Natsuki",
            color: FRIENDS[1].nameColor ?? "#7dd3a7",
            text: "I'm in!!",
          },
        ]);
      },
      () => {
        setParticipants([
          FRIENDS[0],
          { ...FRIENDS[1], cameraEnabled: true },
          FRIENDS[2],
        ]);
        setSpeakingId("3");
        setChatMessages([
          {
            id: "c1",
            name: "Natsuki",
            color: FRIENDS[1].nameColor ?? "#7dd3a7",
            text: "I'm in!!",
          },
          {
            id: "c2",
            name: "Haruto",
            color: FRIENDS[2].nameColor ?? "#93c5fd",
            text: "that ending 😭",
          },
          {
            id: "c3",
            name: "You",
            color: FRIENDS[0].nameColor ?? "#ff8a3d",
            text: "wait for it…",
          },
        ]);
      },
      () => {
        setCurrentStep(5);
        setPanelOpen(false);
        setSettingsTab("Reactions");
        setShowComposer(true);
        setRailOpen(true);
        const r1: ReactionPop = { id: crypto.randomUUID(), emoji: "🔥", right: reactionRight };
        setReactions((prev) => [...prev, r1]);
        schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r1.id)), 2800);
        schedule(() => {
          const r2: ReactionPop = { id: crypto.randomUUID(), emoji: "😭", right: reactionRight2 };
          setReactions((prev) => [...prev, r2]);
          schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r2.id)), 2800);
        }, 600);
      },
      () => {
        setCurrentStep(6);
        setShowCatchUp(true);
        setShowComposer(false);
        setRailOpen(false);
      },
      () => {
        setCurrentStep(0);
        setShowCatchUp(false);
        setPanelOpen(false);
        setRoomActive(false);
        setConnected(false);
        setParticipants([]);
        setChatMessages([]);
        setCopied(false);
        setShowComposer(false);
        setSpeakingId(null);
        setRailOpen(false);
        setSettingsTab("Reactions");
        setShowEdgeGlow(true);
        schedule(() => setShowEdgeGlow(false), 1100);
      },
    ];

    const delays = [800, 2000, 1800, 4000, 1800, 2000, 2000, 2500];

    function runStep(i: number) {
      schedule(() => {
        seq[i]?.();
        if (i + 1 < seq.length) runStep(i + 1);
        else schedule(() => runStep(0), 1200);
      }, delays[i]);
    }

    runStep(0);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [visible, compact]);

  const handleCopyInvite = () => {
    setCopied(true);
    schedule(() => setCopied(false), 1800);
  };

  const fireReaction = (emoji: string) => {
    const r: ReactionPop = {
      id: crypto.randomUUID(),
      emoji,
      right: compact ? 36 : 56,
    };
    setReactions((prev) => [...prev, r]);
    schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 2800);
  };

  const handleCreateRoom = () => {
    if (roomActive) {
      setRoomActive(false);
      setConnected(false);
      setParticipants([]);
      setChatMessages([]);
      setShowComposer(false);
      setSpeakingId(null);
      setRailOpen(false);
      setSettingsTab("Reactions");
      return;
    }
    setRoomActive(true);
    schedule(() => setConnected(true), 700);
  };

  const caption = getDemoCaption({
    panelOpen,
    roomActive,
    participants,
    showCatchUp,
    showComposer,
    settingsTab,
  });
  const participantCount = participants.length || 1;

  return {
    panelOpen,
    setPanelOpen,
    roomActive,
    connected,
    participants,
    reactions,
    chatMessages,
    copied,
    showCatchUp,
    setShowCatchUp,
    showEdgeGlow,
    showComposer,
    speakingId,
    railOpen,
    settingsTab,
    setSettingsTab,
    currentStep,
    schedule,
    handleCopyInvite,
    handleCreateRoom,
    fireReaction,
    caption,
    participantCount,
  };
}

function ReactionPopView({
  reaction,
  compact = false,
}: {
  reaction: ReactionPop;
  compact?: boolean;
}) {
  return (
    <div
      className={`absolute pointer-events-none animate-[anidachi-pop_2.6s_ease_forwards] ${
        compact ? "bottom-16" : "bottom-24"
      }`}
      style={{ right: reaction.right }}
    >
      <span
        className={compact ? "text-xl" : "text-2xl"}
        style={{ textShadow: "0 3px 14px rgba(0,0,0,0.7)" }}
      >
        {reaction.emoji}
      </span>
    </div>
  );
}

export function DemoOverlayLayer({
  compact = false,
  demo,
}: {
  compact?: boolean;
  /** @deprecated Kept for call-site compatibility; panel no longer shows platform label. */
  platformLabel?: string;
  demo: ReturnType<typeof useDemoOverlaySequence>;
}) {
  const {
    panelOpen,
    setPanelOpen,
    roomActive,
    connected,
    participants,
    reactions,
    chatMessages,
    copied,
    showCatchUp,
    setShowCatchUp,
    showEdgeGlow,
    showComposer,
    speakingId,
    railOpen,
    settingsTab,
    setSettingsTab,
    handleCopyInvite,
    handleCreateRoom,
    fireReaction,
    participantCount,
  } = demo;

  const [layoutDraft, setLayoutDraft] = useState<LayoutDraft>(DEFAULT_LAYOUT_DRAFT);
  const [layoutDragging, setLayoutDragging] = useState(false);
  const overlayOnVideo = participants.length > 0;
  const cameraParticipants = participants.filter((p) => p.cameraEnabled);
  const localSpeaking = speakingId === FRIENDS[0].id;
  const layoutPreviewActive = panelOpen && settingsTab === "Layout";
  const layoutAnimating = layoutPreviewActive && !layoutDragging;

  return (
    <div
      className={`demo-anidachi-overlay absolute inset-0 z-10 pointer-events-none ${
        compact ? "is-compact" : ""
      }`}
    >
      <div
        className={`absolute pointer-events-auto ${compact ? "top-[2%] right-[2%]" : "top-2.5 right-2.5"}`}
      >
        <TopBubble
          connected={connected}
          warning={showCatchUp}
          count={participantCount}
          onClick={() => setPanelOpen((o) => !o)}
          compact={compact}
          showEdgeGlow={showEdgeGlow && !panelOpen}
          openMic={roomActive}
          speaking={localSpeaking}
        />
      </div>

      <MiniPanel
        open={panelOpen}
        roomActive={roomActive}
        participants={participants}
        onCreateRoom={handleCreateRoom}
        onCopyInvite={handleCopyInvite}
        onSyncNow={() => {}}
        onReact={fireReaction}
        copied={copied}
        speakingId={speakingId}
        settingsTab={settingsTab}
        onSettingsTabChange={setSettingsTab}
        layoutDraft={layoutDraft}
        onLayoutDraftChange={setLayoutDraft}
        onLayoutDraggingChange={setLayoutDragging}
      />

      {layoutPreviewActive ? (
        <LayoutGhostPreview
          compact={compact}
          draft={layoutDraft}
          animating={layoutAnimating}
          dragging={layoutDragging}
          occupiedCameraSlots={cameraParticipants.length}
          showChatPlaceholder={!overlayOnVideo || chatMessages.length === 0}
        />
      ) : null}
      {overlayOnVideo && !layoutPreviewActive ? (
        <LiveChatColumn messages={chatMessages} />
      ) : null}

      {overlayOnVideo && cameraParticipants.length ? (
        <div className="cam-stack">
          {cameraParticipants.map((p) => (
            <CamBubble
              key={p.id}
              p={p}
              speaking={speakingId === p.id || Boolean(p.speaking && speakingId === p.id)}
            />
          ))}
        </div>
      ) : null}

      {overlayOnVideo ? (
        <RoomRail
          participants={participants}
          speakingId={speakingId}
          open={railOpen && !panelOpen}
        />
      ) : null}

      {showComposer && roomActive && !panelOpen && !showCatchUp ? (
        <MessageComposerPeek />
      ) : null}

      {reactions.map((r) => (
        <ReactionPopView key={r.id} reaction={r} compact={compact} />
      ))}

      {showCatchUp ? (
        <div className="catch-up">
          <span>{compact ? "3.2s behind" : "3.2s out of sync"}</span>
          <button
            type="button"
            onClick={() => setShowCatchUp(false)}
            className="ad-button primary"
          >
            Catch up
          </button>
        </div>
      ) : null}
    </div>
  );
}

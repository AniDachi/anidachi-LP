import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { WEB_HTTP_BASE } from "../src/constants";
import { FreeQuotaNotice } from "../src/free-quota-notice";

describe("Free quota notice", () => {
  it.each([
    ['Asia/Ho_Chi_Minh', '2026-11-04T12:00:00Z', '2026-11-05T00:00:00Z', 'tomorrow at 7:00 AM'],
    ['Asia/Ho_Chi_Minh', '2026-11-04T23:59:59Z', '2026-11-05T00:00:00Z', 'today at 7:00 AM'],
    ['America/New_York', '2026-11-04T12:00:00Z', '2026-11-05T00:00:00Z', 'today at 7:00 PM'],
    ['Asia/Kathmandu', '2026-11-04T12:00:00Z', '2026-11-05T00:00:00Z', 'tomorrow at 5:45 AM'],
    ['Pacific/Kiritimati', '2026-11-04T12:00:00Z', '2026-11-05T00:00:00Z', 'today at 2:00 PM'],
    ['Europe/Berlin', '2026-03-28T23:30:00Z', '2026-03-29T00:00:00Z', 'today at 1:00 AM'],
    ['Europe/Berlin', '2026-03-29T12:00:00Z', '2026-03-30T00:00:00Z', 'tomorrow at 2:00 AM'],
    ['Atlantic/Azores', '2026-03-29T00:00:00Z', '2026-03-30T00:00:00Z', 'Mar 30 at 12:00 AM'],
    ['UTC', '2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z', 'tomorrow at 12:00 AM'],
    ['UTC', '2028-02-28T12:00:00Z', '2028-02-29T00:00:00Z', 'tomorrow at 12:00 AM'],
  ])('shows the server renewal in %s at %s, independent of device date', (timeZone, serverTime, resetAt, expected) => {
    const NativeFormatter = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locale, options) {
      return new NativeFormatter(locale, {...options, timeZone});
    } as typeof Intl.DateTimeFormat);
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2035-01-01T00:00:00Z'));
    try {
      const host = document.createElement('div');
      host.innerHTML = renderToStaticMarkup(<FreeQuotaNotice compact dailyFree
        state={{ownerUserId:'user-a',kind:'exhausted',remainingSeconds:3600}}
        renewal={{serverTime:Date.parse(serverTime),resetAt:Date.parse(resetAt)}} onRetry={() => {}} />);
      expect(host.querySelector('h2')?.textContent).toBe('Daily limit reached');
      expect(host.querySelector('time')?.textContent).toBe(expected);
      expect(host.querySelector('time')?.dateTime).toBe(new Date(resetAt).toISOString());
      expect(host.textContent).toContain('20 free minutes');
      expect(host.textContent).not.toContain('Renews in');
      expect(host.querySelector('[role="timer"]')).toBeNull();
    } finally { vi.restoreAllMocks(); }
  });

  it('keeps confirmed exhaustion while renewal is unknown or has passed, and offers retry on failure', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const host = document.createElement('div'), root = createRoot(host), retry = vi.fn();
    const renewal = {serverTime:Date.parse('2026-11-05T00:00:00Z'),resetAt:Date.parse('2026-11-05T00:00:00Z')};
    try {
      for (const value of [null, renewal, {...renewal,resetAt:NaN}]) {
        await act(async () => root.render(<FreeQuotaNotice compact dailyFree
          state={{ownerUserId:'user-a',kind:'exhausted',remainingSeconds:0}} renewal={value} onRetry={retry} />));
        expect(host.querySelector('h2')?.textContent).toBe('Daily limit reached');
        expect(host.querySelector('time')).toBeNull();
        expect(host.textContent).not.toContain('20 free minutes');
        expect(host.textContent).not.toContain('00:00');
      }
      await act(async () => root.render(<FreeQuotaNotice compact dailyFree
        state={{ownerUserId:'user-a',kind:'unavailable',remainingSeconds:null}} renewal={null} onRetry={retry} />));
      await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
      expect(retry).toHaveBeenCalledTimes(1);
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
  });

  it("links to pricing when free time is exhausted", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<FreeQuotaNotice
      state={{ ownerUserId: "user-a", kind: "exhausted", remainingSeconds: 3600 }}
      onRetry={() => {}}
    />);
    const link = host.querySelector("a");
    expect(link?.textContent).toBe("View plans");
    expect(link?.href).toBe(new URL("/pricing", WEB_HTTP_BASE).href);
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
  });

  it("lets an exhausted host retry a failed compact limit check without losing the join hint", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div"), root = createRoot(host), retry = vi.fn();
    try {
      await act(async () => root.render(<FreeQuotaNotice compact
        state={{ ownerUserId: "user-a", kind: "unavailable", remainingSeconds: null }} onRetry={retry} />));
      expect(host.textContent).toContain("Free time unavailable");
      expect(host.textContent).not.toContain("Today's free time is used up");
      expect(host.textContent).toContain("Couldn't check your free time.");
      expect(host.textContent).toContain("You can still join a friend's room.");
      const button = host.querySelector<HTMLButtonElement>(".free-quota-retry");
      expect(button?.textContent).toBe("Retry");
      await act(async () => button!.click());
      expect(retry).toHaveBeenCalledTimes(1);

      await act(async () => root.render(<FreeQuotaNotice compact
        state={{ ownerUserId: "user-a", kind: "checking", remainingSeconds: null }} onRetry={retry} />));
      expect(host.textContent).toContain("Checking your limit");
      expect(host.querySelector(".free-quota-retry")).toBeNull();
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
  });
});

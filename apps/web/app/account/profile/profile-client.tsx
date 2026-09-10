"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, UserRound } from "lucide-react";
import { AccountWaitlistCard } from "@/components/account/account-waitlist-card";
import { PROFILE_OWNER_HEADER } from "@/lib/profile-owner";
import { api } from "@/lib/client-api";

type EditableProfile = {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
};

type WaitlistStatus = {
  waitlistPosition: number;
  referralLink: string;
  referralCount: number;
};

type ProfileResponse = {
  profile?: {
    userId?: unknown;
    displayName?: unknown;
    handle?: unknown;
    avatarUrl?: unknown;
  };
  error?: unknown;
};

export function ProfileClient({
  ownerUserId,
  email,
  initialProfile,
  waitlist,
}: {
  ownerUserId: string;
  email: string;
  initialProfile: EditableProfile;
  waitlist: WaitlistStatus | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [handle, setHandle] = useState(initialProfile.handle ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => ({
    displayName: initialProfile.displayName,
    handle: initialProfile.handle ?? "",
    avatarUrl: initialProfile.avatarUrl ?? "",
  }));
  const ownerRef = useRef(ownerUserId);
  const requestRef = useRef(0);
  ownerRef.current = ownerUserId;
  const dirty =
    displayName !== baseline.displayName ||
    handle !== baseline.handle ||
    avatarUrl !== baseline.avatarUrl;

  useEffect(() => {
    requestRef.current += 1;
    const next = {
      displayName: initialProfile.displayName,
      handle: initialProfile.handle ?? "",
      avatarUrl: initialProfile.avatarUrl ?? "",
    };
    setDisplayName(next.displayName);
    setHandle(next.handle);
    setAvatarUrl(next.avatarUrl);
    setBaseline(next);
    setSaving(false);
    setError(null);
    setSaved(false);
    // Same-owner refreshes must not overwrite an unsaved draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const confirmLeave = () => window.confirm("Discard your unsaved profile changes?");
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeSignOut = (event: Event) => {
      if (!confirmLeave()) event.preventDefault();
    };
    const linkClick = (event: MouseEvent) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (link && !confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("anidachi:before-sign-out", beforeSignOut);
    window.addEventListener("anidachi:before-account-navigation", beforeSignOut);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("anidachi:before-sign-out", beforeSignOut);
      window.removeEventListener("anidachi:before-account-navigation", beforeSignOut);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim().replace(/\s+/g, " ");
    const nextHandle = handle.trim().toLowerCase();
    const nextAvatar = avatarUrl.trim();
    if (!nextName) return setError("Display name is required.");
    if (nextHandle && !/^[a-z0-9_]{3,24}$/.test(nextHandle)) {
      return setError("Handle must be 3–24 lowercase letters, numbers, or underscores.");
    }
    if (nextAvatar) {
      try {
        const url = new URL(nextAvatar);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        return setError("Avatar URL must start with http:// or https://.");
      }
    }

    const request = ++requestRef.current;
    const requestOwner = ownerUserId;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api<ProfileResponse>("/api/me/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          [PROFILE_OWNER_HEADER]: requestOwner,
        },
        body: JSON.stringify({
          displayName: nextName,
          handle: nextHandle || null,
          avatarUrl: nextAvatar || null,
        }),
      });
      if (request !== requestRef.current || requestOwner !== ownerRef.current) return;
      const profile = data?.profile;
      if (
        !profile ||
        profile.userId !== requestOwner ||
        typeof profile.displayName !== "string" ||
        !(profile.handle === null || typeof profile.handle === "string") ||
        !(profile.avatarUrl === null || typeof profile.avatarUrl === "string")
      ) {
        throw new Error("The saved profile response could not be verified.");
      }
      setDisplayName(profile.displayName);
      setHandle(profile.handle ?? "");
      setAvatarUrl(profile.avatarUrl ?? "");
      setBaseline({ displayName: profile.displayName, handle: profile.handle ?? "", avatarUrl: profile.avatarUrl ?? "" });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      if (request !== requestRef.current || requestOwner !== ownerRef.current) return;
      setError(cause instanceof Error ? cause.message : "Profile could not be saved.");
    } finally {
      if (request === requestRef.current && requestOwner === ownerRef.current) setSaving(false);
    }
  }

  const previewUrl = avatarUrl.trim();
  return (
    <div className="ac-page profile-page">
      <header className="ac-page-header profile-heading">
        <p className="profile-eyebrow">PROFILE</p>
        <h1>Your profile</h1>
        <p>Choose how your name and avatar appear to friends and room members.</p>
      </header>
      <div className="ac-detail-layout profile-grid">
        <form className="profile-form" onSubmit={saveProfile}>
          <fieldset className="profile-fields" disabled={saving}>
            <div className="profile-avatar-preview" aria-label="Avatar preview">
              {previewUrl ? <img src={previewUrl} alt="Current avatar preview" /> : <UserRound aria-hidden />}
            </div>
            <label>
              <span>Display name</span>
              <input value={displayName} maxLength={80} autoComplete="name" onInput={(event) => { setDisplayName(event.currentTarget.value); setSaved(false); }} />
            </label>
            <label>
              <span>Handle</span>
              <span className="profile-field-hint">Lowercase letters, numbers, and underscores.</span>
              <div className="profile-handle-field"><span aria-hidden>@</span><input value={handle} maxLength={24} autoComplete="username" onInput={(event) => { setHandle(event.currentTarget.value); setSaved(false); }} /></div>
            </label>
            <label>
              <span>Avatar URL</span>
              <span className="profile-field-hint">Use a direct https image URL.</span>
              <input type="url" value={avatarUrl} maxLength={1000} placeholder="https://…" onInput={(event) => { setAvatarUrl(event.currentTarget.value); setSaved(false); }} />
            </label>
          </fieldset>
          <label>
            <span>Email</span>
            <span className="profile-field-hint">Your sign-in email cannot be changed here.</span>
            <input type="email" value={email} readOnly aria-readonly="true" />
          </label>
          {error ? <p className="profile-message profile-error" role="alert">{error}</p> : null}
          {saved ? <p className="profile-message profile-success" role="status">Profile saved.</p> : null}
          <button className="ac-button ac-button-primary profile-save" type="submit" disabled={saving || !dirty}>
            <Save size={17} aria-hidden /> {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
        <aside className="ac-context profile-context">
          <h2>Public profile</h2>
          <p>Your display name, handle, and avatar can appear in social and room surfaces. Your email stays private.</p>
        </aside>
      </div>
      {waitlist ? <AccountWaitlistCard {...waitlist} /> : null}
    </div>
  );
}

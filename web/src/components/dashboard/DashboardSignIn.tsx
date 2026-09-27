"use client";

import { useState } from "react";

/** Same-origin paths only, so a crafted link cannot bounce people off-site. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function DashboardSignIn() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Sign-in failed. Try again.");
    } catch {
      setError("Could not reach YourWalk. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-yw-day-surface p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#E8ECF2]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/yourwalk-mark.svg" alt="" width={36} height={28} className="h-8 w-auto" aria-hidden />
          <div className="leading-none">
            <p className="text-xl font-extrabold tracking-tight text-yw-navy">YourWalk</p>
            <p className="mt-1 text-[12px] font-medium text-slate-500">Council insights · City of Casey</p>
          </div>
        </div>
        <h1 className="mt-6 text-[16px] font-extrabold text-yw-navy">Sign in</h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          This pilot tool is for City of Casey staff. Ask CrowdLab or Monash XYX Lab for the password.
        </p>
        <form onSubmit={submit} className="mt-4">
          <label htmlFor="dash-password" className="block text-[12px] font-bold text-slate-700">
            Password
          </label>
          <input
            id="dash-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dash-password-error" : undefined}
            className="mt-1 h-11 w-full rounded-md border border-[#D5DBE5] bg-white px-3 text-[14px]"
          />
          {error ? (
            <p id="dash-password-error" role="alert" className="mt-2 text-[12px] font-semibold text-[#9A3412]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!password || busy}
            className="mt-4 h-11 w-full rounded-full bg-yw-navy text-[13px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-[11px] leading-snug text-slate-500">
          Scores describe walking conditions in open data. They are not a promise that a walk will feel safe.
        </p>
      </div>
    </main>
  );
}

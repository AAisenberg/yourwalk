"use client";

import { useState } from "react";

import {
  WAITLIST,
  WAITLIST_FORM_ENTRY,
  WAITLIST_FORM_URL,
} from "@/lib/frontDoorCopy";

function formResponseUrl(viewform: string): string | null {
  if (!viewform.includes("/viewform")) return null;
  return viewform.replace("/viewform", "/formResponse");
}

export function WaitlistForm({ isNight }: { isNight: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const sending = state === "sending";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const value = email.trim();
    if (!value) return;

    if (!WAITLIST_FORM_URL) {
      setState("error");
      return;
    }

    setState("sending");

    const action = formResponseUrl(WAITLIST_FORM_URL);
    if (action && WAITLIST_FORM_ENTRY) {
      const body = new FormData();
      body.append(`entry.${WAITLIST_FORM_ENTRY}`, value);
      try {
        await fetch(action, { method: "POST", mode: "no-cors", body });
        setState("sent");
        setEmail("");
        return;
      } catch {
        // Fall through to open the Form
      }
    }

    const url = new URL(WAITLIST_FORM_URL);
    if (WAITLIST_FORM_ENTRY) {
      url.searchParams.set(`entry.${WAITLIST_FORM_ENTRY}`, value);
      url.searchParams.set("usp", "pp_url");
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    setState("sent");
    setEmail("");
  };

  if (state === "sent") {
    return (
      <p
        className="fd-heading mt-6 text-[15px] font-semibold leading-relaxed"
        role="status"
        aria-live="polite"
      >
        {WAITLIST.thanks}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 max-w-md"
      id={WAITLIST.id}
      aria-busy={sending}
    >
      <label className="fd-heading block text-[13px] font-bold" htmlFor="yw-waitlist-email">
        {WAITLIST.emailLabel}
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="yw-waitlist-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder={WAITLIST.emailPlaceholder}
          disabled={sending}
          className={`min-h-12 flex-1 rounded-2xl border px-4 text-[15px] disabled:cursor-not-allowed disabled:opacity-70 ${
            isNight
              ? "border-white/15 bg-yw-night-panel text-white placeholder:text-white/40"
              : "border-[#E8ECF2] bg-white text-slate-900 placeholder:text-slate-400"
          }`}
        />
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="fd-cta inline-flex min-h-12 min-w-[9.5rem] items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-bold text-white"
        >
          {sending ? (
            <>
              <span className="fd-cta-spinner" aria-hidden />
              {WAITLIST.sending}
            </>
          ) : (
            WAITLIST.submit
          )}
        </button>
      </div>
      {state === "error" ? (
        <p className="fd-quiet mt-2 text-xs" role="alert">
          {WAITLIST.missingForm}
        </p>
      ) : null}
    </form>
  );
}

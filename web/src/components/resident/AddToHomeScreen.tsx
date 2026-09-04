"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Invite to save the planner on the home screen. Android Chrome can prompt;
 * iPhone can only show Share then Add to Home Screen. Hidden once installed.
 */
export function AddToHomeScreen({ isNight }: { isNight: boolean }) {
  const [standalone, setStandalone] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
      setHintOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onAdd = useCallback(async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstallEvent(null);
        setStandalone(true);
      }
      return;
    }
    setHintOpen((open) => !open);
  }, [installEvent]);

  if (standalone) return null;

  const hint = isAppleMobile()
    ? "On iPhone or iPad: tap Share, then Add to Home Screen."
    : "In your browser menu, choose Add to Home Screen or Install.";

  const muted = isNight ? "text-white/70" : "text-slate-600";
  const border = isNight
    ? "border-white/25 text-white hover:bg-white/10"
    : "border-yw-navy/25 text-yw-navy hover:bg-slate-50";

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => void onAdd()}
        aria-expanded={installEvent ? undefined : hintOpen}
        aria-controls={installEvent ? undefined : "yw-add-home-hint"}
        className={`flex min-h-11 w-full items-center justify-center rounded-2xl border text-sm font-semibold sm:min-h-12 sm:text-[15px] ${border}`}
      >
        Add YourWalk to your home screen
      </button>
      {hintOpen && !installEvent ? (
        <p
          id="yw-add-home-hint"
          className={`mt-2 text-center text-[12px] leading-relaxed sm:text-[13px] ${muted}`}
        >
          {hint} The icon is the YourWalk star. This is the web app, not a store
          download.
        </p>
      ) : null}
    </div>
  );
}

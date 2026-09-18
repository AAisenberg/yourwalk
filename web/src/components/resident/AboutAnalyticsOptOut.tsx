"use client";

import { useEffect, useState } from "react";

import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "@/lib/analytics/client";

export function AboutAnalyticsOptOut({ isNight }: { isNight: boolean }) {
  const [optedOut, setOptedOut] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydration */
  useEffect(() => {
    setOptedOut(isAnalyticsOptedOut());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <label
      className={`mt-3 flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed sm:text-[13px] ${
        isNight ? "text-white/70" : "text-slate-600"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-yw-teal"
        checked={!optedOut}
        onChange={(event) => {
          const nextOptOut = !event.target.checked;
          setAnalyticsOptOut(nextOptOut);
          setOptedOut(nextOptOut);
        }}
      />
      <span>
        Share anonymous usage stats (walks found, suburb, A to B or Loop). No
        account, no address, no live tracking. Uncheck to opt out.
      </span>
    </label>
  );
}

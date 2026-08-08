"use client";

import { useEffect, useState } from "react";

/** Client media query; false until mounted (SSR-safe). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);

  return matches;
}

/** Tailwind `md` — side panel instead of bottom sheet. */
export const MD_UP = "(min-width: 768px)";

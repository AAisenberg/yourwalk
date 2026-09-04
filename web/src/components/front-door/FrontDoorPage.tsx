"use client";

/**
 * Public front door for yourwalk.au (docs/FRONT_DOOR.md, backlog X8).
 *
 * Day / Night is the visual concept: two chrome states aligned to the
 * resident app tokens, auto-picked from Casey civil twilight (ADR-009),
 * with a manual header switch. No login, no email capture, no map.
 * Copy comes from the in-app About; do not invent slogans here.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import { resolveCaseyWhen } from "@/lib/caseyWhen";
import { BETA_LABEL } from "@/lib/beta";
import type { WalkMode } from "@/lib/routing/preferences";

const PLANNER_URL = "https://app.yourwalk.au";

const TIMELINE: { when: string; what: string }[] = [
  { when: "3 Jul 2026", what: "Methodology v1.1 accepted with Monash XYX Lab" },
  { when: "15 Jul 2026", what: "Phase C app build started" },
  { when: "Jul–Aug 2026", what: "Hybrid routing and resident planner on Vercel" },
  { when: "4 Sep 2026", what: "Planner live at app.yourwalk.au (beta)" },
];

const PARTNERS: { name: string; role: string }[] = [
  { name: "City of Casey", role: "Connecting Grant pilot" },
  { name: "CrowdLab", role: "Delivery · CrowdSpot Pty Ltd" },
  { name: "Monash University XYX Lab", role: "Methodology" },
];

export function FrontDoorPage() {
  const [mode, setMode] = useState<WalkMode>("day");
  const overridden = useRef(false);

  // Auto Day / Night from Casey civil twilight (ADR-009). Runs once on
  // mount; a manual switch wins for the rest of the visit.
  useEffect(() => {
    if (!overridden.current) {
      setMode(resolveCaseyWhen().walkMode);
    }
  }, []);

  const isNight = mode === "night";

  const onModeChange = (next: WalkMode) => {
    overridden.current = true;
    setMode(next);
  };

  const muted = isNight ? "text-white/70" : "text-slate-600";
  const quiet = isNight ? "text-white/45" : "text-slate-500";
  const heading = isNight ? "text-white" : "text-yw-navy";
  const card = isNight
    ? "border-white/10 bg-yw-night-panel"
    : "border-[#E8ECF2] bg-white";

  return (
    <div
      className={`yw-chrome-transition min-h-screen ${
        isNight
          ? "bg-yw-night-surface text-white"
          : "bg-yw-day-surface text-slate-900"
      }`}
    >
      {/* Header: brand + Day / Night switch (mirrors the planner header) */}
      <header
        className={`yw-chrome-transition sticky top-0 z-10 border-b px-4 py-3 backdrop-blur ${
          isNight
            ? "border-white/10 bg-yw-night-surface/85"
            : "border-[#E8ECF2] bg-white/85"
        }`}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/yourwalk-mark.svg"
            alt=""
            width={36}
            height={28}
            className="h-8 w-auto shrink-0"
            aria-hidden
          />
          <p
            className={`truncate text-xl font-extrabold leading-none tracking-tight ${heading}`}
          >
            YourWalk
          </p>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
              isNight
                ? "bg-white/10 text-white/80 ring-1 ring-white/20"
                : "bg-yw-navy/8 text-yw-navy ring-1 ring-yw-navy/15"
            }`}
          >
            {BETA_LABEL}
          </span>
          <div className="ml-auto w-[138px] shrink-0">
            <WalkModeSwitch
              value={mode}
              onChange={onModeChange}
              isNight={isNight}
              className="mb-0"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4">
        {/* 1 · Hero */}
        <section className="flex flex-col items-center gap-10 py-12 sm:py-16 md:flex-row md:items-center md:gap-14">
          <div className="max-w-xl md:flex-1">
            <p
              className={`text-[13px] font-bold uppercase tracking-wide ${
                isNight ? "text-yw-blue" : "text-yw-teal"
              }`}
            >
              A City of Casey Connecting Grant pilot
            </p>
            <h1
              className={`mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl ${heading}`}
            >
              Find your walk
            </h1>
            <p className={`mt-4 text-[15px] leading-relaxed sm:text-lg ${muted}`}>
              YourWalk helps Casey residents find walking routes that fit what
              matters to you: smoother footpaths, more shade on hot days, or
              better-lit streets after dark. Not just the shortest way.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a
                href={PLANNER_URL}
                className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-7 text-[15px] font-bold text-white shadow-sm ${
                  isNight ? "bg-yw-blue" : "bg-yw-navy"
                }`}
              >
                Find your walk
              </a>
              <a
                href="#how-it-works"
                className={`inline-flex min-h-11 items-center text-sm font-bold underline-offset-4 hover:underline ${
                  isNight ? "text-white/80" : "text-yw-navy"
                }`}
              >
                How it works
              </a>
            </div>
            <p className={`mt-4 text-xs ${quiet}`}>
              Free to use. No account, no sign-in.
            </p>
          </div>

          {/* Phone-framed planner screenshot; follows the Day / Night state */}
          <div
            className={`relative w-[270px] shrink-0 overflow-hidden rounded-[2.4rem] border shadow-xl sm:w-[300px] ${
              isNight
                ? "border-white/15 shadow-black/50"
                : "border-slate-300 shadow-slate-300/60"
            }`}
          >
            <Image
              src="/front-door/planner-day.png"
              alt="YourWalk planner in Day mode: the Casey map with the Find your walk sheet"
              width={1290}
              height={2796}
              priority
              className={`yw-fade-transition block h-auto w-full ${
                isNight ? "opacity-0" : "opacity-100"
              }`}
            />
            <Image
              src="/front-door/planner-night.png"
              alt="YourWalk planner in Night mode: the Casey map after dark with the Find your walk sheet"
              width={1290}
              height={2796}
              className={`yw-fade-transition absolute inset-0 block h-auto w-full ${
                isNight ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </section>

        {/* 2 · What this is / is not */}
        <section aria-labelledby="what-title" className="py-8 sm:py-10">
          <h2 id="what-title" className={`text-2xl font-extrabold ${heading}`}>
            What YourWalk is
          </h2>
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${muted}`}>
            A Casey walk planner that ranks walks using Council asset data and
            OpenStreetMap: a Day Index and a Night Index (methodology v1.1).
            Higher score = better walking conditions.
          </p>
          <div className={`mt-6 rounded-2xl border p-5 ${card}`}>
            <h3 className={`text-sm font-bold ${heading}`}>What it is not</h3>
            <ul
              className={`mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed ${muted}`}
            >
              <li>A safety guarantee or crime prediction.</li>
              <li>Turn-by-turn navigation.</li>
              <li>A login or account wall.</li>
              <li>
                Crime data: graffiti is used as an environmental-order signal
                only.
              </li>
            </ul>
          </div>
        </section>

        {/* 3 · How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="scroll-mt-20 py-8 sm:py-10"
        >
          <h2 id="how-title" className={`text-2xl font-extrabold ${heading}`}>
            How it works
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              "Casey's footpaths are scored street by street from Council asset data and OpenStreetMap: surface, continuity, tree canopy, lighting and more.",
              "Plan an A to B walk or a loop from home, set what matters most, and YourWalk ranks the options for day or night walking.",
              "Scores describe conditions in the data, with more Council datasets on the way. They are not a safety guarantee.",
            ].map((copy, i) => (
              <li key={i} className={`rounded-2xl border p-5 ${card}`}>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                    isNight ? "bg-yw-blue" : "bg-yw-teal"
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className={`mt-3 text-[14px] leading-relaxed ${muted}`}>
                  {copy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4 · Partners (names in type; no logo lockups until files land) */}
        <section aria-labelledby="partners-title" className="py-8 sm:py-10">
          <h2
            id="partners-title"
            className={`text-2xl font-extrabold ${heading}`}
          >
            Who&apos;s behind it
          </h2>
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${muted}`}>
            YourWalk is a City of Casey Connecting Grant pilot, built by
            CrowdLab in partnership with Monash University&apos;s XYX Lab.
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {PARTNERS.map((p) => (
              <li key={p.name} className={`rounded-2xl border p-5 ${card}`}>
                <p className={`text-[15px] font-extrabold ${heading}`}>
                  {p.name}
                </p>
                <p className={`mt-1 text-[13px] ${quiet}`}>{p.role}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5 · Timeline (facts only) */}
        <section aria-labelledby="timeline-title" className="py-8 sm:py-10">
          <h2
            id="timeline-title"
            className={`text-2xl font-extrabold ${heading}`}
          >
            Where the pilot is up to
          </h2>
          <dl className={`mt-5 divide-y rounded-2xl border ${card} ${
            isNight ? "divide-white/10" : "divide-[#E8ECF2]"
          }`}>
            {TIMELINE.map((row) => (
              <div
                key={row.when}
                className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt
                  className={`w-28 shrink-0 text-[13px] font-bold ${
                    isNight ? "text-white/85" : "text-yw-navy"
                  }`}
                >
                  {row.when}
                </dt>
                <dd className={`text-[14px] leading-relaxed ${muted}`}>
                  {row.what}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 6 · Privacy */}
        <section aria-labelledby="privacy-title" className="py-8 sm:py-10">
          <h2
            id="privacy-title"
            className={`text-2xl font-extrabold ${heading}`}
          >
            Your privacy
          </h2>
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${muted}`}>
            Anonymous by default: no account, no sign-in, no tracking. If you
            use the locate button in the planner, your position stays on your
            device.
          </p>
        </section>

        {/* 7 · Contact */}
        <section aria-labelledby="contact-title" className="py-8 sm:py-10">
          <h2
            id="contact-title"
            className={`text-2xl font-extrabold ${heading}`}
          >
            Press and partners
          </h2>
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${muted}`}>
            Reach CrowdLab (delivery) or Monash University&apos;s XYX Lab
            (methodology) through your existing contacts.
          </p>
        </section>

        {/* Closing CTA */}
        <section className="pb-14 pt-4 text-center sm:pb-20">
          <a
            href={PLANNER_URL}
            className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-8 text-[15px] font-bold text-white shadow-sm ${
              isNight ? "bg-yw-blue" : "bg-yw-navy"
            }`}
          >
            Find your walk
          </a>
          <p className={`mt-3 text-xs ${quiet}`}>
            app.yourwalk.au · City of Casey pilot
          </p>
        </section>
      </main>

      {/* 8 · Footer */}
      <footer
        className={`yw-chrome-transition border-t px-4 py-6 ${
          isNight ? "border-white/10" : "border-[#E8ECF2]"
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 text-xs ${quiet}`}
        >
          <span className={`font-bold ${isNight ? "text-white/70" : "text-yw-navy"}`}>
            YourWalk
          </span>
          <span aria-hidden>·</span>
          <span>City of Casey pilot</span>
          <span aria-hidden>·</span>
          <a href={PLANNER_URL} className="underline-offset-2 hover:underline">
            app.yourwalk.au
          </a>
          <span aria-hidden>·</span>
          <span>
            Methodology v1.1 for specialists:{" "}
            <code className="font-mono text-[11px]">
              docs/VULNERABILITY_INDEX.md
            </code>{" "}
            in the project repository
          </span>
          <span aria-hidden>·</span>
          <span>Not a safety guarantee.</span>
        </div>
      </footer>
    </div>
  );
}

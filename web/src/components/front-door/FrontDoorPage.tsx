"use client";

/**
 * Public front door for yourwalk.au (docs/FRONT_DOOR.md, backlog X8).
 * Holding phase: Age landing + waitlist. No planner links.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { PartnerMark } from "@/components/front-door/PartnerMark";
import { WaitlistForm } from "@/components/front-door/WaitlistForm";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import { resolveCaseyWhen } from "@/lib/caseyWhen";
import { FOOTER, HERO, PARTNERS, WAITLIST } from "@/lib/frontDoorCopy";
import type { WalkMode } from "@/lib/routing/preferences";

export function FrontDoorPage() {
  const [mode, setMode] = useState<WalkMode>("day");
  const overridden = useRef(false);

  useEffect(() => {
    if (!overridden.current) {
      setMode(resolveCaseyWhen().walkMode);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  const isNight = mode === "night";

  return (
    <div className="yw-front-door min-h-screen" data-mode={mode}>
      <header className="fd-header sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
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
          <p className="fd-heading truncate text-xl font-extrabold leading-none tracking-tight">
            YourWalk
          </p>
          <div className="ml-auto w-[138px] shrink-0">
            <WalkModeSwitch
              value={mode}
              onChange={(next) => {
                overridden.current = true;
                setMode(next);
              }}
              isNight={isNight}
              className="mb-0"
            />
          </div>
        </div>
      </header>

      <main>
        <section className="fd-band">
          <div className="fd-inner flex flex-col items-center gap-10 py-12 sm:py-16 md:flex-row md:items-center md:gap-14">
            <div className="max-w-xl md:flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/yourwalk-mark.svg"
                alt=""
                width={973}
                height={772}
                className="h-14 w-auto sm:h-16"
                aria-hidden
              />
              <h1 className="fd-heading mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {HERO.title}
              </h1>
              <p className="fd-muted mt-4 text-[15px] leading-relaxed sm:text-lg">
                {HERO.lead}
              </p>
              <p className="fd-muted mt-3 text-[15px] leading-relaxed sm:text-lg">
                {HERO.holdingLead}
              </p>
              <WaitlistForm isNight={isNight} />
              <p className="fd-quiet mt-3 text-xs">{HERO.aside}</p>
            </div>

            <div
              className={`relative w-[270px] shrink-0 overflow-hidden rounded-[2.4rem] border p-1.5 shadow-xl sm:w-[300px] ${
                isNight
                  ? "border-white/15 bg-black/40 shadow-black/50"
                  : "border-slate-300 bg-white shadow-slate-300/60"
              }`}
            >
              <div className="relative overflow-hidden rounded-[1.9rem]">
                <Image
                  src="/front-door/planner-day.png"
                  alt="Preview of the YourWalk planner in Day mode"
                  width={1290}
                  height={2796}
                  priority
                  className={`yw-fade-transition block h-auto w-full ${
                    isNight ? "opacity-0" : "opacity-100"
                  }`}
                />
                <Image
                  src="/front-door/planner-night.png"
                  alt="Preview of the YourWalk planner in Night mode"
                  width={1290}
                  height={2796}
                  className={`yw-fade-transition absolute inset-0 block h-auto w-full ${
                    isNight ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id={PARTNERS.id}
          aria-labelledby="partners-title"
          className="fd-band scroll-mt-20"
        >
          <div className="fd-inner py-12 sm:py-16">
            <h2
              id="partners-title"
              className="fd-heading text-2xl font-extrabold tracking-tight sm:text-3xl"
            >
              {PARTNERS.title}
            </h2>
            <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              {PARTNERS.lead}
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {PARTNERS.orgs.map((org) => (
                <li
                  key={org.id}
                  aria-label={org.name}
                  className="fd-rule flex min-h-[5.5rem] items-center justify-center rounded-2xl border bg-white px-4 py-4 sm:px-5"
                >
                  <PartnerMark org={org} />
                </li>
              ))}
            </ul>
            <p className="fd-heading mt-8 text-[15px] font-semibold">
              {PARTNERS.support}
            </p>
          </div>
        </section>
      </main>

      <footer className="fd-rule border-t px-4 py-6">
        <div className="fd-quiet mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="fd-heading font-bold">{FOOTER.product}</span>
          <span aria-hidden>·</span>
          <span>{FOOTER.pilot}</span>
          <span aria-hidden>·</span>
          <a href={`#${WAITLIST.id}`} className="underline-offset-2 hover:underline">
            Get updates
          </a>
          <span aria-hidden>·</span>
          <span>{FOOTER.caveat}</span>
        </div>
      </footer>
    </div>
  );
}

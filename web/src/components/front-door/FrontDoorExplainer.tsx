"use client";

/**
 * Long explainer (hidden while FRONT_DOOR_PHASE is "holding").
 * Kept so we can restore it after the Age / waitlist phase.
 * Do not link this from the holding page.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { PartnerMark } from "@/components/front-door/PartnerMark";
import { IconMoon, IconSun } from "@/components/resident/icons";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import { resolveCaseyWhen } from "@/lib/caseyWhen";
import { BETA_LABEL } from "@/lib/beta";
import {
  EXPLAINER_FOOTER,
  EXPLAINER_HERO,
  EXPLAINER_PARTNERS,
  FOOTER,
  HERO,
  HOW,
  MEDIA,
  PARTNERS,
  PLANNER_URL,
  PROBLEM,
  SCORES,
  SOLUTION,
  TIMELINE,
} from "@/lib/frontDoorCopy";
import type { WalkMode } from "@/lib/routing/preferences";

const NAV = [
  { href: `#${PROBLEM.id}`, label: "Why" },
  { href: `#${HOW.id}`, label: "How" },
  { href: `#${SCORES.id}`, label: "Scores" },
  { href: `#${PARTNERS.id}`, label: "Partners" },
  { href: `#${MEDIA.id}`, label: "Media" },
] as const;

function Band({
  id,
  tone = "default",
  labelledBy,
  children,
}: {
  id?: string;
  tone?: "default" | "alt" | "wash" | "cta";
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const band =
    tone === "alt"
      ? "fd-band-alt"
      : tone === "wash"
        ? "fd-band-wash"
        : tone === "cta"
          ? "fd-band-cta"
          : "fd-band";

  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`scroll-mt-20 ${band}`}
    >
      <div className="fd-inner py-12 sm:py-16">{children}</div>
    </section>
  );
}

export function FrontDoorExplainer() {
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

  const onModeChange = (next: WalkMode) => {
    overridden.current = true;
    setMode(next);
  };

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
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
              isNight
                ? "bg-white/10 text-white/80 ring-1 ring-white/20"
                : "bg-yw-navy/8 text-yw-navy ring-1 ring-yw-navy/15"
            }`}
          >
            {BETA_LABEL}
          </span>
          <nav
            className="ml-3 hidden items-center gap-4 text-[13px] font-bold lg:flex"
            aria-label="On this page"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="fd-muted underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            ))}
          </nav>
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

      <main>
        <Band>
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-14">
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
              <p className="fd-accent mt-5 text-[13px] font-bold uppercase tracking-wide">
                {EXPLAINER_HERO.eyebrow}
              </p>
              <h1 className="fd-heading mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {HERO.title}
              </h1>
              <p className="fd-muted mt-4 text-[15px] leading-relaxed sm:text-lg">
                {HERO.lead}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a
                  href={PLANNER_URL}
                  className="fd-cta inline-flex min-h-12 items-center justify-center rounded-2xl px-7 text-[15px] font-bold text-white shadow-sm"
                >
                  {EXPLAINER_HERO.primaryCta}
                </a>
                <a
                  href={`#${PROBLEM.id}`}
                  className="fd-heading inline-flex min-h-11 items-center text-sm font-bold underline-offset-4 hover:underline"
                >
                  {EXPLAINER_HERO.secondaryCta}
                </a>
              </div>
              <p className="fd-quiet mt-4 text-xs">{EXPLAINER_HERO.aside}</p>
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
            </div>
          </div>
        </Band>

        <Band id={PROBLEM.id} tone="alt" labelledBy="why-title">
          <h2
            id="why-title"
            className="fd-heading max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {PROBLEM.title}
          </h2>
          <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
            {PROBLEM.lead}
          </p>
          <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
            {PROBLEM.body}
          </p>
          <p className="fd-heading mt-4 max-w-2xl text-[15px] font-semibold leading-relaxed sm:text-[17px]">
            {PROBLEM.close}
          </p>
          <div className="fd-card mt-10 rounded-3xl border px-6 py-8 sm:px-8">
            <h3 className="fd-heading text-xl font-extrabold tracking-tight sm:text-2xl">
              {SOLUTION.title}
            </h3>
            <p className="fd-muted mt-3 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              {SOLUTION.body}
            </p>
            <p className="fd-muted mt-3 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              {SOLUTION.proof}
            </p>
          </div>
        </Band>

        <Band id={HOW.id} labelledBy="how-title">
          <h2
            id="how-title"
            className="fd-heading text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {HOW.title}
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {HOW.steps.map((step, i) => (
              <li key={step.title} className="fd-card rounded-2xl border p-5">
                <span
                  className="fd-cta flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <h3 className="fd-heading mt-3 text-[15px] font-extrabold">
                  {step.title}
                </h3>
                <p className="fd-muted mt-2 text-[14px] leading-relaxed">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Band>

        <Band id={SCORES.id} tone="wash" labelledBy="scores-title">
          <h2
            id="scores-title"
            className="fd-heading max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {SCORES.title}
          </h2>
          <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
            {SCORES.lead}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="fd-card rounded-2xl border p-5">
              <div className="flex items-center gap-2">
                <IconSun className="h-5 w-5 text-yw-teal" aria-hidden />
                <h3 className="fd-heading text-[15px] font-extrabold">
                  {SCORES.day.title}
                </h3>
              </div>
              <p className="fd-accent mt-2 text-[12px] font-bold">
                {SCORES.day.mix}
              </p>
              <p className="fd-muted mt-3 text-[14px] leading-relaxed">
                {SCORES.day.body}
              </p>
            </article>
            <article className="fd-card rounded-2xl border p-5">
              <div className="flex items-center gap-2">
                <IconMoon className="h-5 w-5 text-yw-amber" aria-hidden />
                <h3 className="fd-heading text-[15px] font-extrabold">
                  {SCORES.night.title}
                </h3>
              </div>
              <p className="fd-accent mt-2 text-[12px] font-bold">
                {SCORES.night.mix}
              </p>
              <p className="fd-muted mt-3 text-[14px] leading-relaxed">
                {SCORES.night.body}
              </p>
            </article>
          </div>
          <p className="fd-muted mt-5 max-w-2xl text-[14px] leading-relaxed">
            {SCORES.shared}
          </p>
          <p className="fd-quiet mt-3 max-w-2xl text-[13px] leading-relaxed">
            {SCORES.research}
          </p>
        </Band>

        <Band id={PARTNERS.id} tone="alt" labelledBy="partners-title">
          <p className="fd-accent text-[13px] font-bold uppercase tracking-wide">
            {PARTNERS.support}
          </p>
          <p className="fd-quiet mt-1 text-[13px]">{EXPLAINER_PARTNERS.supportNote}</p>
          <h2
            id="partners-title"
            className="fd-heading mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {PARTNERS.title}
          </h2>
          <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
            {PARTNERS.lead}
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PARTNERS.orgs.map((org) => (
              <li key={org.id} className="fd-card rounded-2xl border p-5">
                <div className="flex h-32 items-center justify-center rounded-xl bg-white px-4 text-center">
                  <PartnerMark org={org} />
                </div>
                <p className="fd-heading mt-3 text-[15px] font-extrabold">
                  {org.name}
                </p>
                <p className="fd-quiet mt-1 text-[13px]">{org.role}</p>
              </li>
            ))}
          </ul>
        </Band>

        <Band id={TIMELINE.id} labelledBy="timeline-title">
          <h2
            id="timeline-title"
            className="fd-heading text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {TIMELINE.title}
          </h2>
          <dl className="fd-card fd-rule mt-5 divide-y rounded-2xl border">
            {TIMELINE.rows.map((row) => (
              <div
                key={row.when}
                className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="fd-heading w-28 shrink-0 text-[13px] font-bold">
                  {row.when}
                </dt>
                <dd className="fd-muted text-[14px] leading-relaxed">
                  {row.what}
                </dd>
              </div>
            ))}
          </dl>
        </Band>

        <Band id={MEDIA.id} tone="alt" labelledBy="media-title">
          <h2
            id="media-title"
            className="fd-heading text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {MEDIA.title}
          </h2>
          <p className="fd-muted mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
            {MEDIA.lead}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="fd-card rounded-2xl border p-5">
              <h3 className="fd-heading text-[15px] font-extrabold">
                {MEDIA.factsTitle}
              </h3>
              <ul className="fd-muted mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed">
                {MEDIA.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4">
              <div className="fd-card rounded-2xl border p-5">
                <h3 className="fd-heading text-[15px] font-extrabold">
                  {MEDIA.contactTitle}
                </h3>
                <p className="fd-muted mt-2 text-[14px] leading-relaxed">
                  {MEDIA.contact}
                </p>
              </div>
              <div className="fd-card rounded-2xl border p-5">
                <h3 className="fd-heading text-[15px] font-extrabold">
                  {MEDIA.privacyTitle}
                </h3>
                <p className="fd-muted mt-2 text-[14px] leading-relaxed">
                  {MEDIA.privacy}
                </p>
              </div>
            </div>
          </div>
        </Band>

        <Band tone="cta">
          <div className="text-center">
            <p className="text-[13px] font-bold uppercase tracking-wide text-white/70">
              Proudly supported by the City of Casey
            </p>
            <p className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
              Find your walk
            </p>
            <a
              href={PLANNER_URL}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-8 text-[15px] font-bold text-yw-navy shadow-sm"
            >
              {EXPLAINER_HERO.primaryCta}
            </a>
            <p className="mt-3 text-xs text-white/70">app.yourwalk.au</p>
          </div>
        </Band>
      </main>

      <footer className="fd-rule border-t px-4 py-6">
        <div className="fd-quiet mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="fd-heading font-bold">{FOOTER.product}</span>
          <span aria-hidden>·</span>
          <span>{FOOTER.pilot}</span>
          <span aria-hidden>·</span>
          <a href={PLANNER_URL} className="underline-offset-2 hover:underline">
            app.yourwalk.au
          </a>
          <span aria-hidden>·</span>
          <span>{EXPLAINER_FOOTER.method}</span>
          <span aria-hidden>·</span>
          <span>{FOOTER.caveat}</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

import { ICON_REVIEW } from "@/components/resident/icons";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import type { WalkMode } from "@/lib/routing/preferences";

const TOKENS = [
  { name: "Blue", varName: "--yw-blue", hex: "#27AAE1", role: "Night CTA / links / focus" },
  { name: "Navy", varName: "--yw-navy", hex: "#292984", role: "Day CTA / brand wordmark" },
  { name: "Teal", varName: "--yw-teal", hex: "#00AAA6", role: "Recommended / selected" },
  { name: "Lime", varName: "--yw-lime", hex: "#8DC63F", role: "Shade stream" },
  { name: "Green", varName: "--yw-green", hex: "#009444", role: "Origin pin" },
  { name: "Amber", varName: "--yw-amber", hex: "#FFCB1F", role: "After dark highlight" },
  { name: "Orange", varName: "--yw-orange", hex: "#F6871F", role: "Accent / dog bags" },
  { name: "Pink", varName: "--yw-pink", hex: "#EC008C", role: "Destination pin" },
  { name: "Chartreuse", varName: "--yw-chartreuse", hex: "#D7DF23", role: "Sparse accent" },
  { name: "Day surface", varName: "--yw-day-surface", hex: "#F5F7FA", role: "Day chrome" },
  { name: "Night surface", varName: "--yw-night-surface", hex: "#0B0C1A", role: "Night chrome" },
  { name: "Night panel", varName: "--yw-night-panel", hex: "#14152A", role: "Elevated sheets" },
  { name: "Night quiet", varName: "--yw-night-quiet", hex: "#8B8DD9", role: "Unselected night paths" },
] as const;

export default function DesignPage() {
  const [mode, setMode] = useState<WalkMode>("day");
  const isNight = mode === "night";

  return (
    <main
      className={`min-h-dvh px-4 py-8 sm:px-8 ${
        isNight
          ? "bg-yw-night-surface text-white"
          : "bg-yw-day-surface text-slate-900"
      }`}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[#E8ECF2]/60 pb-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/yourwalk-mark.svg"
              alt=""
              width={40}
              height={32}
              className="h-8 w-auto"
              aria-hidden
            />
            <div>
              <h1
                className={`text-2xl font-extrabold tracking-tight ${
                  isNight ? "text-white" : "text-yw-navy"
                }`}
              >
                YourWalk
              </h1>
              <p
                className={`text-sm ${
                  isNight ? "text-white/55" : "text-slate-600"
                }`}
              >
                Resident visual system · Plus Jakarta Sans · MD icons
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WalkModeSwitch
              value={mode}
              onChange={setMode}
              isNight={isNight}
            />
            <Link
              href="/"
              className="text-sm font-semibold text-yw-blue hover:underline"
            >
              Open resident app
            </Link>
          </div>
        </header>

        <section className="mb-10">
          <h2
            className={`mb-1 text-sm font-bold uppercase tracking-wide ${
              isNight ? "text-white/45" : "text-slate-500"
            }`}
          >
            Icon set (Material Design)
          </h2>
          <p
            className={`mb-4 text-sm ${
              isNight ? "text-white/55" : "text-slate-600"
            }`}
          >
            Proposed for the resident form. Swap any glyph after review;
            source is{" "}
            <code className="rounded bg-black/5 px-1 text-xs">
              react-icons/md
            </code>
            .
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ICON_REVIEW.map(({ id, label, Icon, note }) => (
              <li
                key={id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  isNight
                    ? "border-white/10 bg-yw-night-panel"
                    : "border-[#E8ECF2] bg-white"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isNight ? "bg-white/8 text-yw-teal" : "bg-yw-day-surface text-yw-navy"
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{label}</p>
                  <p
                    className={`text-[11px] ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    {note} · {id}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2
            className={`mb-1 text-sm font-bold uppercase tracking-wide ${
              isNight ? "text-white/45" : "text-slate-500"
            }`}
          >
            Colour tokens
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {TOKENS.map((t) => (
              <li
                key={t.varName}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  isNight
                    ? "border-white/10 bg-yw-night-panel"
                    : "border-[#E8ECF2] bg-white"
                }`}
              >
                <span
                  className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-black/5"
                  style={{ background: `var(${t.varName})` }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{t.name}</p>
                  <p
                    className={`font-mono text-[11px] ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    {t.hex} · {t.varName}
                  </p>
                  <p
                    className={`truncate text-[11px] ${
                      isNight ? "text-white/55" : "text-slate-600"
                    }`}
                  >
                    {t.role}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`rounded-2xl border p-5 ${
            isNight
              ? "border-white/10 bg-yw-night-panel"
              : "border-[#E8ECF2] bg-white"
          }`}
        >
          <h2
            className={`mb-2 text-sm font-bold uppercase tracking-wide ${
              isNight ? "text-white/45" : "text-slate-500"
            }`}
          >
            Sheet snaps
          </h2>
          <p
            className={`text-sm ${
              isNight ? "text-white/55" : "text-slate-600"
            }`}
          >
            Resident bottom sheet: peek (~22%) · half (~48%) · full (~72%).
            Drag the handle, use arrow keys, or double-tap to step. Peek keeps
            the map open like Google Maps.
          </p>
        </section>
      </div>
    </main>
  );
}

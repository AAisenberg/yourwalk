"use client";

import { useEffect, useId, useRef, useState } from "react";

import { searchPlaces, type PlaceResult } from "@/lib/routing/geocode";
import type { LngLat } from "@/lib/routing/types";

type Props = {
  label: string;
  placeholder: string;
  dot: string;
  isNight: boolean;
  valueLabel: string;
  pickActive: boolean;
  onPickToggle: () => void;
  onPlace: (place: { center: LngLat; label: string }) => void;
};

export function PlaceField({
  label,
  placeholder,
  dot,
  isNight,
  valueLabel,
  pickActive,
  onPickToggle,
  onPlace,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setQuery("");
  }, [valueLabel, editing]);

  useEffect(() => {
    if (!editing || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const places = await searchPlaces(query, token, 5);
        setResults(places);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, editing]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showValue = !editing && valueLabel;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${
          pickActive
            ? "ring-[#27AAE1]"
            : isNight
              ? "bg-[#0B0C1A] ring-white/10"
              : "bg-white ring-slate-200"
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: dot }}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isNight ? "text-white/40" : "text-slate-400"
            }`}
          >
            {label}
          </div>
          {showValue ? (
            <button
              type="button"
              className="w-full truncate text-left text-sm font-semibold"
              onClick={() => {
                setEditing(true);
                setQuery("");
              }}
            >
              {valueLabel}
            </button>
          ) : (
            <input
              className={`w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal ${
                isNight
                  ? "placeholder:text-white/30"
                  : "placeholder:text-slate-400"
              }`}
              placeholder={placeholder}
              value={query}
              autoFocus={editing}
              onChange={(e) => {
                setEditing(true);
                setQuery(e.target.value);
              }}
              onFocus={() => setEditing(true)}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onPickToggle}
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${
            pickActive
              ? "bg-[#27AAE1] text-white"
              : isNight
                ? "bg-white/10 text-white/70"
                : "bg-slate-100 text-slate-600"
          }`}
          title="Pick on map"
        >
          Map
        </button>
      </div>

      {open && editing && (results.length > 0 || loading) ? (
        <ul
          id={listId}
          className={`absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-lg ${
            isNight
              ? "border-white/10 bg-[#0B0C1A]"
              : "border-slate-200 bg-white"
          }`}
        >
          {loading && results.length === 0 ? (
            <li
              className={`px-3 py-2 text-xs ${
                isNight ? "text-white/40" : "text-slate-400"
              }`}
            >
              Searching…
            </li>
          ) : null}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#27AAE1]/15 ${
                  isNight ? "text-white" : "text-slate-800"
                }`}
                onClick={() => {
                  onPlace({ center: r.center, label: r.place_name });
                  setEditing(false);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="block font-medium">{r.label}</span>
                <span
                  className={`block truncate text-[11px] ${
                    isNight ? "text-white/40" : "text-slate-500"
                  }`}
                >
                  {r.place_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

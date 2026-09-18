"use client";

import {
  isAnalyticsEventName,
  sanitizeProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@/lib/analytics/events";

const DEVICE_KEY = "yw-analytics-device-v1";
const VISIT_KEY = "yw-analytics-visit-v1";
export const ANALYTICS_OPT_OUT_KEY = "yw-resident-analytics-opt-out";

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isAnalyticsOptedOut(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    return true;
  }
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optOut) window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    /* private mode */
  }
}

export function analyticsDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = randomUuid();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function markAnalyticsVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(VISIT_KEY) === "1") return false;
    window.sessionStorage.setItem(VISIT_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

export function deviceClass(): "phone" | "desktop" {
  if (typeof window === "undefined") return "phone";
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "phone";
}

export function track(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (typeof window === "undefined") return;
  if (!isAnalyticsEventName(eventName)) return;
  if (isAnalyticsOptedOut()) return;
  const sessionId = analyticsDeviceId();
  if (!sessionId) return;

  const body = JSON.stringify({
    session_id: sessionId,
    event_name: eventName,
    properties: sanitizeProperties(properties),
  });

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* swallow — analytics must never break the planner */
  });
}

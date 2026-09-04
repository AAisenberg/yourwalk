import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * Share card for yourwalk.au — mark + wordmark on a day / night split,
 * built from visual system tokens (docs/FRONT_DOOR.md § Metadata and
 * sharing). Not a raw UI screenshot.
 */

export const alt = "YourWalk: find your walk in Casey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadJakarta(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-800-normal.woff",
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const mark = await readFile(
    join(process.cwd(), "public/brand/yourwalk-mark.svg"),
  );
  const markSrc = `data:image/svg+xml;base64,${mark.toString("base64")}`;
  const jakarta = await loadJakarta();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Day surface left, night surface right — the product's signature
          background: "linear-gradient(90deg, #F5F7FA 0%, #F5F7FA 50%, #0B0C1A 50%, #0B0C1A 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#FFFFFF",
            border: "1px solid #E8ECF2",
            borderRadius: 40,
            padding: "56px 88px",
            boxShadow: "0 24px 64px rgba(11, 12, 26, 0.35)",
          }}
        >
          <img src={markSrc} width={140} height={109} alt="" />
          <div
            style={{
              marginTop: 28,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: -2,
              color: "#292984",
            }}
          >
            YourWalk
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 34,
              fontWeight: 800,
              color: "#475569",
            }}
          >
            Find your walk in Casey
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 24,
              color: "#64748B",
            }}
          >
            A City of Casey Connecting Grant pilot
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: jakarta
        ? [
            {
              name: "Plus Jakarta Sans",
              data: jakarta,
              weight: 800,
              style: "normal",
            },
          ]
        : undefined,
    },
  );
}

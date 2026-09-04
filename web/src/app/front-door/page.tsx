import type { Metadata } from "next";

import { FrontDoorPage } from "@/components/front-door/FrontDoorPage";

/**
 * Public front door, served on yourwalk.au via host rewrite in src/proxy.ts
 * (docs/FRONT_DOOR.md, ADR-012, backlog X8). Press and partners, not the
 * resident planner. No login, no email capture.
 */

const DESCRIPTION =
  "A City of Casey Connecting Grant pilot: YourWalk helps Casey residents " +
  "find walking routes that fit what matters, smoother footpaths, more " +
  "shade on hot days, or better-lit streets after dark.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yourwalk.au"),
  title: "YourWalk: find your walk in Casey",
  description: DESCRIPTION,
  alternates: { canonical: "https://yourwalk.au" },
  openGraph: {
    title: "YourWalk: find your walk in Casey",
    description: DESCRIPTION,
    url: "https://yourwalk.au",
    siteName: "YourWalk",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YourWalk: find your walk in Casey",
    description: DESCRIPTION,
  },
};

export default function Page() {
  return <FrontDoorPage />;
}

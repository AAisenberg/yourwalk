import type { MetadataRoute } from "next";

/** Minimal sitemap: the apex front door only (docs/FRONT_DOOR.md). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://yourwalk.au",
      lastModified: new Date("2026-09-04"),
      changeFrequency: "monthly",
    },
  ];
}

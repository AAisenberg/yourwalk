import { OVERLAY_ICONS } from "@/components/resident/icons";
import { OVERLAY_DEFS, type OverlayId } from "@/lib/overlays";

export function RingedAmenityIcon({
  id,
  size = "md",
  muted = false,
}: {
  id: OverlayId;
  size?: "sm" | "md";
  muted?: boolean;
}) {
  const def = OVERLAY_DEFS.find((d) => d.id === id);
  const Icon = OVERLAY_ICONS[id];
  if (!def) return null;
  const box = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const glyph = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-2 ${box} ${
        muted ? "opacity-40 ring-white/70" : "ring-white"
      }`}
      style={{ backgroundColor: def.color }}
      aria-hidden
    >
      <Icon className={`${glyph} text-white`} />
    </span>
  );
}

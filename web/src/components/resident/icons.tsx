/**
 * Material Design icons (react-icons/md) used on the resident form.
 * Review the set on /design.
 */
import type { IconType } from "react-icons";
import {
  MdArrowForward,
  MdChair,
  MdLoop,
  MdMyLocation,
  MdNightlight,
  MdPets,
  MdRoute,
  MdSwapHoriz,
  MdWaterDrop,
  MdWbSunny,
  MdWc,
} from "react-icons/md";

import type { OverlayId } from "@/lib/overlays";
import type { OutingShape } from "@/lib/routing/planOuting";

export const IconSun = MdWbSunny;
export const IconMoon = MdNightlight;
export const IconLocate = MdMyLocation;
export const IconTrip = MdRoute;
export const IconOuting = MdLoop;
export const IconLoop = MdLoop;
export const IconOutAndBack = MdSwapHoriz;
export const IconOneWay = MdArrowForward;
export const IconFountain = MdWaterDrop;
export const IconBench = MdChair;
export const IconToilet = MdWc;
export const IconDogBag = MdPets;

export const OVERLAY_ICONS: Record<OverlayId, IconType> = {
  fountains: IconFountain,
  benches: IconBench,
  toilets: IconToilet,
  dog_bags: IconDogBag,
};

export const SHAPE_ICONS: Record<OutingShape, IconType> = {
  loop: IconLoop,
  out_and_back: IconOutAndBack,
  one_way: IconOneWay,
};

export const ICON_REVIEW: {
  id: string;
  label: string;
  Icon: IconType;
  note: string;
}[] = [
  { id: "sun", label: "Day", Icon: IconSun, note: "Day/Night switch (icon-only)" },
  { id: "moon", label: "Night", Icon: IconMoon, note: "Day/Night switch (icon-only)" },
  { id: "locate", label: "My location", Icon: IconLocate, note: "Map FAB" },
  { id: "trip", label: "A to B", Icon: IconTrip, note: "Corridor / trip" },
  { id: "outing", label: "Around here", Icon: IconOuting, note: "Circuit / outing" },
  { id: "loop", label: "Loop", Icon: IconLoop, note: "Shape" },
  {
    id: "out_and_back",
    label: "There and back",
    Icon: IconOutAndBack,
    note: "Shape",
  },
  {
    id: "fountains",
    label: "Drinking fountains",
    Icon: IconFountain,
    note: "Along the way",
  },
  { id: "benches", label: "Benches", Icon: IconBench, note: "Along the way" },
  { id: "toilets", label: "Toilets", Icon: IconToilet, note: "Along the way" },
  { id: "dog_bags", label: "Dog bags", Icon: IconDogBag, note: "Along the way" },
];

// Shared backend contracts. Pure types + validation only: no framework or
// runtime imports, so both route handlers and future runtimes can use them.
import { z } from "zod";
import { cities, type City } from "@/lib/cities";

const CITY_ID_SET = new Set(cities.map((city) => city.id));

export type PreviewTrack = {
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
  // Metadata sourced from Apple Music for the in-app music notes window.
  album?: string;
  genre?: string;
  year?: string;
  appleMusicUrl?: string;
};

export type PreviewResponse = {
  city: string;
  tracks: PreviewTrack[];
};

export type RadioSource = "radio-garden" | "radio-browser" | "none";

export type RadioResponse = {
  city: string;
  streamUrl: string | null;
  station: string | null;
  source: RadioSource;
};

export type ParsedCity =
  | { success: true; city: City }
  | { success: false; error: string };

// City ids must exist in the curated list; anything else is a bad request.
export function parseCityId(raw: string | null | undefined): ParsedCity {
  const parsed = z.string().safeParse(raw);
  if (!parsed.success) return { success: false, error: "missing city id" };
  if (!CITY_ID_SET.has(parsed.data)) return { success: false, error: `unknown city: ${parsed.data}` };
  const city = cities.find((entry) => entry.id === parsed.data)!;
  return { success: true, city };
}

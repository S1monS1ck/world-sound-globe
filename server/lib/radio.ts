// Radio lookup via the open Radio Browser directory (free, keyless, ODbL).
// Radio Garden was planned as the primary source but its API sits behind a
// Cloudflare browser challenge that server-side calls cannot pass, so it is
// kept as a future enhancement only; the "radio-garden" source stays in the
// response contract for forward compatibility.
// https://api.radio-browser.info/
import type { City } from "@/lib/cities";
import type { RadioResponse } from "./types";

type RadioBrowserStation = {
  name?: string;
  url_resolved?: string;
  tags?: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
// Radio Browser asks clients to identify themselves via User-Agent.
const RADIO_BROWSER_HOST = "https://de1.api.radio-browser.info";
const REQUESTinit: RequestInit = {
  headers: { "User-Agent": "WorldSoundGlobe/0.1 (competition prototype)" },
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
};
const cache = new Map<string, { response: RadioResponse; expires: number }>();

// The directory uses its own country spellings; query by the curated name and
// fall back to a station-name search for mismatches like "DR Congo".
async function searchStations(query: { type: string; value: string }): Promise<RadioBrowserStation[]> {
  const params = new URLSearchParams({
    [query.type]: query.value,
    limit: "6",
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  const response = await fetch(`${RADIO_BROWSER_HOST}/json/stations/search?${params.toString()}`, REQUESTinit);
  if (!response.ok) return [];
  return (await response.json()) as RadioBrowserStation[];
}

function firstPlayable(stations: RadioBrowserStation[]): { streamUrl: string; station: string } | null {
  const playable = stations.filter((station) => station.url_resolved?.startsWith("http"));
  // HLS (m3u8) needs hls.js; plain audio element only plays direct streams,
  // so prefer mp3/aac style URLs when the directory offers both.
  const direct = playable.find((station) => !station.url_resolved!.includes("m3u8"));
  const chosen = direct ?? playable[0];
  if (!chosen?.url_resolved) return null;
  return { streamUrl: chosen.url_resolved, station: chosen.name ?? "Unknown station" };
}

export async function getCityRadio(cityId: string, city: City): Promise<RadioResponse> {
  const cached = cache.get(cityId);
  if (cached && cached.expires > Date.now()) return cached.response;

  let streamUrl: string | null = null;
  let station: string | null = null;
  try {
    // Primary: stations inside the city's country, most listened first.
    const byCountry = await searchStations({ type: "country", value: city.country });
    const pick = firstPlayable(byCountry);
    if (pick) {
      streamUrl = pick.streamUrl;
      station = pick.station;
    } else {
      // Fallback: station names containing the city (e.g. "Radio Beijing").
      const byName = await searchStations({ type: "name", value: city.name });
      const namePick = firstPlayable(byName);
      if (namePick) {
        streamUrl = namePick.streamUrl;
        station = namePick.station;
      }
    }
  } catch {
    // Timeout or upstream failure degrades to silence, never a 500.
  }
  const response: RadioResponse = { city: cityId, streamUrl, station, source: streamUrl ? "radio-browser" : "none" };
  // Pin successes for an hour, but let failures retry after a short cooldown
  // so one transient timeout never mutes a city for the full hour.
  cache.set(cityId, { response, expires: Date.now() + (streamUrl ? CACHE_TTL_MS : 30_000) });
  return response;
}

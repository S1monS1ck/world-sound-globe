// iTunes Search API preview lookup. Free, keyless, rate limited to roughly
// 20 calls/minute — hence the per-city result cache with a 1 hour TTL.
// https://performance-partners.apple.com/search-api
import { cities, type City } from "@/lib/cities";
import type { PreviewResponse, PreviewTrack } from "./types";

type ITunesResult = {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackViewUrl?: string;
};

type ITunesResponse = { results?: ITunesResult[] };

const CACHE_TTL_MS = 60 * 60 * 1000;
const TRACKS_PER_CITY = 3;
const cache = new Map<string, { response: PreviewResponse; expires: number }>();

// The city's curated sound tags ("Mandopop · Rock · Indie") carry the local
// flavour; the first tag keeps a single upstream call per city.
function searchTermFor(city: City) {
  return city.sound.split("·")[0]?.trim() || city.name;
}

function toTrack(result: ITunesResult): PreviewTrack | null {
  if (!result.previewUrl || !result.trackName) return null;
  return {
    title: result.trackName,
    artist: result.artistName ?? "Unknown artist",
    previewUrl: result.previewUrl,
    // Bump the 100px artwork Apple returns to a crisper 200px rendering.
    artworkUrl: (result.artworkUrl100 ?? "").replace("100x100", "200x200"),
    album: result.collectionName,
    genre: result.primaryGenreName,
    year: result.releaseDate?.slice(0, 4),
    appleMusicUrl: result.trackViewUrl,
  };
}

export async function getCityPreviews(cityId: string, city: City): Promise<PreviewResponse> {
  const cached = cache.get(cityId);
  if (cached && cached.expires > Date.now()) return cached.response;

  const params = new URLSearchParams({
    term: searchTermFor(city),
    entity: "song",
    limit: String(TRACKS_PER_CITY * 4),
    media: "music",
  });
  let tracks: PreviewTrack[] = [];
  try {
    const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      next: { revalidate: CACHE_TTL_MS / 1000 },
    });
    if (response.ok) {
      const data = (await response.json()) as ITunesResponse;
      const seen = new Set<string>();
      tracks = (data.results ?? [])
        .map(toTrack)
        .filter((track): track is PreviewTrack => Boolean(track?.previewUrl))
        .filter((track) => {
          // Dedupe live versions and re-releases of the same recording.
          const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, TRACKS_PER_CITY);
    }
  } catch {
    // Upstream failure degrades to an empty track list; the UI shows silence.
    tracks = [];
  }
  const response: PreviewResponse = { city: cityId, tracks };
  cache.set(cityId, { response, expires: Date.now() + CACHE_TTL_MS });
  return response;
}

// Keep the city list referenced so the signature stays type-safe if callers
// pass an unvalidated id; the route handler always resolves the City first.
export const PREVIEW_CITY_IDS = cities.map((city) => city.id);

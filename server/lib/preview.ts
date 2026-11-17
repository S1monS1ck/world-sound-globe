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
  trackTimeMillis?: number;
  copyright?: string;
  trackViewUrl?: string;
};

type ITunesResponse = { results?: ITunesResult[] };

const CACHE_TTL_MS = 60 * 60 * 1000;
const TRACKS_PER_CITY = 5;
const cache = new Map<string, { response: PreviewResponse; expires: number }>();

function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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
    duration: result.trackTimeMillis ? formatDuration(result.trackTimeMillis) : undefined,
    copyright: result.copyright,
    appleMusicUrl: result.trackViewUrl,
  };
}

function trackKey(track: PreviewTrack) {
  return `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
}

async function searchSongs(
  term: string,
  seen: Set<string>,
  seenArtists: Set<string>,
): Promise<PreviewTrack[]> {
  const params = new URLSearchParams({
    term,
    entity: "song",
    limit: String(TRACKS_PER_CITY * 4),
    media: "music",
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    next: { revalidate: CACHE_TTL_MS / 1000 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as ITunesResponse;
  return (data.results ?? [])
    .map(toTrack)
    .filter((track): track is PreviewTrack => Boolean(track?.previewUrl))
    .filter((track) => {
      // Dedupe live versions and re-releases: same recording and, more
      // loosely, the same artist keeps the queue varied. The sets are shared
      // across search terms so both names never repeat an artist.
      const key = trackKey(track);
      const artist = track.artist.toLowerCase();
      if (seen.has(key) || seenArtists.has(artist)) return false;
      seen.add(key);
      seenArtists.add(artist);
      return true;
    });
}

export async function getCityPreviews(cityId: string, city: City): Promise<PreviewResponse> {
  const cached = cache.get(cityId);
  if (cached && cached.expires > Date.now()) return cached.response;

  let tracks: PreviewTrack[] = [];
  try {
    // Primary: songs about the city itself. Searching both the English and
    // the local name ("Beijing" + "北京") mixes international and home-town
    // classics instead of five identical titles. The genre tag alone pulled
    // unrelated cities' songs (e.g. 《成都》 listed under Beijing), so it is
    // only used to top up thin catalogs.
    const seen = new Set<string>();
    const seenArtists = new Set<string>();
    const terms = [...new Set([city.name, city.nameZh].filter(Boolean))];
    const perTerm = Math.ceil(TRACKS_PER_CITY / 2);
    for (const term of terms) {
      if (tracks.length >= TRACKS_PER_CITY) break;
      const found = await searchSongs(term, seen, seenArtists);
      let taken = 0;
      for (const track of found) {
        // Cap each name's share so both the international and the home-town
        // catalogue are represented instead of five identical titles.
        if (taken >= perTerm || tracks.length >= TRACKS_PER_CITY) break;
        tracks.push(track);
        taken += 1;
      }
    }
    // Fallback: the curated genre keeps thin catalogs audible.
    if (tracks.length < TRACKS_PER_CITY) {
      const genreTerm = city.sound.split("·")[0]?.trim();
      const genreTracks = genreTerm ? await searchSongs(genreTerm, seen, seenArtists) : [];
      tracks.push(...genreTracks);
    }
    tracks = tracks.slice(0, TRACKS_PER_CITY);
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

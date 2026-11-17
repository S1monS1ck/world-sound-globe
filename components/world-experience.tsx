"use client";

import {
  ArrowLeft,
  ChevronRight,
  Globe2,
  Languages,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Info, Loader2 } from "lucide-react";
import { cities, getCity, type City } from "@/lib/cities";
import { getCityScene } from "@/lib/city-scenes";
import { getCitySignature } from "@/lib/city-signatures";
import { companionLandmarksFor, curatedFor } from "@/lib/curated";
import type { PreviewTrack, RadioResponse } from "@/server/lib/types";
import { SceneErrorBoundary } from "@/components/scene-error-boundary";

// WebGL only exists in the browser: keep the 3D stage out of server rendering.
const WorldStage = dynamic(
  () => import("@/components/world-stage").then((module) => ({ default: module.WorldStage })),
  { ssr: false, loading: () => <div className="scene-loading" aria-hidden="true" /> },
);

type Locale = "zh" | "en";
type ListeningMode = "now" | "soul";

const copy = {
  zh: {
    title: "世界正在发声",
    subtitle: "旋转地球，靠近一座城市，听见此刻与地方的记忆。",
    enter: "进入地球",
    note: "拖动旋转 · 滚轮缩放 · 点击城市",
    live: "真实昼夜",
    explore: "探索城市",
    now: "此刻",
    soul: "地方之声",
    nowDescription: "当地近期流行",
    soulDescription: "语言、流派与城市记忆",
    global: "全球视角",
    noCity: "轻点城市光点，或点悬停时出现的城市名。",
    indexed: "座代表性城市已索引",
    playing: "正在预览播放动效",
    paused: "播放动效未启动",
    mock: "视觉预览 · 尚未连接音源",
    searchPlaceholder: "搜索城市、国家或地区",
    searchTitle: "城市索引",
    results: "个结果",
    performance: "自适应画质",
    musicSource: "音源待接入",
    reset: "返回地球",
    cityMode: "城市频道",
    soundprint: "声纹",
    bpm: "BPM",
    musicNotes: "音乐介绍 · APPLE MUSIC",
    noTrackInfo: "这座城市暂无曲目信息。",
    liveNow: "正在直播",
    previewClip: "官方 30 秒试听",
    loadingAudio: "正在连接音源…",
    audioFailed: "音源不可用 · 已静音",
    liveLabel: "直播电台",
    appleSource: "官方试听 · Apple Music",
    playAudio: "播放",
    stopAudio: "停止",
    navSearch: "搜索",
    nowPlaying: "正在播放",
    liveBadge: "直播中",
  },
  en: {
    title: "The world is sounding",
    subtitle: "Turn the globe. Move closer. Hear the present and the memory of a place.",
    enter: "Enter earth",
    note: "Drag to rotate · Scroll to zoom · Select a city",
    live: "Live daylight",
    explore: "Explore cities",
    now: "Now",
    soul: "Local voices",
    nowDescription: "What the city is playing lately",
    soulDescription: "Language, genre and urban memory",
    global: "Global view",
    noCity: "Tap a city light, or click the name that appears on hover.",
    indexed: "representative cities indexed",
    playing: "Previewing playback motion",
    paused: "Playback preview stopped",
    mock: "Visual preview · No audio source connected",
    searchPlaceholder: "Search city, country or region",
    searchTitle: "City index",
    results: "results",
    performance: "Adaptive quality",
    musicSource: "Audio source pending",
    reset: "Return to earth",
    cityMode: "City channel",
    soundprint: "SOUNDPRINT",
    bpm: "BPM",
    musicNotes: "MUSIC NOTES · APPLE MUSIC",
    noTrackInfo: "No track info for this city yet.",
    liveNow: "Live broadcast",
    previewClip: "Official 30-second preview",
    loadingAudio: "Connecting to audio…",
    audioFailed: "Audio unavailable · muted",
    liveLabel: "Live radio",
    appleSource: "Official preview · Apple Music",
    playAudio: "Play",
    stopAudio: "Stop",
    navSearch: "Search",
    nowPlaying: "Now playing",
    liveBadge: "Live",
  },
} as const;

function formatBeijingTime(locale: Locale, value: Date) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function cityDisplayName(city: City, locale: Locale) {
  return locale === "zh" ? city.nameZh : city.name;
}

function WebGLFallback({ locale }: { locale: Locale }) {
  return (
    <div className="webgl-fallback" role="alert">
      <Globe2 aria-hidden="true" />
      <h2>{locale === "zh" ? "3D 地球暂时无法启动" : "The 3D globe could not start"}</h2>
      <p>
        {locale === "zh"
          ? "你的浏览器或显卡当前未提供 WebGL。页面其余功能仍可使用；请更新浏览器或开启硬件加速后重试。"
          : "WebGL is unavailable in this browser or graphics session. The rest of the interface remains usable; update the browser or enable hardware acceleration and try again."}
      </p>
    </div>
  );
}

export function WorldExperience() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [mode, setMode] = useState<ListeningMode>("now");
  const [entered, setEntered] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Double click asks for the fast camera flight instead of the cinematic one.
  const [quickFocus, setQuickFocus] = useState(false);
  // Apple Music track notes for the selected city, served by /api/preview.
  const [cityTracks, setCityTracks] = useState<PreviewTrack[]>([]);
  const [musicInfoOpen, setMusicInfoOpen] = useState(false);
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Delayed unmount lets the drawer play its exit animation before removal.
  const [searchClosing, setSearchClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  type PlayState = "idle" | "loading" | "playing" | "error";
  const [playState, setPlayState] = useState<PlayState>("idle");
  // Real audio sources: live radio for "now", Apple previews for "soul".
  const [radio, setRadio] = useState<RadioResponse | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Apple Music style full-screen now playing view.
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const selectedCity = getCity(selectedId);
  const selectedScene = selectedCity ? getCityScene(selectedCity.id) : undefined;
  const selectedSignature = selectedCity ? getCitySignature(selectedCity.id) : undefined;
  const t = copy[locale];

  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    setWebgl(Boolean(context));
    context?.getExtension("WEBGL_lose_context")?.loseContext();

    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);

    return () => {
      window.clearInterval(timer);
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, []);

  // Persist the language choice across visits, same as the original prototype.
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    try {
      window.localStorage.setItem("wsg:lang", locale);
    } catch {
      // Storage can be unavailable (private mode); the UI still works.
    }
  }, [locale]);

  // Fetch the local live radio station whenever the selected city changes.
  useEffect(() => {
    if (!selectedCity) {
      setRadio(null);
      return;
    }
    let current = true;
    setRadio(null);
    fetch(`/api/radio?city=${selectedCity.id}`)
      .then((response) => (response.ok ? (response.json() as Promise<RadioResponse>) : null))
      .then((data) => {
        if (current && data) setRadio(data);
      })
      .catch(() => {
        // Radio stays null; the player shows the muted fallback.
      });
    return () => {
      current = false;
    };
  }, [selectedCity]);

  // Any city or mode change stops playback and resets the transport.
  useEffect(() => {
    audioRef.current?.pause();
    setPlayState("idle");
    setProgress(0);
    setTrackIndex(0);
  }, [selectedCity?.id, mode]);

  const currentAudioSrc = mode === "now"
    ? radio?.streamUrl ?? null
    : cityTracks[trackIndex]?.previewUrl ?? null;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playState === "playing") {
      audio.pause();
      setPlayState("idle");
      return;
    }
    if (!currentAudioSrc) return;
    audio.src = currentAudioSrc;
    setPlayState("loading");
    audio.play().catch(() => setPlayState("error"));
  }, [playState, currentAudioSrc]);

  // Fetch the Apple Music track notes whenever the selected city changes.
  useEffect(() => {
    if (!selectedCity) {
      setCityTracks([]);
      return;
    }
    let current = true;
    fetch(`/api/preview?city=${selectedCity.id}`)
      .then((response) => (response.ok ? (response.json() as Promise<{ tracks?: PreviewTrack[] }>) : { tracks: [] }))
      .then((data: { tracks?: PreviewTrack[] }) => {
        if (current) setCityTracks(data.tracks ?? []);
      })
      .catch(() => {
        if (current) setCityTracks([]);
      });
    return () => {
      current = false;
    };
  }, [selectedCity]);

  const filteredCities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cities;
    return cities.filter((city) =>
      [
        city.name,
        city.nameZh,
        city.localName,
        city.country,
        city.countryZh,
        city.region,
        city.sound,
        city.soundZh,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  const closeSearch = useCallback(() => {
    if (searchClosing) return;
    setSearchClosing(true);
    window.setTimeout(() => {
      setSearchOpen(false);
      setSearchClosing(false);
    }, 280);
  }, [searchClosing]);

  const selectCity = useCallback((id: string, quick = false) => {
    setSelectedId(id);
    setQuickFocus(quick);
    setHoveredCity(null);
    closeSearch();
    setQuery("");
    setProgress(0);
  }, [closeSearch]);

  const returnToEarth = useCallback(() => {
    setSelectedId(null);
    setQuickFocus(false);
    setHoveredCity(null);
    audioRef.current?.pause();
    setPlayState("idle");
    setProgress(0);
  }, []);

  // Escape closes the topmost layer first: drawer, then the city focus.
  useEffect(() => {
    if (!entered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape closes the topmost layer: now playing, notes, drawer, city focus.
      if (nowPlayingOpen) {
        setNowPlayingOpen(false);
        return;
      }
      if (musicInfoOpen) {
        setMusicInfoOpen(false);
        return;
      }
      if (searchOpen) {
        closeSearch();
        return;
      }
      if (selectedId) returnToEarth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, nowPlayingOpen, musicInfoOpen, searchOpen, selectedId, returnToEarth, closeSearch]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is an enhancement; the experience remains usable if denied.
    }
  };

  // Player display: real station/track metadata when available, concept copy
  // while the source is still loading or unavailable.
  const track = selectedCity
    ? mode === "now"
      ? radio?.station
        ? { title: radio.station, artist: `${t.liveLabel} · ${locale === "zh" ? selectedCity.nameZh : selectedCity.name}` }
        : {
            title: locale === "zh" ? `${selectedCity.nameZh}，此刻` : `${selectedCity.name}, now`,
            artist: radio ? t.audioFailed : locale === "zh" ? "正在寻找当地电台" : "Looking for a local station",
          }
      : cityTracks[trackIndex]
        ? { title: cityTracks[trackIndex].title, artist: cityTracks[trackIndex].artist }
        : {
            title: locale === "zh" ? `${selectedCity.nameZh}的地方之声` : `Local voices of ${selectedCity.name}`,
            artist: cityTracks.length === 0 ? t.noTrackInfo : locale === "zh" ? selectedCity.soundZh : selectedCity.sound,
          }
    : {
        title: locale === "zh" ? "等待一座城市" : "Waiting for a city",
        artist: locale === "zh" ? "世界声音地图" : "World sound atlas",
      };

  return (
    <main className={`experience-shell ${entered ? "is-entered" : "is-landing"}`}>
      <div className={`stage ${!entered ? "is-intro" : ""} ${selectedCity ? "is-city" : ""}`} aria-label={locale === "zh" ? "可交互三维地球" : "Interactive 3D earth"}>
        {webgl ? (
          <SceneErrorBoundary fallback={<WebGLFallback locale={locale} />}>
            <WorldStage
              cities={cities}
              selectedCity={selectedCity}
              onSelect={selectCity}
              onHover={setHoveredCity}
              reducedMotion={reducedMotion}
              active={entered}
              quickFocus={quickFocus}
              onAutoReturn={returnToEarth}
            />
          </SceneErrorBoundary>
        ) : (
          <WebGLFallback locale={locale} />
        )}
      </div>

      <div className="film-grain" aria-hidden="true" />
      <div className="edge-vignette" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" type="button" onClick={returnToEarth} aria-label={t.global}>
          <span className="brand-mark"><span /></span>
          <span>
            <strong>WORLD / SOUND</strong>
            <small>AN ATLAS OF PLACES & SOUND</small>
          </span>
        </button>

        <div className="mode-switch" role="group" aria-label={locale === "zh" ? "收听模式" : "Listening mode"}>
          <button className={mode === "now" ? "active" : ""} onClick={() => setMode("now")} type="button">
            <span>{t.now}</span>
            <small>{t.nowDescription}</small>
          </button>
          <button className={mode === "soul" ? "active" : ""} onClick={() => setMode("soul")} type="button">
            <span>{t.soul}</span>
            <small>{t.soulDescription}</small>
          </button>
        </div>

        <div className="top-actions">
          <div className="earth-clock" title={locale === "zh" ? "北京时间" : "Beijing time"}>
            <span className="live-dot" />
            <span>{t.live}</span>
            <strong>{clock ? formatBeijingTime(locale, clock) : "--:--:--"}</strong>
          </div>
          <button type="button" className="nav-search" onClick={() => setSearchOpen(true)}>
            <Search aria-hidden="true" />
            <span>{t.navSearch}</span>
          </button>
          <button type="button" className="icon-button language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} aria-label="Switch language">
            <Languages aria-hidden="true" />
            <span>{locale === "zh" ? "EN" : "中"}</span>
          </button>
          <button type="button" className="icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className={`place-card ${selectedCity ? "is-visible" : ""}`} aria-live="polite">
        <div className="card-content" key={selectedCity?.id ?? "global"}>
          {selectedCity ? (
          <>
            <button className="back-to-earth" type="button" onClick={returnToEarth}>
              <ArrowLeft aria-hidden="true" /> {t.reset}
            </button>
            <p className="eyebrow">{selectedCity.region} · {t.cityMode}</p>
            <div className="place-title-row">
              <div>
                <span className="local-name">{selectedCity.localName}</span>
                <h1>{cityDisplayName(selectedCity, locale)}</h1>
              </div>
              <span className="city-index">{String(cities.indexOf(selectedCity) + 1).padStart(2, "0")}</span>
            </div>
            <p className="country-line">
              {locale === "zh" ? selectedCity.countryZh : selectedCity.country}
              <span />
              {locale === "zh" ? selectedCity.soundZh : selectedCity.sound}
            </p>
            <p className="city-character">
              {locale === "zh" ? selectedCity.characterZh : selectedCity.character}
            </p>
            {curatedFor(selectedCity.id) && (
              <p className="soundprint-meta">
                {t.soundprint} {curatedFor(selectedCity.id)!.serial} · {curatedFor(selectedCity.id)!.bpm} {t.bpm}
                <span>
                  {(locale === "zh" ? curatedFor(selectedCity.id)!.keywordsZh : curatedFor(selectedCity.id)!.keywordsEn).join(" · ")}
                </span>
              </p>
            )}
            <p className="scene-detail">
              {companionLandmarksFor(selectedCity.id).length > 0
                ? companionLandmarksFor(selectedCity.id)
                    .map((landmark) => (locale === "zh" ? landmark.nameZh : landmark.name))
                    .join(" · ")
                : selectedScene
                  ? (locale === "zh" ? selectedScene.landmarkNameZh : selectedScene.landmarkName)
                  : selectedSignature
                    ? (locale === "zh" ? `${selectedSignature.nameZh} · 造型速写` : `${selectedSignature.name} · visual sketch`)
                    : (locale === "zh" ? "城市建筑速写 · 风格化场景" : "Architectural sketch · stylized scene")}
              {selectedScene && <small>{selectedScene.lat.toFixed(5)}° / {selectedScene.lon.toFixed(5)}°</small>}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">WORLD INDEX · 01</p>
            <h1>{t.global}</h1>
            <p className="city-character">{t.noCity}</p>
            <button className="text-action" type="button" onClick={() => setSearchOpen(true)}>
              {t.explore} <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
        </div>
      </section>

      {hoveredCity && !selectedCity && (
        <div className="hover-caption" aria-hidden="true">
          <span>{hoveredCity.localName}</span>
          <strong>{cityDisplayName(hoveredCity, locale)}</strong>
          <small>{locale === "zh" ? hoveredCity.soundZh : hoveredCity.sound}</small>
        </div>
      )}

      <aside className="system-rail" aria-label={locale === "zh" ? "系统状态" : "System status"}>
        <div><Globe2 aria-hidden="true" /><span>{cities.length} {t.indexed}</span></div>
        <small>NATURAL EARTH / NIGHT LIGHTS</small>
      </aside>
      {selectedScene && <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}

      <section className="player" aria-label={locale === "zh" ? "播放器" : "Player"}>
        <div
          className={`record-art ${playState === "playing" ? "spinning" : ""}`}
          style={{ "--city-accent": selectedCity?.accent ?? "#8caab3" } as CSSProperties}
          role="button"
          tabIndex={0}
          onClick={() => selectedCity && setNowPlayingOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setNowPlayingOpen(true);
          }}
          aria-label={t.nowPlaying}
        >
          <span />
        </div>
        <div className="track-meta">
          <p>{track.title}</p>
          <span>{track.artist}</span>
          <small className="compact-preview-note">{t.mock}</small>
        </div>
        <button
          type="button"
          className="play-button"
          onClick={togglePlay}
          disabled={!selectedCity || (playState !== "playing" && !currentAudioSrc)}
          aria-label={playState === "playing" ? t.stopAudio : t.playAudio}
        >
          {playState === "loading" ? (
            <Loader2 className="spin-icon" aria-hidden="true" />
          ) : playState === "playing" ? (
            <Pause fill="currentColor" aria-hidden="true" />
          ) : (
            <Play fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <div className="timeline">
          <div className="waveform" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => (
              <i
                key={index}
                className={index / 42 < progress / 100 ? "passed" : ""}
                style={{ height: `${5 + ((index * 17) % 18)}px` }}
              />
            ))}
          </div>
          <div className="timeline-caption">
            <span>
              {playState === "loading"
                ? t.loadingAudio
                : playState === "error"
                  ? t.audioFailed
                  : playState === "playing"
                    ? mode === "now" ? t.liveNow : t.previewClip
                    : t.paused}
            </span>
            <span>
              {mode === "now" ? (radio ? `${t.liveLabel} · Radio Browser` : t.mock) : t.appleSource}
            </span>
          </div>
        </div>
        <Volume2 className="volume-icon" aria-hidden="true" />
        {/* Hidden transport element: the actual audio engine behind the player. */}
        <audio
          ref={audioRef}
          onPlaying={() => setPlayState("playing")}
          onPause={() => setPlayState((state) => (state === "playing" ? "idle" : state))}
          onWaiting={() => setPlayState("loading")}
          onError={() => setPlayState("error")}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              setProgress((audio.currentTime / audio.duration) * 100);
            }
          }}
          onEnded={() => {
            setProgress(0);
            // Soul mode rotates through the city's three Apple previews.
            if (mode === "soul" && cityTracks.length > 0) {
              const next = (trackIndex + 1) % cityTracks.length;
              setTrackIndex(next);
              const element = audioRef.current;
              if (!element) return;
              element.src = cityTracks[next].previewUrl;
              setPlayState("loading");
              element.play().catch(() => setPlayState("error"));
            } else {
              setPlayState("idle");
            }
          }}
        />
        <button
          type="button"
          className="icon-button music-info-toggle"
          onClick={() => setMusicInfoOpen((value) => !value)}
          disabled={!selectedCity}
          aria-label={t.musicNotes}
        >
          <Info aria-hidden="true" />
        </button>
      </section>

      {nowPlayingOpen && selectedCity && (
        <section className="now-playing" role="dialog" aria-modal="true" aria-label={t.nowPlaying}>
          <div
            className="np-backdrop"
            aria-hidden="true"
            style={
              mode === "soul" && cityTracks[trackIndex]?.artworkUrl
                ? { backgroundImage: `url(${cityTracks[trackIndex].artworkUrl})` }
                : { background: `radial-gradient(120% 90% at 50% 12%, ${selectedCity.accent}30 0%, #04080c 68%)` }
            }
          />
          <button type="button" className="icon-button np-close" onClick={() => setNowPlayingOpen(false)} aria-label="Close">
            <X aria-hidden="true" />
          </button>
          <div className="np-stage">
            <div className="np-art">
              {mode === "soul" && cityTracks[trackIndex]?.artworkUrl ? (
                <img src={cityTracks[trackIndex].artworkUrl} alt="" />
              ) : (
                <div className="np-art-live" style={{ "--city-accent": selectedCity.accent } as CSSProperties}>
                  <span>{selectedCity.localName.slice(0, 2)}</span>
                </div>
              )}
            </div>
            <div className="np-meta">
              <p className="eyebrow">
                {mode === "now" && playState === "playing" && <span className="np-live-dot" aria-hidden="true" />}
                {mode === "now" ? t.liveLabel : t.appleSource}
                {mode === "now" && radio ? ` · ${locale === "zh" ? selectedCity.nameZh : selectedCity.name}` : ""}
              </p>
              <h2>{track.title}</h2>
              <p>{track.artist}</p>
            </div>
            {mode === "soul" && (
              <div className="np-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
            )}
            <button
              type="button"
              className="np-play"
              onClick={togglePlay}
              disabled={playState !== "playing" && !currentAudioSrc}
              aria-label={playState === "playing" ? t.stopAudio : t.playAudio}
            >
              {playState === "loading" ? (
                <Loader2 className="spin-icon" aria-hidden="true" />
              ) : playState === "playing" ? (
                <Pause fill="currentColor" aria-hidden="true" />
              ) : (
                <Play fill="currentColor" aria-hidden="true" />
              )}
            </button>
          </div>
        </section>
      )}

      {musicInfoOpen && (
        <section className="music-info" role="dialog" aria-label={t.musicNotes}>
          <div className="music-info-head">
            <p className="eyebrow">{t.musicNotes}</p>
            <button type="button" className="icon-button" onClick={() => setMusicInfoOpen(false)} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
          {cityTracks.length === 0 ? (
            <p className="music-info-empty">{t.noTrackInfo}</p>
          ) : (
            cityTracks.map((track, index) => (
              <div className="music-track" key={`${track.title}-${index}`}>
                {track.artworkUrl && <img src={track.artworkUrl} alt="" width={44} height={44} loading="lazy" />}
                <div className="music-track-meta">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                  <small>{[track.album, track.genre, track.year].filter(Boolean).join(" · ")}</small>
                </div>
                {track.appleMusicUrl && (
                  <a href={track.appleMusicUrl} target="_blank" rel="noreferrer" aria-label="Apple Music">
                    <ChevronRight aria-hidden="true" />
                  </a>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {!entered && (
        <section className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <div className="intro-orbit" aria-hidden="true"><span /></div>
          <p className="eyebrow">WORLD / SOUND · 01</p>
          <h1 id="intro-title">{t.title}</h1>
          <p>{t.subtitle}</p>
          <button type="button" onClick={() => setEntered(true)}>
            <span>{t.enter}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          <small>{t.note}</small>
        </section>
      )}

      {searchOpen && (
        <section className={`city-drawer ${searchClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="city-search-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeSearch();
            if (event.key !== "Tab") return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>("button, input");
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}>
          <div className="drawer-head">
            <div>
              <p className="eyebrow">WORLD INDEX · {cities.length}</p>
              <h2 id="city-search-title">{t.searchTitle}</h2>
            </div>
            <button type="button" className="icon-button" onClick={closeSearch} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>
          <p className="result-count">{filteredCities.length} {t.results}</p>
          <div className="city-list">
            {filteredCities.map((city) => (
              <button key={city.id} type="button" onClick={() => selectCity(city.id)}>
                <span className="city-dot" style={{ background: city.accent }} />
                <span className="city-list-name">
                  <strong>{cityDisplayName(city, locale)}</strong>
                  <small>{city.name} · {locale === "zh" ? city.countryZh : city.country}</small>
                </span>
                <span className={`prominence prominence-${city.prominence}`}>
                  {getCityScene(city.id) ? (locale === "zh" ? "3D 地标" : "3D LANDMARK") : getCitySignature(city.id)
                    ? (locale === "zh" ? "3D 地标速写" : "3D LANDMARK SKETCH")
                    : locale === "zh" ? "3D 城市速写" : "3D CITY SKETCH"}
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
            {filteredCities.length === 0 && <p className="empty-results">{locale === "zh" ? "没有找到这座城市，试试国家、地区或音乐风格。" : "No city found. Try a country, region or music style."}</p>}
          </div>
        </section>
      )}
    </main>
  );
}

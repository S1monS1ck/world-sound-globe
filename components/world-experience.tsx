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
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { cities, getCity, type City } from "@/lib/cities";
import { getCityScene } from "@/lib/city-scenes";
import { getCitySignature } from "@/lib/city-signatures";
import { SceneErrorBoundary } from "@/components/scene-error-boundary";

const WorldStage = lazy(() =>
  import("@/components/world-stage").then((module) => ({ default: module.WorldStage })),
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
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(23);
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

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 100 ? 0 : value + 0.18));
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing]);

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

  const selectCity = useCallback((id: string) => {
    setSelectedId(id);
    setHoveredCity(null);
    setSearchOpen(false);
    setQuery("");
    setProgress(0);
  }, []);

  const returnToEarth = useCallback(() => {
    setSelectedId(null);
    setHoveredCity(null);
    setPlaying(false);
    setProgress(0);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is an enhancement; the experience remains usable if denied.
    }
  };

  const track = selectedCity
    ? mode === "now"
      ? {
          title: locale === "zh" ? `${selectedCity.nameZh}，此刻` : `${selectedCity.name}, now`,
          artist: locale === "zh" ? "城市流行概念队列" : "City pulse concept queue",
        }
      : {
          title: locale === "zh" ? `${selectedCity.nameZh}的地方之声` : `Local voices of ${selectedCity.name}`,
          artist: locale === "zh" ? selectedCity.soundZh : selectedCity.sound,
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
            <Suspense fallback={<div className="scene-loading" aria-hidden="true" />}>
              <WorldStage
                cities={cities}
                selectedCity={selectedCity}
                onSelect={selectCity}
                onHover={setHoveredCity}
                reducedMotion={reducedMotion}
                active={entered}
              />
            </Suspense>
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
          <button type="button" className="icon-button" onClick={() => setSearchOpen(true)} aria-label={t.explore}>
            <Search aria-hidden="true" />
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
            <p className="scene-detail">
              {selectedScene ? (locale === "zh" ? selectedScene.landmarkNameZh : selectedScene.landmarkName) : selectedSignature ? (locale === "zh" ? `${selectedSignature.nameZh} · 造型速写` : `${selectedSignature.name} · visual sketch`) : (locale === "zh" ? "城市建筑速写 · 风格化场景" : "Architectural sketch · stylized scene")}
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
        <div className={`record-art ${playing ? "spinning" : ""}`} style={{ "--city-accent": selectedCity?.accent ?? "#8caab3" } as CSSProperties}>
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
          onClick={() => selectedCity && setPlaying((value) => !value)}
          disabled={!selectedCity}
          aria-label={playing ? (locale === "zh" ? "停止播放动效预览" : "Stop playback preview") : (locale === "zh" ? "预览播放动效" : "Preview playback motion")}
        >
          {playing ? <Pause fill="currentColor" aria-hidden="true" /> : <Play fill="currentColor" aria-hidden="true" />}
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
            <span>{playing ? t.playing : t.paused}</span>
            <span>{t.mock}</span>
          </div>
        </div>
        <Volume2 className="volume-icon" aria-hidden="true" />
      </section>

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
        <section className="city-drawer" role="dialog" aria-modal="true" aria-labelledby="city-search-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearchOpen(false);
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
            <button type="button" className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close">
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

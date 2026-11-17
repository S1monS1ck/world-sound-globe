"use client";

import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import type { City } from "@/lib/cities";
import { getCityScene } from "@/lib/city-scenes";
import { bindCityPicking, pickCity } from "@/lib/city-picking";
import { getCitySignature, getCityVisualAnchor } from "@/lib/city-signatures";
import { CityDistrict } from "@/components/city-district";
import { EARTH_RADIUS, METERS_TO_WORLD, cityVector, tangentBasis } from "@/lib/globe";

const ASSET_BASE = import.meta.env.BASE_URL ?? "/";

function currentSunDirection(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  const hours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const declination =
    23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  const subsolarLongitude = (12 - hours) * 15;
  return cityVector(declination, subsolarLongitude, 1).normalize();
}

function EarthSurface({ cityFocused }: { cityFocused: boolean }) {
  const lastSunUpdate = useRef(-1);
  const [mapMask, nightTexture] = useLoader(THREE.TextureLoader, [
    `${ASSET_BASE}textures/earth-vector-mask.png`,
    `${ASSET_BASE}textures/earth-night.png`,
  ]);

  useEffect(() => {
    for (const texture of [mapMask, nightTexture]) {
      texture.anisotropy = 4;
      texture.wrapS = THREE.RepeatWrapping;
      texture.needsUpdate = true;
    }
    mapMask.colorSpace = THREE.NoColorSpace;
    nightTexture.colorSpace = THREE.SRGBColorSpace;
  }, [mapMask, nightTexture]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          mapMask: { value: mapMask },
          nightTexture: { value: nightTexture },
          sunDirection: { value: currentSunDirection() },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldNormal;

          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D mapMask;
          uniform sampler2D nightTexture;
          uniform vec3 sunDirection;
          varying vec2 vUv;
          varying vec3 vWorldNormal;

          void main() {
            vec3 mask = texture2D(mapMask, vUv).rgb;
            vec3 night = texture2D(nightTexture, vUv).rgb;
            float sunlight = dot(normalize(vWorldNormal), normalize(sunDirection));
            float daylight = smoothstep(-0.19, 0.24, sunlight);
            float land = smoothstep(0.22, 0.76, mask.r);
            float coast = smoothstep(0.26, 0.8, mask.g);
            vec3 ocean = mix(vec3(0.012, 0.035, 0.075), vec3(0.035, 0.095, 0.15), daylight);
            vec3 terrain = mix(vec3(0.04, 0.09, 0.15), vec3(0.18, 0.27, 0.34), daylight);
            float relief = sin(vUv.x * 210.0) * sin(vUv.y * 105.0);
            terrain += relief * 0.014 * land;
            vec3 color = mix(ocean, terrain, land);
            color += coast * vec3(0.08, 0.11, 0.105) * (0.48 + daylight * 0.52);
            float lights = max(max(night.r, night.g), night.b);
            lights = smoothstep(0.10, 0.64, lights) * (1.0 - daylight) * land;
            color += vec3(0.67, 0.55, 0.38) * lights * 0.76;
            float edge = pow(1.0 - max(dot(normalize(vWorldNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
            color += vec3(0.025, 0.065, 0.075) * edge;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [mapMask, nightTexture],
  );

  useFrame(({ clock }) => {
    const bucket = Math.floor(clock.elapsedTime / 30);
    if (bucket !== lastSunUpdate.current) {
      material.uniforms.sunDirection.value.copy(currentSunDirection());
      lastSunUpdate.current = bucket;
    }
  });

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    // The metre-scale city plane must sit visually above the much coarser globe mesh.
    material.depthWrite = !cityFocused;
  }, [material, cityFocused]);

  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[EARTH_RADIUS - (cityFocused ? 60 * METERS_TO_WORLD : 0), 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
            gl_FragColor = vec4(0.25, 0.62, 0.82, intensity * 0.42);
          }
        `,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={1.065}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function CityFillLight({ city }: { city: City }) {
  const scene = getCityScene(city.id);
  const visualAnchor = getCityVisualAnchor(city);
  const lat = scene?.displayLat ?? scene?.lat ?? visualAnchor.lat;
  const lon = scene?.displayLon ?? scene?.lon ?? visualAnchor.lon;
  const { up, east, north } = tangentBasis(lat, lon);
  const center = cityVector(lat, lon);
  const key = center.clone().addScaledVector(up, 0.28).addScaledVector(north, -0.20).addScaledVector(east, 0.16);
  const rim = center.clone().addScaledVector(up, 0.15).addScaledVector(north, 0.18).addScaledVector(east, -0.20);
  return (
    <>
      <pointLight position={key} color="#f5e9d6" intensity={2.1} distance={1.1} decay={1.3} />
      <pointLight position={rim} color="#a8c8d2" intensity={0.8} distance={0.9} decay={1.4} />
    </>
  );
}


function CityNode({
  city,
  position,
  hovered,
}: {
  city: City;
  position: THREE.Vector3;
  hovered: boolean;
}) {
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        position.clone().normalize(),
      ),
    [position],
  );

  const markerSize = city.prominence === "global" ? 0.022 : city.prominence === "regional" ? 0.016 : 0.011;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, 0.004, 0]}>
        <sphereGeometry args={[markerSize * 0.24, 12, 8]} />
        <meshBasicMaterial color={city.accent} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[markerSize * 0.68, markerSize, 32]} />
        <meshBasicMaterial
          color={city.accent}
          transparent
          opacity={hovered ? 0.95 : city.prominence === "global" ? 0.72 : 0.48}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CityMarkers({ cities, onSelect, onHover }: {
  cities: City[];
  onSelect: (id: string) => void;
  onHover: (city: City | null) => void;
}) {
  const { camera, gl } = useThree();
  const markers = useMemo(() => cities.map(city => ({
    city, position: cityVector(city.lat, city.lon, EARTH_RADIUS + 0.006),
  })), [cities]);
  const [hovered, setHovered] = useState<City | null>(null);
  const current = useRef<City | null>(null);
  useEffect(() => {
    const canvas = gl.domElement;
    function hover(city: City | null) {
      if (city === current.current) return;
      current.current = city;
      canvas.style.cursor = city ? "pointer" : "";
      setHovered(city);
      onHover(city);
    }
    const unbind = bindCityPicking(canvas, e => pickCity(markers, camera, canvas.getBoundingClientRect(),
      e.clientX, e.clientY, e.pointerType === "touch"), hover, onSelect);
    return () => {
      unbind();
      canvas.style.cursor = "";
      current.current = null;
      onHover(null);
    };
  }, [gl, camera, markers, onHover, onSelect]);
  const active = markers.find(marker => marker.city === hovered);
  return <>
    {markers.map(({ city, position }) => <CityNode key={city.id} city={city} position={position} hovered={hovered === city} />)}
    {active && <Html position={active.position} zIndexRange={[30, 10]} style={{ pointerEvents: "none" }}>
      <button type="button" className="city-label" onClick={() => onSelect(active.city.id)}
        onPointerLeave={e => {
          if (e.relatedTarget === gl.domElement) return;
          current.current = null;
          gl.domElement.style.cursor = "";
          setHovered(null);
          onHover(null);
        }}>
        <span>{active.city.localName}</span><small>{active.city.name}</small>
      </button>
    </Html>}
  </>;
}

function CameraRig({
  selectedCity,
  controlsRef,
  reducedMotion,
}: {
  selectedCity: City | null;
  controlsRef: RefObject<ComponentRef<typeof OrbitControls> | null>;
  reducedMotion: boolean;
}) {
  const { camera, size, invalidate } = useThree();
  const startPosition = useRef(camera.position.clone());
  const endPosition = useRef(camera.position.clone());
  const startLookAt = useRef(new THREE.Vector3());
  const endLookAt = useRef(new THREE.Vector3());
  const startUp = useRef(new THREE.Vector3(0, 1, 0));
  const endUp = useRef(new THREE.Vector3(0, 1, 0));
  const progress = useRef(1);
  const firstRun = useRef(true);
  const scene = selectedCity ? getCityScene(selectedCity.id) : undefined;
  const signature = selectedCity ? getCitySignature(selectedCity.id) : undefined;
  const visualAnchor = useMemo(() => selectedCity ? getCityVisualAnchor(selectedCity) : undefined, [selectedCity]);
  const minimumDistance = scene?.id === "beijing" ? 0.13 : scene?.id === "mumbai" || (selectedCity && !scene) ? 0.085 : selectedCity ? 0.22 : 2.1;
  const maximumDistance = 7.5;
  const motion = useMemo(() => ({
    arc: new THREE.Quaternion(),
    upArc: new THREE.Quaternion(),
    rotation: new THREE.Quaternion(),
    identity: new THREE.Quaternion(),
    direction: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    lift: 0,
    duration: 1.7,
  }), []);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controls?.target ?? new THREE.Vector3());
    startUp.current.copy(camera.up);
    if (controls) {
      // Flush leftover orbit damping before taking over the camera.
      controls.enabled = false;
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(startPosition.current);
      camera.up.copy(startUp.current);
      controls.target.copy(startLookAt.current);
      camera.lookAt(startLookAt.current);
    }
    if (selectedCity) {
      const latitude = scene?.displayLat ?? scene?.lat ?? visualAnchor?.lat ?? selectedCity.lat;
      const longitude = scene?.displayLon ?? scene?.lon ?? visualAnchor?.lon ?? selectedCity.lon;
      const { up, east, north } = tangentBasis(latitude, longitude);
      const surface = cityVector(latitude, longitude);
      const narrow = size.width < 680;
      if (scene) {
        // Approach Shanghai and Beijing from the south while keeping the globe's horizon visible.
        const bearing = (scene.id === "shanghai" || scene.id === "beijing" ? 180 : scene.heading) * Math.PI / 180;
        const focusDistance = scene.id === "shanghai" ? (narrow ? 0.42 : 0.34) : scene.id === "beijing" ? (narrow ? 0.33 : 0.24) : scene.id === "mumbai" ? (narrow ? 0.27 : 0.22) : (narrow ? 0.75 : 0.65);
        const elevation = scene.id === "beijing" ? 0.47 : 0.76;
        const approach = scene.id === "beijing" ? 1.18 : 1.08;
        endPosition.current.copy(surface).addScaledVector(up, focusDistance * elevation)
          .addScaledVector(north, Math.cos(bearing) * focusDistance * approach)
          .addScaledVector(east, Math.sin(bearing) * focusDistance * approach);
        endLookAt.current.copy(surface);
      } else {
        const focusDistance = narrow ? 0.22 : signature ? 0.15 : 0.17;
        endPosition.current.copy(surface).addScaledVector(up, focusDistance * 0.37)
          .addScaledVector(north, -focusDistance * 1.18);
        endLookAt.current.copy(surface);
      }
      endUp.current.copy(up);
    } else {
      endPosition.current.copy(cityVector(20, 68, size.width < 680 ? 5.9 : 5.15));
      endLookAt.current.set(0, 0, 0);
      endUp.current.set(0, 1, 0);
    }
    const startDirection = startPosition.current.clone().normalize();
    const endDirection = endPosition.current.clone().normalize();
    const angle = startDirection.angleTo(endDirection);
    motion.arc.setFromUnitVectors(startDirection, endDirection);
    motion.upArc.setFromUnitVectors(startUp.current, endUp.current);
    motion.lift = angle * 0.35;
    motion.duration = selectedCity ? 3.2 + angle * 0.35 : 1.7 + angle * 0.35;
    if (firstRun.current || reducedMotion) {
      camera.position.copy(endPosition.current);
      camera.up.copy(endUp.current);
      camera.lookAt(endLookAt.current);
      if (controls) {
        controls.target.copy(endLookAt.current);
        controls.minDistance = minimumDistance;
        controls.maxDistance = maximumDistance;
        controls.minPolarAngle = scene?.id === "beijing" || (selectedCity && !scene) ? Math.PI * 0.35 : selectedCity ? Math.PI * 0.30 : 0;
        controls.maxPolarAngle = scene?.id === "beijing" || (selectedCity && !scene) ? Math.PI * 0.42 : selectedCity ? Math.PI * 0.34 : Math.PI;
        controls.update();
        controls.enableDamping = !reducedMotion;
        controls.enabled = true;
      }
      progress.current = 1;
      firstRun.current = false;
    } else {
      progress.current = 0;
    }
    invalidate();
  }, [camera, controlsRef, selectedCity, size.width, reducedMotion, invalidate, motion, scene, signature, visualAnchor, minimumDistance, maximumDistance]);

  useFrame((_, delta) => {
    const target = controlsRef.current?.target ?? motion.lookAt;
    const near = THREE.MathUtils.clamp(camera.position.distanceTo(target) * 0.005, METERS_TO_WORLD, 0.04);
    if (Math.abs(camera.near - near) > near * 0.01) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta / motion.duration);
    const t = progress.current;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // Follow the outside of the globe, including near-antipodal city flights.
    motion.rotation.slerpQuaternions(motion.identity, motion.arc, eased);
    motion.direction.copy(startPosition.current).normalize().applyQuaternion(motion.rotation);
    const startAltitude = Math.max(METERS_TO_WORLD * 15, startPosition.current.length() - EARTH_RADIUS);
    const endAltitude = Math.max(METERS_TO_WORLD * 15, endPosition.current.length() - EARTH_RADIUS);
    const altitude = Math.exp(THREE.MathUtils.lerp(Math.log(startAltitude), Math.log(endAltitude), eased));
    const radius = EARTH_RADIUS + altitude + Math.pow(Math.sin(Math.PI * eased), 4) * motion.lift;
    camera.position.copy(motion.direction).multiplyScalar(radius);
    motion.rotation.slerpQuaternions(motion.identity, motion.upArc, eased);
    camera.up.copy(startUp.current).applyQuaternion(motion.rotation);
    motion.lookAt.lerpVectors(startLookAt.current, endLookAt.current, eased);
    camera.lookAt(motion.lookAt);
    if (controlsRef.current) {
      const controls = controlsRef.current;
      controls.target.copy(motion.lookAt);
      if (progress.current >= 1) {
        controls.minDistance = minimumDistance;
        controls.maxDistance = maximumDistance;
        controls.minPolarAngle = scene?.id === "beijing" || (selectedCity && !scene) ? Math.PI * 0.35 : selectedCity ? Math.PI * 0.30 : 0;
        controls.maxPolarAngle = scene?.id === "beijing" || (selectedCity && !scene) ? Math.PI * 0.42 : selectedCity ? Math.PI * 0.34 : Math.PI;
        controls.update();
        controls.enableDamping = !reducedMotion;
        controls.enabled = true;
      }
    }
    invalidate();
  });

  return null;
}

function StageContent({
  cities,
  selectedCity,
  onSelect,
  onHover,
  reducedMotion,
}: {
  cities: City[];
  selectedCity: City | null;
  onSelect: (id: string) => void;
  onHover: (city: City | null) => void;
  reducedMotion: boolean;
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  return (
    <>
      <color attach="background" args={["#03070b"]} />
      <fog attach="fog" args={["#03070b", 6, 11]} />
      <ambientLight intensity={0.78} color="#d5e1df" />
      <directionalLight position={[4, 2, 3]} intensity={1.15} color="#f7e8d0" />
      <pointLight position={[-4, -1, -3]} intensity={0.42} color="#4d7c92" />
      {!selectedCity && <Stars radius={42} depth={24} count={780} factor={1.4} saturation={0.12} fade speed={0.06} />}
      <EarthSurface cityFocused={Boolean(selectedCity)} />
      {!selectedCity && <Atmosphere />}
      {selectedCity && !getCityScene(selectedCity.id) && <CityFillLight city={selectedCity} />}
      {selectedCity && <CityDistrict city={selectedCity} />}
      {!selectedCity && <CityMarkers cities={cities} onSelect={onSelect} onHover={onHover} />}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        // Ported from the original prototype: right-drag rotates, two fingers
        // dolly and rotate together; pan stays disabled everywhere.
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        minDistance={0.24}
        maxDistance={7.5}
        rotateSpeed={0.48}
        zoomSpeed={0.65}
      />
      <CameraRig selectedCity={selectedCity} controlsRef={controlsRef} reducedMotion={reducedMotion} />
    </>
  );
}

export function WorldStage({
  cities,
  selectedCity,
  onSelect,
  onHover,
  reducedMotion,
  active,
}: {
  cities: City[];
  selectedCity: City | null;
  onSelect: (id: string) => void;
  onHover: (city: City | null) => void;
  reducedMotion: boolean;
  active: boolean;
}) {
  return (
    <Canvas
      dpr={reducedMotion ? 1 : [1, 1.6]}
      resize={{ offsetSize: true }}
      camera={{ position: [1.15, 1.25, -3.32], fov: 38, near: 0.04, far: 100 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "demand"}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <Suspense fallback={null}>
        <StageContent
          cities={cities}
          selectedCity={selectedCity}
          onSelect={onSelect}
          onHover={onHover}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </Canvas>
  );
}

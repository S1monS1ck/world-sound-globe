"use client";

import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { City } from "@/lib/cities";

const EARTH_RADIUS = 1.28;

function cityVector(lat: number, lon: number, radius = EARTH_RADIUS) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

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

function EarthSurface() {
  const [dayTexture, nightTexture] = useLoader(THREE.TextureLoader, [
    "/textures/earth-day.jpg",
    "/textures/earth-night.png",
  ]);

  useEffect(() => {
    for (const texture of [dayTexture, nightTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
  }, [dayTexture, nightTexture]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTexture },
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
          uniform sampler2D dayTexture;
          uniform sampler2D nightTexture;
          uniform vec3 sunDirection;
          varying vec2 vUv;
          varying vec3 vWorldNormal;

          void main() {
            vec3 day = texture2D(dayTexture, vUv).rgb;
            vec3 night = texture2D(nightTexture, vUv).rgb;
            float sunlight = dot(normalize(vWorldNormal), normalize(sunDirection));
            float twilight = smoothstep(-0.16, 0.18, sunlight);
            vec3 nightGrade = night * vec3(0.82, 0.92, 1.04) * 1.22;
            vec3 dayGrade = pow(day, vec3(0.92)) * vec3(0.82, 0.90, 0.94);
            vec3 color = mix(nightGrade, dayGrade, twilight);
            float edge = pow(1.0 - max(dot(normalize(vWorldNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
            color += vec3(0.02, 0.055, 0.08) * edge;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [dayTexture, nightTexture],
  );

  useFrame(({ clock }) => {
    if (Math.floor(clock.elapsedTime) % 30 === 0) {
      material.uniforms.sunDirection.value.copy(currentSunDirection());
    }
  });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function BuildingCluster({ city, active }: { city: City; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const seed = hashString(city.id);
  const buildings = useMemo(
    () =>
      Array.from({ length: city.prominence === "global" ? 9 : 6 }, (_, index) => {
        const angle = ((seed % 37) + index * 137.5) * (Math.PI / 180);
        const distance = 0.012 + ((seed + index * 11) % 18) / 900;
        const height = 0.018 + ((seed + index * 19) % 38) / 700;
        const width = 0.008 + ((seed + index * 7) % 9) / 1000;
        return {
          x: Math.cos(angle) * distance,
          z: Math.sin(angle) * distance,
          height,
          width,
        };
      }),
    [city.id, city.prominence, seed],
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    const target = active ? 1 : city.prominence === "global" ? 0.26 : 0.08;
    const next = THREE.MathUtils.damp(group.current.scale.y, target, 5.5, delta);
    group.current.scale.set(1, next, 1);
  });

  return (
    <group ref={group}>
      {buildings.map((building, index) => (
        <mesh
          key={`${city.id}-building-${index}`}
          position={[building.x, building.height / 2 + 0.003, building.z]}
        >
          <boxGeometry args={[building.width, building.height, building.width]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? city.accent : "#8f9ca2"}
            emissive={city.accent}
            emissiveIntensity={active ? 0.18 : 0.04}
            metalness={0.35}
            roughness={0.52}
          />
        </mesh>
      ))}

      {city.landmark === "spire" && (
        <mesh position={[0, 0.048, 0]}>
          <coneGeometry args={[0.012, 0.096, 4]} />
          <meshStandardMaterial color={city.accent} metalness={0.62} roughness={0.32} />
        </mesh>
      )}
      {city.landmark === "tower" && (
        <group>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.009, 0.015, 0.07, 8]} />
            <meshStandardMaterial color={city.accent} metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.082, 0]}>
            <coneGeometry args={[0.005, 0.035, 6]} />
            <meshStandardMaterial color="#dbe8e7" metalness={0.65} roughness={0.28} />
          </mesh>
        </group>
      )}
      {city.landmark === "dome" && (
        <group>
          <mesh position={[0, 0.024, 0]}>
            <cylinderGeometry args={[0.02, 0.023, 0.035, 12]} />
            <meshStandardMaterial color="#77868a" roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.044, 0]} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.022, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={city.accent} metalness={0.32} roughness={0.45} />
          </mesh>
        </group>
      )}
      {city.landmark === "bridge" && (
        <group position={[0, 0.014, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.027, 0.003, 6, 24, Math.PI]} />
            <meshStandardMaterial color={city.accent} metalness={0.44} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.012, 0]}>
            <boxGeometry args={[0.066, 0.004, 0.008]} />
            <meshStandardMaterial color="#859194" />
          </mesh>
        </group>
      )}
      {city.landmark === "mountain" && (
        <group>
          <mesh position={[-0.016, 0.022, 0]}>
            <coneGeometry args={[0.025, 0.052, 7]} />
            <meshStandardMaterial color="#7d8f82" roughness={0.88} />
          </mesh>
          <mesh position={[0.014, 0.017, 0.008]}>
            <coneGeometry args={[0.021, 0.04, 7]} />
            <meshStandardMaterial color={city.accent} roughness={0.82} />
          </mesh>
        </group>
      )}
      {city.landmark === "harbor" && (
        <group position={[0, 0.016, 0]}>
          <mesh position={[-0.014, 0.012, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.008, 0.048, 0.018]} />
            <meshStandardMaterial color={city.accent} metalness={0.32} roughness={0.42} />
          </mesh>
          <mesh position={[0.014, 0.012, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.008, 0.048, 0.018]} />
            <meshStandardMaterial color="#b9c7c7" metalness={0.28} roughness={0.5} />
          </mesh>
        </group>
      )}
      {city.landmark === "arch" && (
        <group position={[0, 0.02, 0]}>
          <mesh position={[-0.018, 0.012, 0]}>
            <boxGeometry args={[0.009, 0.05, 0.014]} />
            <meshStandardMaterial color={city.accent} roughness={0.58} />
          </mesh>
          <mesh position={[0.018, 0.012, 0]}>
            <boxGeometry args={[0.009, 0.05, 0.014]} />
            <meshStandardMaterial color={city.accent} roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[0.045, 0.009, 0.014]} />
            <meshStandardMaterial color="#b9b2a5" roughness={0.62} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function CityNode({
  city,
  selected,
  onSelect,
  onHover,
}: {
  city: City;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (city: City | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => cityVector(city.lat, city.lon, EARTH_RADIUS + 0.006), [city]);
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        position.clone().normalize(),
      ),
    [position],
  );

  useEffect(() => {
    if (hovered) document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hovered]);

  const markerSize = city.prominence === "global" ? 0.022 : city.prominence === "regional" ? 0.016 : 0.011;

  return (
    <group
      position={position}
      quaternion={quaternion}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(city.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHover(city);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[markerSize * 0.28, markerSize * 0.46, 0.015, 12]} />
        <meshBasicMaterial color={city.accent} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[markerSize * 0.68, markerSize, 32]} />
        <meshBasicMaterial
          color={city.accent}
          transparent
          opacity={selected || hovered ? 0.95 : city.prominence === "global" ? 0.58 : 0.32}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <BuildingCluster city={city} active={selected} />
      {(selected || hovered) && (
        <Html center position={[0, 0.13, 0]} zIndexRange={[30, 10]}>
          <div className={`city-label ${selected ? "is-selected" : ""}`}>
            <span>{city.localName}</span>
            <small>{city.name}</small>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraRig({ selectedCity }: { selectedCity: City | null }) {
  const { camera } = useThree();
  const start = useRef(camera.position.clone());
  const target = useRef(camera.position.clone());
  const progress = useRef(1);

  useEffect(() => {
    start.current.copy(camera.position);
    target.current.copy(
      selectedCity
        ? cityVector(selectedCity.lat, selectedCity.lon, 2.72)
        : new THREE.Vector3(0.2, 0.68, 3.72),
    );
    progress.current = 0;
  }, [camera, selectedCity]);

  useFrame((_, delta) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta * 0.42);
    const t = progress.current;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(start.current, target.current, eased);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function StageContent({
  cities,
  selectedCity,
  onSelect,
  onHover,
}: {
  cities: City[];
  selectedCity: City | null;
  onSelect: (id: string) => void;
  onHover: (city: City | null) => void;
}) {
  return (
    <>
      <color attach="background" args={["#03070b"]} />
      <fog attach="fog" args={["#03070b", 6, 11]} />
      <ambientLight intensity={0.22} color="#bdd7de" />
      <directionalLight position={[4, 2, 3]} intensity={1.15} color="#f7e8d0" />
      <pointLight position={[-4, -1, -3]} intensity={0.42} color="#4d7c92" />
      <Stars radius={42} depth={24} count={1200} factor={1.7} saturation={0.18} fade speed={0.18} />
      <EarthSurface />
      <Atmosphere />
      {cities.map((city) => (
        <CityNode
          key={city.id}
          city={city}
          selected={selectedCity?.id === city.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
      <CameraRig selectedCity={selectedCity} />
      <OrbitControls
        enableDamping
        dampingFactor={0.065}
        enablePan={false}
        minDistance={2.18}
        maxDistance={5.3}
        rotateSpeed={0.48}
        zoomSpeed={0.62}
      />
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
      camera={{ position: [0.2, 0.68, 3.72], fov: 38, near: 0.1, far: 100 }}
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
        />
      </Suspense>
    </Canvas>
  );
}

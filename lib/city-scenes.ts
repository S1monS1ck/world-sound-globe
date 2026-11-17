export type LandmarkKind = "eiffel" | "oriental-pearl" | "elizabeth-tower" | "gateway-india" | "tokyo-tower" | "temple-of-heaven" | "canton-tower" | "taipei-101" | "bank-of-china-tower" | "west-pearl-tower" | "wild-goose-pagoda";

export type CityScene = {
  id: string;
  lat: number;
  lon: number;
  /** Optional visual anchor for the miniature; the landmark's WGS84 coordinates stay unchanged. */
  displayLat?: number;
  displayLon?: number;
  extent: number;
  landmark: LandmarkKind;
  landmarkName: string;
  landmarkNameZh: string;
  /** Clockwise rotation about local up, in degrees from the model's north-facing front. */
  heading: number;
};

// Geography remains centred on each landmark's WGS84 position. A visual anchor can move
// a coastal miniature inland without altering its local street/building coordinates.
export const cityScenes: CityScene[] = [
  { id: "beijing", lat: 39.88225, lon: 116.40662, extent: 700, landmark: "temple-of-heaven", landmarkName: "Hall of Prayer for Good Harvests", landmarkNameZh: "天坛祈年殿", heading: 0 },
  { id: "paris", lat: 48.85837, lon: 2.29448, extent: 1100, landmark: "eiffel", landmarkName: "Eiffel Tower", landmarkNameZh: "埃菲尔铁塔", heading: 44 },
  { id: "shanghai", lat: 31.23970, lon: 121.49980, displayLat: 31.23970, displayLon: 119.90, extent: 1100, landmark: "oriental-pearl", landmarkName: "Oriental Pearl Tower", landmarkNameZh: "东方明珠广播电视塔", heading: 0 },
  { id: "london", lat: 51.50070, lon: -0.12460, extent: 1100, landmark: "elizabeth-tower", landmarkName: "Elizabeth Tower", landmarkNameZh: "伊丽莎白塔（大本钟）", heading: 10 },
  // The enlarged miniature's full footprint needs land clearance, not just its centre.
  { id: "mumbai", lat: 18.92190, lon: 72.83460, displayLat: 19.25, displayLon: 73.65, extent: 1100, landmark: "gateway-india", landmarkName: "Gateway of India", landmarkNameZh: "印度门（孟买）", heading: 112 },
  { id: "tokyo", lat: 35.65858, lon: 139.74543, extent: 1100, landmark: "tokyo-tower", landmarkName: "Tokyo Tower", landmarkNameZh: "东京塔", heading: 0 },
  { id: "guangzhou", lat: 23.10905, lon: 113.31799, extent: 700, landmark: "canton-tower", landmarkName: "Canton Tower", landmarkNameZh: "广州塔", heading: 0 },
  { id: "taipei", lat: 25.03395, lon: 121.56455, extent: 700, landmark: "taipei-101", landmarkName: "Taipei 101", landmarkNameZh: "台北101", heading: 0 },
  { id: "hong-kong", lat: 22.27927, lon: 114.16157, extent: 700, landmark: "bank-of-china-tower", landmarkName: "Bank of China Tower", landmarkNameZh: "中银大厦", heading: 0 },
  { id: "xian", lat: 34.21980, lon: 108.95943, extent: 700, landmark: "wild-goose-pagoda", landmarkName: "Big Wild Goose Pagoda", landmarkNameZh: "大雁塔", heading: 0 },
  { id: "chengdu", lat: 30.66469, lon: 104.09211, extent: 700, landmark: "west-pearl-tower", landmarkName: "West Pearl Tower (Chengdu 339)", landmarkNameZh: "天府熊猫塔（成都339）", heading: 0 },
];

export function getCityScene(id: string): CityScene | undefined {
  return cityScenes.find((scene) => scene.id === id);
}

export type CitySceneData = {
  center: [number, number];
  extent: number;
  buildings: { id: number; ring: [number, number][]; height: number; minHeight: number; estimated: boolean }[];
  roads: { points: [number, number][]; kind: string }[];
  water: { ring: [number, number][]; holes?: [number, number][][] }[];
  parks: { ring: [number, number][] }[];
  coastline: [number, number][][];
  source: string;
  updated?: string;
};

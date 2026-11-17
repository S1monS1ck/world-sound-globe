// City-scale illustrated anchors. These are not surveyed building footprints;
// the few offset anchors keep unmistakable coastal/desert landmarks in their
// actual part of the city while the vignette remains a small globe-surface scene.
import type { City } from "@/lib/cities";

export type SignatureKind =
  | "taipei101" | "canton" | "nseoul" | "marina" | "hagia" | "giza"
  | "burj" | "sagrada" | "empire" | "brandenburg" | "christ"
  | "opera" | "cntower" | "willis" | "obelisco" | "skytower"
  | "watarun" | "hongkong"
  | "xianbell" | "osakacastle" | "indiagate" | "parthenon" | "angel" | "tablemountain"
  | "anshun" | "griffith" | "masp" | "monas" | "stlouis" | "capitolio"
  | "nationaltheatre" | "rencen" | "batman" | "ponte" | "belem" | "castelnuovo"
  | "manchestertownhall" | "liverbuilding" | "independencearch"
  | "biosphere" | "flinders" | "busantower"
  | "rizal" | "saigoncathedral" | "victoriamemorial" | "beirutmosque"
  | "rijksmuseum" | "cibeles" | "stockholmhall" | "renaissanceafrica"
  | "palaispeuple" | "kicc" | "bobmarley" | "elmorro"
  | "colpatria" | "culturepalace" | "limacathedral" | "grantorre";

export type CitySignature = {
  kind: SignatureKind;
  name: string;
  nameZh: string;
  displayLat?: number;
  displayLon?: number;
  /** Uniform miniature scale and orientation preserve each new landmark's proportions. */
  displayScale?: number;
  heading?: number;
  settingRadius?: number;
};

const signatures: Record<string, CitySignature> = {
  manila: { kind: "rizal", name: "Rizal Monument", nameZh: "黎刹纪念碑", displayLat: 14.9, displayLon: 121.2, displayScale: 0.00008, settingRadius: 145 },
  "ho-chi-minh-city": { kind: "saigoncathedral", name: "Saigon Notre-Dame Cathedral", nameZh: "西贡圣母圣殿主教座堂", displayScale: 0.000075, heading: -15, settingRadius: 165 },
  kolkata: { kind: "victoriamemorial", name: "Victoria Memorial", nameZh: "维多利亚纪念堂", displayScale: 0.00007, heading: -12, settingRadius: 180 },
  beirut: { kind: "beirutmosque", name: "Mohammad Al-Amin Mosque", nameZh: "穆罕默德·阿明清真寺", displayLat: 33.95, displayLon: 35.85, displayScale: 0.000075, settingRadius: 170 },
  amsterdam: { kind: "rijksmuseum", name: "Rijksmuseum", nameZh: "荷兰国立博物馆", displayLat: 52.1, displayLon: 5.15, displayScale: 0.00007, heading: -15, settingRadius: 190 },
  madrid: { kind: "cibeles", name: "Palacio de Cibeles", nameZh: "西贝莱斯宫", displayScale: 0.00007, heading: -12, settingRadius: 190 },
  stockholm: { kind: "stockholmhall", name: "Stockholm City Hall", nameZh: "斯德哥尔摩市政厅", displayLat: 59.50, displayLon: 17.75, displayScale: 0.000075, heading: -15, settingRadius: 175 },
  dakar: { kind: "renaissanceafrica", name: "African Renaissance Monument", nameZh: "非洲复兴纪念碑", displayLat: 14.83, displayLon: -17.20, displayScale: 0.000085, settingRadius: 150 },
  kinshasa: { kind: "palaispeuple", name: "Palais du Peuple", nameZh: "人民宫", displayScale: 0.000075, heading: -15, settingRadius: 185 },
  nairobi: { kind: "kicc", name: "Kenyatta International Convention Centre", nameZh: "肯雅塔国际会议中心", displayScale: 0.00008, heading: -15, settingRadius: 170 },
  kingston: { kind: "bobmarley", name: "Bob Marley Museum", nameZh: "鲍勃·马利博物馆", displayLat: 18.17, displayLon: -76.85, displayScale: 0.000075, heading: -12, settingRadius: 155 },
  "san-juan": { kind: "elmorro", name: "Castillo San Felipe del Morro", nameZh: "圣费利佩海角城堡", displayLat: 18.30, displayLon: -66.18, displayScale: 0.000065, heading: -15, settingRadius: 190 },
  bogota: { kind: "colpatria", name: "Torre Colpatria", nameZh: "科尔帕特里亚塔", displayScale: 0.000085, heading: -12, settingRadius: 125 },
  medellin: { kind: "culturepalace", name: "Palacio de la Cultura Rafael Uribe Uribe", nameZh: "拉斐尔·乌里韦文化宫", displayScale: 0.000075, heading: -12, settingRadius: 175 },
  lima: { kind: "limacathedral", name: "Cathedral of Lima", nameZh: "利马主教座堂", displayLat: -11.85, displayLon: -76.8, displayScale: 0.000075, heading: -12, settingRadius: 180 },
  santiago: { kind: "grantorre", name: "Gran Torre Santiago", nameZh: "圣地亚哥大厦", displayScale: 0.000085, heading: -12, settingRadius: 130 },
  montreal: { kind: "biosphere", name: "Montréal Biosphère", nameZh: "蒙特利尔生物圈", displayScale: 0.000075, settingRadius: 150 },
  melbourne: { kind: "flinders", name: "Flinders Street Station", nameZh: "弗林德斯街车站", displayScale: 0.00007, heading: -15, settingRadius: 185 },
  busan: { kind: "busantower", name: "Busan Tower", nameZh: "釜山塔", displayLat: 35.35, displayLon: 128.95, displayScale: 0.000085, settingRadius: 130 },
  manchester: { kind: "manchestertownhall", name: "Manchester Town Hall", nameZh: "曼彻斯特市政厅", displayScale: 0.00008, heading: -15, settingRadius: 175 },
  liverpool: { kind: "liverbuilding", name: "Royal Liver Building", nameZh: "皇家利物大厦", displayScale: 0.00008, heading: -12, settingRadius: 170 },
  accra: { kind: "independencearch", name: "Independence Arch", nameZh: "独立拱门", displayLat: 6.0, displayLon: -0.18, displayScale: 0.00008, heading: -15, settingRadius: 145 },
  lagos: { kind: "nationaltheatre", name: "National Theatre", nameZh: "国家艺术剧院", displayLat: 7.1244, displayLon: 3.3792, displayScale: 0.00007, heading: -15, settingRadius: 210 },
  detroit: { kind: "rencen", name: "Renaissance Center", nameZh: "文艺复兴中心", displayScale: 0.000085, heading: -20, settingRadius: 184 },
  nashville: { kind: "batman", name: "333 Commerce · Batman Building", nameZh: "333 Commerce · 蝙蝠侠大厦", displayScale: 0.00009, heading: -18, settingRadius: 120 },
  johannesburg: { kind: "ponte", name: "Ponte City", nameZh: "Ponte City 中空圆塔", displayScale: 0.00009, heading: 0, settingRadius: 118 },
  lisbon: { kind: "belem", name: "Belém Tower", nameZh: "贝伦塔", displayLat: 38.92, displayLon: -8.60, displayScale: 0.000075, heading: -20, settingRadius: 150 },
  naples: { kind: "castelnuovo", name: "Castel Nuovo", nameZh: "新堡（安茹城堡）", displayLat: 41.15, displayLon: 14.67, displayScale: 0.00007, heading: -18, settingRadius: 180 },
  chengdu: { kind: "anshun", name: "Anshun Bridge", nameZh: "安顺廊桥" },
  taipei: { kind: "taipei101", name: "Taipei 101", nameZh: "台北 101", displayLat: 24.97, displayLon: 121.48 },
  xian: { kind: "xianbell", name: "Xi'an Bell Tower", nameZh: "西安钟楼" },
  osaka: { kind: "osakacastle", name: "Osaka Castle", nameZh: "大阪城" },
  delhi: { kind: "indiagate", name: "India Gate", nameZh: "印度门（德里）", displayLat: 28.6129, displayLon: 77.2295, displayScale: 0.000085, heading: -12, settingRadius: 150 },
  athens: { kind: "parthenon", name: "Parthenon", nameZh: "帕特农神庙" },
  "mexico-city": { kind: "angel", name: "Angel of Independence", nameZh: "独立天使纪念碑" },
  "cape-town": { kind: "tablemountain", name: "Table Mountain", nameZh: "桌山", displayLat: -33.96, displayLon: 18.41 },
  guangzhou: { kind: "canton", name: "Canton Tower", nameZh: "广州塔", displayLat: 23.109, displayLon: 113.319 },
  seoul: { kind: "nseoul", name: "N Seoul Tower", nameZh: "N 首尔塔", displayLat: 37.5512, displayLon: 126.9882 },
  singapore: { kind: "marina", name: "Marina Bay Sands", nameZh: "滨海湾金沙", displayLat: 1.70, displayLon: 103.60 },
  istanbul: { kind: "hagia", name: "Hagia Sophia", nameZh: "圣索菲亚大教堂", displayLat: 41.0086, displayLon: 28.9802 },
  cairo: { kind: "giza", name: "Giza Pyramids", nameZh: "吉萨金字塔", displayLat: 29.9792, displayLon: 31.1342 },
  dubai: { kind: "burj", name: "Burj Khalifa", nameZh: "哈利法塔", displayLat: 25.1922, displayLon: 55.2814 },
  barcelona: { kind: "sagrada", name: "Sagrada Família", nameZh: "圣家堂", displayLat: 41.50, displayLon: 1.95 },
  "new-york": { kind: "empire", name: "Empire State Building", nameZh: "帝国大厦", displayLat: 40.7484, displayLon: -73.9857 },
  berlin: { kind: "brandenburg", name: "Brandenburg Gate", nameZh: "勃兰登堡门", displayLat: 52.5163, displayLon: 13.3777 },
  rio: { kind: "christ", name: "Christ the Redeemer", nameZh: "基督像", displayLat: -22.82, displayLon: -43.30 },
  sydney: { kind: "opera", name: "Sydney Opera House", nameZh: "悉尼歌剧院", displayLat: -33.68, displayLon: 150.82 },
  toronto: { kind: "cntower", name: "CN Tower", nameZh: "加拿大国家电视塔", displayLat: 43.6426, displayLon: -79.3871 },
  chicago: { kind: "willis", name: "Willis Tower", nameZh: "威利斯大厦", displayLat: 41.8789, displayLon: -87.6359 },
  "buenos-aires": { kind: "obelisco", name: "Obelisco de Buenos Aires", nameZh: "方尖碑", displayLat: -34.6037, displayLon: -58.3816 },
  auckland: { kind: "skytower", name: "Sky Tower", nameZh: "天空塔", displayLat: -36.8485, displayLon: 174.7622 },
  bangkok: { kind: "watarun", name: "Wat Arun", nameZh: "郑王庙", displayLat: 13.7437, displayLon: 100.4889 },
  jakarta: { kind: "monas", name: "National Monument (Monas)", nameZh: "独立纪念碑（Monas）" },
  "los-angeles": { kind: "griffith", name: "Griffith Observatory", nameZh: "格里菲斯天文台" },
  "new-orleans": { kind: "stlouis", name: "St. Louis Cathedral", nameZh: "圣路易主教座堂" },
  havana: { kind: "capitolio", name: "El Capitolio", nameZh: "哈瓦那国会大厦" },
  "sao-paulo": { kind: "masp", name: "São Paulo Museum of Art (MASP)", nameZh: "圣保罗艺术博物馆（MASP）" },
  "hong-kong": { kind: "hongkong", name: "Victoria Harbour skyline", nameZh: "维港天际线", displayLat: 22.45, displayLon: 114.04 },
};

export function getCitySignature(id: string): CitySignature | undefined {
  return signatures[id];
}

const conceptualAnchors: Record<string, { lat: number; lon: number }> = {
  busan: { lat: 35.35, lon: 128.95 },
  kingston: { lat: 18.17, lon: -76.85 },
};

export function getCityVisualAnchor(city: City) {
  const signature = signatures[city.id];
  return {
    lat: signature?.displayLat ?? conceptualAnchors[city.id]?.lat ?? city.lat,
    lon: signature?.displayLon ?? conceptualAnchors[city.id]?.lon ?? city.lon,
  };
}

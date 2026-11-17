// Curated "soundprint" metadata and companion landmarks, ported from the
// original local prototype. Only display data lives here; rendering code
// stays untouched so the curation layer can grow independently.

export interface FeaturedLandmark {
  kind: string;
  nameZh: string;
  name: string;
}

const COMPANION_LANDMARKS: Record<string, FeaturedLandmark[]> = {
  beijing: [
    { kind: "forbidden-city", nameZh: "故宫太和殿", name: "Hall of Supreme Harmony" },
    { kind: "great-wall", nameZh: "八达岭长城", name: "Badaling Great Wall" },
    { kind: "birds-nest", nameZh: "国家体育场 · 鸟巢", name: "Bird’s Nest Stadium" },
  ],
  shanghai: [
    { kind: "shanghai-tower", nameZh: "上海中心大厦", name: "Shanghai Tower" },
    { kind: "swfc", nameZh: "上海环球金融中心", name: "World Financial Center" },
    { kind: "customs-house", nameZh: "外滩海关大楼", name: "Customs House" },
  ],
  tokyo: [
    { kind: "sensoji", nameZh: "浅草寺五重塔", name: "Sensō-ji Pagoda" },
    { kind: "tokyo-skytree", nameZh: "东京晴空塔", name: "Tokyo Skytree" },
    { kind: "tokyo-city-hall", nameZh: "东京都厅", name: "Tokyo Metropolitan Government" },
  ],
  london: [
    { kind: "tower-bridge", nameZh: "伦敦塔桥", name: "Tower Bridge" },
    { kind: "london-eye", nameZh: "伦敦眼", name: "London Eye" },
    { kind: "st-pauls", nameZh: "圣保罗大教堂", name: "St Paul’s Cathedral" },
  ],
  paris: [
    { kind: "triumphal-arch", nameZh: "凯旋门", name: "Arc de Triomphe" },
    { kind: "louvre", nameZh: "卢浮宫金字塔", name: "Louvre Pyramid" },
    { kind: "notre-dame", nameZh: "巴黎圣母院", name: "Notre-Dame de Paris" },
  ],
  mumbai: [
    { kind: "taj-hotel", nameZh: "泰姬玛哈宫酒店", name: "Taj Mahal Palace Hotel" },
    { kind: "victoria-terminus", nameZh: "贾特拉帕蒂·希瓦吉终点站", name: "Chhatrapati Shivaji Terminus" },
    { kind: "bandra-sealink", nameZh: "班德拉海上大桥", name: "Bandra–Worli Sea Link" },
  ],
  seoul: [
    { kind: "gyeongbokgung", nameZh: "景福宫勤政殿", name: "Gyeongbokgung Palace" },
    { kind: "lotte-tower", nameZh: "乐天世界塔", name: "Lotte World Tower" },
    { kind: "sungnyemun", nameZh: "崇礼门", name: "Sungnyemun Gate" },
  ],
  "new-york": [
    { kind: "liberty", nameZh: "自由女神像", name: "Statue of Liberty" },
    { kind: "brooklyn-bridge", nameZh: "布鲁克林大桥", name: "Brooklyn Bridge" },
    { kind: "chrysler", nameZh: "克莱斯勒大厦", name: "Chrysler Building" },
  ],
  lagos: [
    { kind: "lekki-bridge", nameZh: "莱基—伊科伊大桥", name: "Lekki–Ikoyi Link Bridge" },
    { kind: "lagos-cathedral", nameZh: "拉各斯基督教堂", name: "Cathedral Church of Christ" },
    { kind: "independence-house", nameZh: "独立大厦", name: "Independence House" },
  ],
  "sao-paulo": [
    { kind: "obelisco", nameZh: "伊比拉普埃拉方尖碑", name: "Ibirapuera Obelisk" },
    { kind: "se-cathedral", nameZh: "圣保罗主教座堂", name: "São Paulo Cathedral" },
    { kind: "copan", nameZh: "科潘大厦", name: "Edifício Copan" },
  ],
  istanbul: [
    { kind: "galata", nameZh: "加拉塔塔", name: "Galata Tower" },
    { kind: "blue-mosque", nameZh: "蓝色清真寺", name: "Blue Mosque" },
    { kind: "maidens-tower", nameZh: "少女塔", name: "Maiden’s Tower" },
  ],
  berlin: [
    { kind: "berlin-tv", nameZh: "柏林电视塔", name: "Berlin Television Tower" },
    { kind: "reichstag", nameZh: "德国国会大厦", name: "Reichstag Building" },
    { kind: "berlin-cathedral", nameZh: "柏林大教堂", name: "Berlin Cathedral" },
  ],
};

export function companionLandmarksFor(cityId: string): FeaturedLandmark[] {
  return COMPANION_LANDMARKS[cityId] ?? [];
}

export interface CuratedCity {
  id: string;
  serial: string;
  bpm: number;
  keywordsZh: [string, string, string];
  keywordsEn: [string, string, string];
}

export const curatedCities: CuratedCity[] = [
  { id: "beijing", serial: "01", bpm: 96, keywordsZh: ["对称", "低频", "回声"], keywordsEn: ["Symmetry", "Bass", "Echo"] },
  { id: "shanghai", serial: "02", bpm: 112, keywordsZh: ["霓虹", "摇摆", "脉冲"], keywordsEn: ["Neon", "Swing", "Pulse"] },
  { id: "tokyo", serial: "03", bpm: 124, keywordsZh: ["密度", "霓虹", "切分"], keywordsEn: ["Density", "Neon", "Syncopation"] },
  { id: "london", serial: "04", bpm: 132, keywordsZh: ["电台", "低音", "雨"], keywordsEn: ["Radio", "Bass", "Rain"] },
  { id: "paris", serial: "05", bpm: 108, keywordsZh: ["香颂", "冷光", "漫步"], keywordsEn: ["Chanson", "Cold light", "Flânerie"] },
  { id: "mumbai", serial: "06", bpm: 104, keywordsZh: ["季风", "鼓点", "歌声"], keywordsEn: ["Monsoon", "Drums", "Vocal"] },
  { id: "seoul", serial: "07", bpm: 118, keywordsZh: ["精密", "霓虹", "和声"], keywordsEn: ["Precision", "Neon", "Harmony"] },
  { id: "new-york", serial: "08", bpm: 98, keywordsZh: ["切分", "铜管", "街头"], keywordsEn: ["Syncopation", "Brass", "Street"] },
  { id: "lagos", serial: "09", bpm: 110, keywordsZh: ["律动", "海岸", "合唱"], keywordsEn: ["Groove", "Coast", "Choir"] },
  { id: "sao-paulo", serial: "10", bpm: 126, keywordsZh: ["混音", "热带", "速度"], keywordsEn: ["Mix", "Tropic", "Velocity"] },
  { id: "istanbul", serial: "11", bpm: 100, keywordsZh: ["回响", "弦乐", "渡轮"], keywordsEn: ["Echo", "Strings", "Ferry"] },
  { id: "berlin", serial: "12", bpm: 128, keywordsZh: ["极简", "低频", "长夜"], keywordsEn: ["Minimal", "Bass", "Long night"] },
];

export function curatedFor(cityId: string): CuratedCity | undefined {
  return curatedCities.find((city) => city.id === cityId);
}

// Hand-curated songs that carry a city's identity beyond what lyrics can
// prove — Olympic anthems, film classics, streets sung into legend. Each
// entry is an iTunes search query; the top (most relevant) hit is pinned to
// the front of the queue without screening. Queries name the event or the
// classic performer ("北京奥运会", "上海滩 叶丽仪") because the bare song
// title surfaces covers, and the original versions are often not on the US
// storefront. Lyrics rarely mention the city here — 《我和你》, the 2008
// Beijing Olympics anthem, never says "Beijing" — which is why these songs
// cannot be found by screening alone. Cities not listed fall back to the
// lyrics screening.
export const CITY_ANTHEMS: Record<string, string[]> = {
  beijing: ["北京奥运会", "北京欢迎你"],
  shanghai: ["上海滩 叶丽仪", "夜上海 周璇"],
  "hong-kong": ["东方之珠 罗大佑"],
  liverpool: ["Penny Lane The Beatles"],
};

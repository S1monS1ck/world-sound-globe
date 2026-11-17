# World / Sound

以昼夜变化的地球为入口的音乐探索网页原型。64 座城市都有贴附地球表面的轻量场景：北京、巴黎、上海、伦敦、孟买、东京使用带静态 OpenStreetMap 周边数据的场景，另有 58 座采用独立命名的地标造型速写。所有新增速写均非测绘级模型。播放器仅演示界面动效，尚未接入音源或 Apple Music。

## 本地运行

需要 Node.js 22.13+ 与 pnpm 11。

```bash
pnpm install
pnpm dev
```

静态构建与本机预览：

```bash
pnpm build:static
pnpm exec vite preview --config vite.static.config.ts --host 127.0.0.1 --port 4174
```

静态文件位于 `site-dist/`。本机预览只在运行它的电脑上可用；多台电脑访问需要将该目录部署到正式托管服务。旧的 `edgeone-upload.zip` 不代表当前构建。

## 结构

- `app/`：页面入口、全局视觉系统和元数据。
- `components/world-stage.tsx`：Three.js 地球、太阳方向、城市节点和保持在地球外侧的镜头。
- `components/city-district.tsx`：从 OpenStreetMap 地理位置抽取少量地标周边建筑，并为地球尺度的可读性简化体量；城市微缩场景贴附地球表面，使地球弧线始终可见。
- `components/city-vignette.tsx`：其余城市的合并几何体速写，使用小范围街区线与少量低矮建筑，不绘制整块圆形地台；具名造型与通用城市速写在界面中分开标识。
- 本轮优先补齐成都安顺廊桥、洛杉矶格里菲斯天文台、圣保罗 MASP、雅加达独立纪念碑、新奥尔良圣路易主教座堂、哈瓦那国会大厦；同时将首尔塔、CN 塔与天空塔拆为不同轮廓。它们仍是风格化速写，不冒充精确建筑模型。
- `lib/city-signatures.ts`：具名造型与城市视觉锚点。视觉锚点是构图坐标，不是建筑的精确经纬度；为避免粗分辨率地球底图上的“建筑入海”，部分沿海城市向内陆移动。特别是新加坡的当前展示位置位于周边陆地，不能作为地理导航或精确地标定位使用。后续需要更高精度的海岸数据与真实模型来消除这种偏差。
- 上海微缩场景的视觉锚点为避免突出海面而向内陆移动；界面中的经纬度仍是东方明珠的真实坐标，视觉锚点不作精确导航用途。
- `components/landmark-model.tsx`：六座地标的风格化模型，北京以天坛祈年殿的三层蓝瓦圆顶、朱红柱廊和汉白玉台基为特征；主要高度与建筑特征参考公开资料，并非测绘级模型。
- `components/world-experience.tsx`：双语界面、城市检索、双音乐模式和播放器状态。
- `lib/cities.ts`：独立的策展型城市数据层，可在不改渲染代码的情况下扩充。
- `public/city-data/`：随站点发布的 OpenStreetMap 建筑资料；运行时不调用地图接口。
- `public/textures/`：随站点发布的陆地轮廓和夜间灯光；不使用白天卫星影像。

## 稳定性约束

- 3D 场景有 WebGL 能力检测与运行时错误边界；场景失败时，其余界面仍可使用。
- 移动端简化布局、降低渲染像素比和减少动态效果偏好均已处理。
- 核心视觉资源、六座地标的周边数据以及其余城市的程序化造型均随站点一起发布，避免运行时地图接口故障。
- `scripts/check-city-land.py` 可用 Pillow 对 64 个视觉锚点做离线陆地遮罩检查；这只能排除中心点明显落海，不能证明整座模型完全贴合真实海岸线。
- Apple Music 密钥不得进入客户端仓库；第二阶段应通过服务端签发短时 MusicKit developer token。

## 数据与视觉来源

- 夜间灯光：NASA Suomi NPP / VIIRS Black Marble 2016。
- 陆地轮廓：[Natural Earth 1:50m](https://www.naturalearthdata.com/downloads/50m-physical-vectors/)。
- 地标周边建筑资料：© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，ODbL。
- 城市音乐标签与重点级别为产品策展数据，不表示实时排行榜。

参考：[NASA Black Marble](https://svs.gsfc.nasa.gov/30876/)

本轮地标形态参考：[成都市文旅](https://www.gochengdu.cn/en/article/column_167083285087556/4926)、[格里菲斯天文台](https://griffithobservatory.org/wp-content/uploads/2023/02/Module1_Teacher_Guide.pdf)、[MASP](https://masp.org.br/en/about)、[印尼旅游局](https://www.indonesia.travel/us/en/destination/java/jakarta/dki-jakarta---national-monument)、[圣路易主教座堂](https://www.stlouiscathedral.org/about)、[古巴旅游局](https://www.cuba.travel/destinos/lahabana/quehacer/ciudad)。

## 下一阶段

64 座城市现均有具名地标场景。继续逐城比对外观、比例与贴地效果；风格化模型及视觉锚点不能作为测绘或导航依据。

播放器仍需接入 MusicKit on the Web，完成用户授权、Apple Music 搜索与播放、城市队列生成、错误重试、令牌轮换和真实播放状态同步。线上 GitHub Pages 版本只有在重新发布静态构建后才会更新。

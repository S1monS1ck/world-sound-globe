# World / Sound

一个以实时昼夜地球为入口的全球音乐探索网页。当前版本是第一阶段的完整交互原型：3D 地球、真实夜间灯光、代表性城市索引、球面建筑标志、城市聚焦、双收听模式与播放器界面均已实现；音乐暂用概念队列，Apple Music 接入留在第二阶段。

## 本地运行

需要 Node.js 22.13+ 与 pnpm 11。

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

## 结构

- `app/`：页面入口、全局视觉系统和元数据。
- `components/world-stage.tsx`：Three.js 地球、实时太阳方向、城市节点、建筑群、相机与交互。
- `components/world-experience.tsx`：双语界面、城市检索、双音乐模式和播放器状态。
- `lib/cities.ts`：独立的策展型城市数据层，可在不改渲染代码的情况下扩充。
- `public/textures/`：本地托管的地球贴图，避免运行时依赖第三方 CDN。

## 稳定性约束

- 3D 场景有 WebGL 能力检测与运行时错误边界；场景失败时，其余界面仍可使用。
- 自适应像素比、移动端简化布局、减少动态效果偏好均已处理。
- 所有核心视觉资源与城市数据随站点一起发布，避免远程资源失效导致白屏。
- Apple Music 密钥不得进入客户端仓库；第二阶段应通过服务端签发短时 MusicKit developer token。

## 数据与视觉来源

- 夜间灯光：NASA Suomi NPP / VIIRS Black Marble 2016。
- 白天地球：NASA Blue Marble 衍生贴图。
- 城市音乐标签与重点级别为产品策展数据，不表示实时排行榜。

参考：[NASA Black Marble](https://svs.gsfc.nasa.gov/30876/) · [NASA Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble)

## 下一阶段

接入 MusicKit on the Web，完成用户授权、Apple Music 搜索与播放、城市队列生成、错误重试、令牌轮换和真实播放状态同步。视觉层与音乐服务层保持分离，避免更换音乐数据源时重写地球体验。

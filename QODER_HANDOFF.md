# World / Sound — Qoder 接手说明

交接整理日期：2026-11-16。此文件与 `AGENTS.md` 仅为本地交接资料，本次未上传或更改正式网站。

## 1. 打开哪个项目

完整源码目录：`C:\Users\wang\Documents\ChatGPT\模拟\world-sound-globe`。

在同一台电脑的 Qoder 中直接打开这个目录。Qoder IDE 使用“File → Open Folder”；Qoder 桌面 Agent 使用 Coding 模式添加本地项目，并选择 Local。

当前本地源码分支是 `dev/landmarks`，但许多最新模型文件仍未提交或未被 Git 跟踪。首次接手先使用 Local，不要直接从旧提交创建 Worktree，也不要通过 Git 清理工作区。先核对 `git status` 并保留所有改动。

### 两个 Git 仓库不能当成同一个

- 本地源码仓库：此目录。当前没有配置远程地址，历史与公开成品仓库不同。不要直接加远程后强制推送。
- 公开成品仓库：`https://github.com/S1monS1ck/world-sound-globe`。
- 公开开发分支：`https://github.com/S1monS1ck/world-sound-globe/tree/dev/landmarks`。
- 正式网站：`https://s1mons1ck.github.io/world-sound-globe/`。
- 另有本地成品目录 `C:\Users\wang\Documents\Codex\2026-10-20\new-chat\world-sound-globe-pages`，它不是完整源码。其分支虽已切为 `dev/landmarks`，但最近远程拉取因网络失败，内容可能旧于线上。

2026-11-16 重新构建并按 Git blob SHA 核对：`site-dist/` 的 18 个成品文件都已包含在远程 `dev/landmarks` 提交 `fb83f0021b5f68c872b53de3480cb0ae76660689` 中。该结论仅针对成品，不代表完整源码已上传。远程还有历史构建文件，未作清理。

如果将来需要 Qoder 云端或另一台电脑开发，先整理并同步完整源码。建议在开发分支下建立明确的源码目录，同时保留静态发布布局；先检查文件清单、依赖和敏感信息，再通过正常提交同步，不覆盖公共仓库历史。

## 2. 如何运行

技术主体：React、TypeScript、Three.js、React Three Fiber；静态页面由 Vite 构建。仓库还保留 Next/Vinext 与旧 Sites/Cloudflare 相关结构，但当前公开站点走静态入口。

项目声明 Node.js >= 22.13.0，包管理器 `pnpm@11.25.0`；保留 `pnpm-lock.yaml`，不要无故升级依赖。

先检查 `node -v` 和 `pnpm -v`。同机现有依赖可先复用；缺失依赖时执行：

```sh
pnpm install --frozen-lockfile
```

推荐静态开发入口（支持开发时更新）：

```sh
pnpm exec vite --config vite.static.config.ts --host 127.0.0.1 --port 4174
```

打开终端实际给出的本地网址。若端口占用，使用新端口并告知用户，不终止未知进程。

类型检查和正式静态构建：

```sh
pnpm exec tsc --noEmit
pnpm build:static
```

构建后预览：

```sh
pnpm exec vite preview --config vite.static.config.ts --host 127.0.0.1 --port 4174
```

产物是 `site-dist/`。开发和预览服务器关闭后，127.0.0.1 链接不可访问，这是本地预览的性质；不要把它作为可跨电脑访问的交付网址。

最近类型检查与静态构建通过，构建存在主 3D 文件超过 500 kB 的体积提示。尚不能据此宣称长期稳定性或完整交互验收已通过。

## 3. 核心文件

| 文件 | 用途 |
| --- | --- |
| `standalone/main.tsx`、`vite.static.config.ts` | 当前公开版本的入口与打包方式 |
| `components/world-experience.tsx` | 主界面、搜索、城市选择、双模式、模拟播放器 |
| `components/world-stage.tsx` | 地球、灯光、城市点、相机与缩放控制 |
| `components/landmark-model.tsx` | 六座主要地标程序化模型 |
| `components/city-district.tsx` | 六座城市的地表场景及简约周边建筑 |
| `components/city-vignette.tsx` | 其余 58 座具名地标速写与周边配景 |
| `lib/cities.ts` | 64 座城市、代表性等级、音乐策展标签 |
| `lib/city-scenes.ts`、`lib/city-signatures.ts` | 地标类型、比例、朝向与视觉锚点 |
| `lib/city-picking.ts`、`lib/globe.ts` | 城市点选与球面定位相关逻辑 |
| `app/globals.css` | 页面视觉样式 |
| `public/city-data/`、`public/textures/` | 本地城市数据、陆地轮廓与夜光资源 |

## 4. 当前完成程度

- 有风格化可交互地球、真实时间驱动的昼夜变化、固定夜光资料。
- 有 64 座城市的具名地标展示；六座使用单独模型，其余为风格化速写。并非每座都经过完整外观验收。
- 有“此刻”和“地方之声”、双语界面与城市索引。
- 播放器目前只有界面动效，没有实际音频播放、MusicKit 登录或 Apple Music 数据服务。
- 城市音乐标签来自策展配置，不是当前当地真实收听排行。

## 5. 最近修改与已知问题

- 德里 India Gate 已改为贯通圆拱、柱壁与层叠檐口，仍为简模，材质和细节可继续提升。
- 孟买 Gateway of India 使用拱洞、浅穹顶和四角塔模型；去掉周围突兀道路、地台与光晕，保留四栋简约配景，调整了默认相机。
- 孟买真实地标坐标仍是 `18.92190, 72.83460`；当前显示锚点为 `19.25, 73.65`。这是为了让放大的微缩场景落在简化底图的陆地上，不能声称精确定位。
- 上海及部分其他沿海城市也有向内陆偏移的展示锚点。阅读配置后再改，避免重现建筑落海。
- 线上已实看德里和孟买画面。上次滚轮操作的自动检查发生工具连接超时，缩放完整流程仍需补验；不要未经复测就认定产品失效或已经修好。
- `scripts/check-city-land.py` 只检查部分配置来源的中心点，不能代替全建筑占地、场景锚点和浏览器画面的核查。
- 六座地标仍依赖静态城市 JSON 加载，失败时的城市内容反馈可以进一步改善。

## 6. 接手后的第一轮工作

1. 阅读本文件、开发约定与实际代码，核对分支和未提交文件。
2. 启动当前版本，先确认原样可运行，不立即重写。
3. 检查城市点击、聚焦、放大、缩小、拖动、回到全球；重点复查孟买、德里、上海、北京。
4. 给用户说明真实完成状态，再结合比赛主题、截止时间和评分标准确定工作顺序。
5. 后续修改只在开发分支；视觉修改实看截图，功能修改验证实际交互，再提交可复现的结果。

## 7. 比赛材料需要用户补充

比赛名称或链接、赛道与主题、截止时间、评分规则、交付格式，以及对既有项目和 AI 辅助开发的要求。这些资料尚未提供，不应替用户编造要求或宣称项目已满足参赛条件。

保留 README 中的 NASA 夜光、Natural Earth 陆地与 OpenStreetMap 数据来源。现有浏览器与插件的登录状态、开发工具权限不会随源码自动转移。不要复制它们的凭据。

若换电脑：复制经过检查的完整源码和公共资源，包含这些未提交文件与交接文件；重新安装依赖。不要仅克隆当前成品仓库，也不要把 node_modules、构建缓存、.env、私钥或工具账号目录当作项目源码上传。

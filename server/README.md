# World / Sound — 后端开发说明

> 本目录（`server/`）承载 World / Sound 的后端业务逻辑。技术栈决策与完整规范见
> [`docs/backend-stack-plan.md`](../docs/backend-stack-plan.md)；开发约定见 [`AGENTS.md`](../AGENTS.md)。
> 本分支 `dev/backend` 基于 `dev/landmarks` 创建，后端全部工作只在本分支进行。

## 一、我们负责什么

后端负责为前端提供**音乐播放能力**——目前前端播放器只有界面动效，没有任何真实音源。
后端不触碰地球渲染、城市街区等前端代码（渲染问题在前端分支修）。

| 端点 | 职责 | 状态 |
|---|---|---|
| `GET /api/health` | 健康检查，部署验证用 | 待开发 |
| `GET /api/preview?city=<id>` | iTunes Search API 官方 30 秒试听代理 + 缓存，服务"地方之声"模式 | 待开发 |
| `GET /api/radio?city=<id>` | 电台直播流：Radio Garden → Radio Browser 双源降级，服务"此刻"模式 | 待开发 |

## 二、技术栈（定稿）

- **框架**：Next.js 16 App Router 的 Route Handlers（前后端同仓同进程，`next dev` 单命令起全套）
- **逻辑层**：`server/lib/` 内**框架无关纯函数**——只接收参数、返回数据，不 import Next 类型；未来若迁移运行时，这层原样搬走
- **校验**：zod；城市 id 按白名单（`lib/cities.ts`）校验
- **缓存**：route handler 模块级 Map + fetch `revalidate`，本期不建数据库
- **音源**：全部免费、无密钥、无账号。MusicKit 已移出本期范围

## 三、目录规划

```text
server/
├── README.md            # 本文件
└── lib/
    ├── types.ts         # 前后端共享类型 + zod schema
    ├── preview.ts       # 纯函数：城市 → [{ title, artist, previewUrl, artworkUrl }]
    └── radio.ts         # 纯函数：城市 → { streamUrl, station, source }
app/api/
├── health/route.ts
├── preview/route.ts     # 薄壳：调 server/lib/preview.ts
└── radio/route.ts       # 薄壳：调 server/lib/radio.ts
```

## 四、端点契约

```text
GET /api/health
  → { ok: true }

GET /api/preview?city=beijing
  → { city, tracks: [{ title, artist, previewUrl, artworkUrl }] }

GET /api/radio?city=beijing
  → { city, streamUrl, station, source: "radio-garden" | "radio-browser" | "none" }
```

约定：

1. 参数只接受 `lib/cities.ts` 中存在的城市 id，非法参数返回 400；
2. 上游失败一律静默降级（radio 返回 `source: "none"` + 空流），**不抛 500**；
3. 响应始终带 `source` 字段，前端据此展示来源与降级提示；
4. 缓存键含城市 id，TTL 1 小时。

## 五、本地开发

```sh
# 依赖安装（Node >= 22.13，pnpm 11）
pnpm install --frozen-lockfile

# 前后端单进程开发（页面 127.0.0.1:3000，/api/* 同源）
pnpm dev        # 第 1 阶段完成后此命令将指向官方 next dev

# 验证端点
curl "http://127.0.0.1:3000/api/health"
curl "http://127.0.0.1:3000/api/preview?city=beijing"
curl "http://127.0.0.1:3000/api/radio?city=beijing"
```

调试真实上游时可直接 curl 官方接口确认数据形态：

```sh
# iTunes 试听（无需密钥）
curl "https://itunes.apple.com/search?term=grime&entity=song&limit=3"

# Radio Garden（城市电台）
curl "https://radio.garden/api/ara/content/page/113/talks"
```

## 六、实施阶段

- [x] **阶段 1**：官方 `next dev` 跑通现有页面（弃用 vinext），处理 WebGL SSR（`dynamic(ssr:false)`），全量回归前端交互
- [x] **阶段 2**：`/api/preview`（iTunes 代理 + 缓存），含 Apple Music 元数据（专辑/流派/年份/链接）
- [x] **阶段 3**：`/api/radio`（Radio Garden 主源 + Radio Browser 降级）——实施时确认 Radio Garden 被 Cloudflare 挡，改以 Radio Browser 为正式主源
- [x] **阶段 4**：前端 Player 接线（加载/播放/静音三态），双模式浏览器实测；另交付 Apple Music 式正在播放视图与导航栏材质、液态玻璃图层、SF 排版系统
- [x] **阶段 5 回归**：全交互链路浏览器实测通过（落地/进入/抽屉搜索/选城/电台直播/试听轮播/介绍窗/正在播放/Esc 链/返回地球）；`next build` 与遗留 `build:static` 双通过
- [ ] **阶段 5 部署**：Vercel 部署**须用户明确授权后**单独执行

## 七、约定与红线

- 只在 `dev/backend` 分支提交；不合并、不推送 `main` / `dev/landmarks`
- 新代码带注释；变量命名与仓库现有风格保持一致
- 密钥、凭据不进仓库；本期无密钥，未来若有一律走环境变量
- 每次交付：改动文件清单 + 改动说明 + 规范 commit 信息
- 遇依赖缺失、构建报错、逻辑冲突：先报告，不擅自大范围重构

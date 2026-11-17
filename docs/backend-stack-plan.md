# 后端技术栈规范（定稿）

> 制定日期：2026-11-17 · 状态：已定稿待实施 · 关联文档：AGENTS.md、QODER_HANDOFF.md、README.md

## 1. 决策结论

采用 **Next.js 全栈**：前端与后端同仓同框架，后端以 Route Handlers 实现，部署到 Vercel。

**决策过程**：评估过三个方案——Cloudflare Workers + Hono（被否决：希望采用更主流的框架）、Node 传统服务器（否决：运维成本最高）、BaaS 云服务（否决：平台锁定）。选择 Next.js 的理由：

1. 仓库 `app/` 目录已渲染 `WorldExperience`，UI 迁移完成一半；
2. 前后端同一框架、同一进程、同一部署，无跨域与环境差异；
3. 赛后扩展（账号、SEO、数据库）是框架内置能力。

**硬性约束**：

- 弃用 beta 的 `vinext`，开发与构建统一走官方 `next dev` / `next build`；
- 音源方案全免费、无密钥、无账号；MusicKit 整条线移出本期；
- 后端业务逻辑写成框架无关纯函数（`server/lib/`），不与 Next 类型耦合；
- 实施全程本地验证；任何公开部署（Vercel）需用户明确授权后执行。

## 2. 前端（组件不动，入口切官方）

| 项 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 16.3.4（App Router）+ React 19 | 仓库已装 |
| 3D 渲染 | @react-three/fiber + drei + three 0.180 | 现有组件零改动；`WorldStage` 以 `dynamic(ssr: false)` 包裹，避免服务端渲染 WebGL |
| 样式 | app/globals.css | 前后端入口共用，不动 |
| 状态 | 组件内 useState | 不引入状态管理库 |
| 构建工具 | 官方 `next dev` / `next build` | `scripts/run-framework.mjs` 的 vinext 分支退役 |

## 3. 后端（Route Handlers + 纯函数层）

```text
app/
├── page.tsx                    # 已有：渲染 WorldExperience
├── api/
│   ├── health/route.ts         # GET 健康检查，部署验证用
│   ├── preview/route.ts        # GET iTunes 30s 试听代理 + 缓存
│   └── radio/route.ts          # GET 电台流：Radio Garden → Radio Browser 降级
server/
└── lib/
    ├── types.ts                # 前后端共享类型 + zod 校验
    ├── preview.ts              # 纯函数：城市 → 试听曲目列表
    └── radio.ts                # 纯函数：城市 → 可播电台流（双源降级）
```

- **缓存**：route handler 内模块级 Map + fetch `next: { revalidate: 3600 }`，不引入 KV/数据库。
- **校验**：城市 id 一律经 zod 校验（白名单校验 `lib/cities.ts` 内 id）。
- **降级**：任何上游失败静默降级，不抛 500；响应始终携带 `source` 字段标注实际音源。
- **数据库**：本期不建。用户数据（visited 图集）继续 localStorage；赛后如需云同步启用 drizzle + D1。

## 4. 音源方案（全免费）

| 模式 | 一级源 | 二级降级 | 最终兜底 |
|---|---|---|---|
| 此刻（电台） | Radio Garden（城市粒度，非官方 API，规范见 radio-garden-openapi） | Radio Browser（开源合规，按国家/标签过滤） | 静音占位 |
| 地方之声（曲目） | iTunes Search API 官方 30s 试听 ×3 首轮播 | — | 静音占位 |

MusicKit / Apple Developer 账号相关内容移出本期；未来接入时按 panva/jose 的 ES256 示例补 `/api/musickit-token`。

## 5. 端点契约

```text
GET /api/health?            → { ok: true }
GET /api/radio?city=beijing → { streamUrl, station, source: "radio-garden" | "radio-browser" | "none" }
GET /api/preview?city=beijing → { tracks: [{ title, artist, previewUrl, artworkUrl }] }
```

前端统一使用相对路径 `/api/*`（Next 同源），失败按 UI 三态（加载/播放/静音降级）处理。

## 6. 实施阶段（合计约 3-4.5 个工作日）

1. **入口验证**（0.5-1 天）：官方 next CLI 跑通现有 app/ 目录，处理 WebGL SSR；完成后全量回归交互（点击/缩放/右键/双击/抽屉/双模式，浏览器实看）。
2. **`/api/preview` + `/api/radio`**（1-1.5 天）：纯函数 + 路由壳；参考 panva/jose 示例与 radio-garden-openapi 规范。
3. **前端 Player 接线**（0.5-1 天）：三态联动，双模式浏览器实测。
4. **回归 + 收尾**（0.5 天）：构建通过、全部交互复测、输出改动清单与 commit。

每阶段独立提交，遵循 AGENTS.md 的开发约定（只改 `dev/landmarks`、小步模块化、新代码带注释）。

## 7. 部署形态与前置确认

- **本地**：`next dev` 单进程起在 127.0.0.1:3000，页面与 `/api/*` 同源。
- **部署**（授权后执行）：Vercel 一键；GitHub Pages 旧静态站随之下线，下线时点由用户决定。
- **比赛交付**：Vercel 新站为准；旧站点（Qoder Sites 私有构建）保留还是重发，由用户在赛前确认。

## 8. 风险清单

| 风险 | 对冲 |
|---|---|
| WebGL SSR 水合坑（渲染入口切换的主要风险） | `dynamic(ssr: false)`；第 1 阶段完成后立即全量回归 |
| Radio Garden 非官方接口失效 | Radio Browser 二级源 + 静音兜底，前端无感 |
| vinext 退役后构建脚本残留 | run-framework.mjs 同步清理，避免双入口漂移 |
| 截止时间（2026-11-30 18:00） | 纯新增目录，随时可整体回退；不阻塞已完成的 5 个交互 commit |

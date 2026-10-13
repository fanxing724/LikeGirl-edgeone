# LikeGirl CE 的 EdgeOne Makers 版本

本仓库保留了原 PHP + MySQL 实现（`.php` 文件、`admin/`、`Style/`、`Botui/`、`DB/`），并新增了可直接部署到
EdgeOne Makers/Pages 的**忠实迁移版**：以原 PHP 页面为功能与视觉规格，仅把 PHP + MySQL + PHP Session +
本地上传目录替换为 EdgeOne Node 云函数 + Pages Blob 持久化。

## 架构

- **前台（多页静态壳 + 客户端渲染）**
  - `index.html` 首页（实时计时 + 五张导航卡片）
  - `little.html` 点点滴滴文章列表
  - `page.html` 文章详情（`?id=`，内容经 HTML 白名单清洗）
  - `leaving.html` 留言板（QQ 昵称/头像、限流、违禁词、IP 封禁）
  - `loveImg.html` 恋爱相册（单图/多图缩略格/`+n`/模态预览，复用 `Style/js/loveImg.js`）
  - `list.html` 恋爱清单（完成态样式 + 点击展开图片）
  - `about.html` 关于（BotUI 完整对话流程）
  - `app/common.js` 公共脚本：拉取 `/api/data`、注入原版页头/页脚 DOM、计时器、留言时间、HTML 白名单清洗、懒加载/悬浮按钮
  - 复用 `Style/`（全部原版 CSS/JS/字体/图标）与 `Botui/`，不重新设计。
- **后台** `admin.html` + `app/admin.js`：沿用原项目栏目、表单和基础样式的 SPA，导航布局与交互由适配层自行管理，
  含仪表盘、基本/情侣/卡片/版权设置、DIY 代码、文章、相册、清单、留言、IP 封禁、非法访问、About 对话配置的完整增删改查。
- **API** `node-functions/[[default]].js`：Node 云函数 catch-all，
  `@edgeone/pages-blob` 强一致存储站点设置、文章、相册、清单、留言、封禁/访问记录与上传图片。
- `edgeone.json`：构建、缓存头与函数超时配置（Node 22.21.1）。

## 部署

1. 将仓库推送到 GitHub/Gitee，在 EdgeOne Makers 中导入。
2. 平台按 `edgeone.json` 执行 `npm install` 与 `npm run build`，静态产物位于 `dist`。
3. 在项目环境变量中配置：
   - `ADMIN_PASSWORD`：管理后台密码。
   - `SESSION_SECRET`：不少于 32 字符的随机字符串（`openssl rand -hex 32`）。
4. 重新部署，先访问 `/api/health`，期望返回 `{"ok":true,"storage":true}`。
5. 访问 `/admin.html` 登录后台进行配置；访问 `/index.html` 查看前台。
6. 在后台上传一张测试图片，确认返回的 `/api/media/image_...` 地址可正常访问。

## 数据与兼容说明

- 首次请求使用内置默认数据（与 `DB/LikeGirl-CE_DB.sql` 默认数据对齐）；第一次后台保存或访客留言后，
  结构化数据写入名为 `likegirl_ce` 的 Blob Store（键 `likegirl_site_data`）。
- 旧版简化数据会在读取时**深度合并**到新模型（`deepMerge`），不会因缺字段报错。
- 后台可上传背景图、相册多图、清单图片。支持 JPG/PNG/WebP/GIF，单张上限 4 MB。
- 图片与 JSON 共用同一 Blob Store；图片由 `/api/media/*` 流式输出，不依赖 PHP 上传目录或本地磁盘。
- 删除相册记录、替换背景或清单图片时，不再被引用的站内 Blob 图片会自动删除；外部 URL 不处理。
- EdgeOne 版本不读取 `admin/Config_DB.php`，也不需要 MySQL。
- 公开 `/api/data` 不返回留言 QQ/IP、封禁列表、访问记录与违禁词；留言以派生 `avatar` 展示头像。
- 文章保留 HTML，但渲染前经可审计的标签/属性白名单清洗（`app/common.js` 的 `sanitizeHTML`），防存储型 XSS。

## 数据导入 / 迁移

内置默认数据已镜像 `DB/LikeGirl-CE_DB.sql`。若需把真实环境数据迁入：

1. 从旧 PHP 环境导出 JSON（结构见 `node-functions/[[default]].js` 的 `defaults`）。
2. 用随附脚本推送到线上：

```bash
BASE=https://你的域名 TOKEN=<后台登录token> node scripts/import-json.mjs your-data.json
```

脚本会对 `/api/admin/data` 发起带 Bearer 会话的 PUT，服务端做权威校验后整体保存。

## API

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| `/api/health` | GET | Blob 存储健康检查 |
| `/api/data` | GET | 公开站点数据（脱敏） |
| `/api/media/:key` | GET | 读取 Blob 中的图片 |
| `/api/messages` | POST | 提交留言（同 IP 60 秒限制、违禁词、IP 封禁） |
| `/api/login` | POST | 获取 8 小时管理会话，同时设置 HttpOnly Cookie |
| `/api/logout` | POST | 清除浏览器管理会话 Cookie |
| `/api/admin/data` | GET/PUT | 需 Bearer 会话，读取/更新完整管理数据 |
| `/api/admin/upload` | POST | 需 Bearer 会话，上传图片到 Blob |

## 后台会话排障

后台登录设置 8 小时的 HttpOnly、SameSite=Strict Cookie，页面刷新后可恢复会话；Bearer Token 继续用于导入脚本等客户端。退出登录会清除浏览器 Cookie 和页面保存的 Token。

- 返回 401 表示会话缺失、签名无效或过期，需要重新登录。
- 返回 503 并提示安全配置，表示 `SESSION_SECRET` 未配置或不足 32 字符，应检查当前部署环境变量后重新部署。
- 更换 `SESSION_SECRET` 会使原有会话失效；普通代码部署在密钥不变时无需更换会话。
- Node 云函数按 `context.env`、全局绑定、`process.env` 的顺序读取环境变量。

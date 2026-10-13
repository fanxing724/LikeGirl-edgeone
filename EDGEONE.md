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
3. 访问 `/api/health`，确认 `ok`、`storage` 为 `true`。
4. 访问 `/admin.html`，首次自动跳转到 `/init.html`；设置并确认管理员密码（至少 8 个字符）。
5. 初始化后登录后台进行配置；访问 `/index.html` 查看前台。
6. 在后台上传一张测试图片，确认返回的 `/api/media/image_...` 地址可正常访问。

无需设置管理员密码或会话密钥环境变量。EdgeOne 版本采用 Pages Blob 提供键值持久化，与 OpenList-Worker 的 Blob 驱动机制相同，不需要另建 Edge KV 代理。

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

1. 从旧 PHP 环境导出 JSON（结构见 `node-functions/_lib/defaults.js`）。
2. 用随附脚本推送到线上：

```bash
BASE=https://你的域名 TOKEN=<后台登录token> node scripts/import-json.mjs your-data.json
```

脚本会对 `/api/admin/data` 发起带 Bearer 会话的 PUT，服务端做权威校验后整体保存。

## API

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| `/api/health` | GET | 存储健康检查与初始化状态 |
| `/api/setup/status` | GET | 查询是否已初始化 |
| `/api/setup` | POST | 首次设置管理员密码 |
| `/api/admin/password` | POST | 校验当前密码并修改密码，需管理会话 |
| `/api/data` | GET | 公开站点数据（脱敏） |
| `/api/media/:key` | GET | 读取 Blob 中的图片 |
| `/api/messages` | POST | 提交留言（同 IP 60 秒限制、违禁词、IP 封禁） |
| `/api/login` | POST | 获取 8 小时管理会话，同时设置 HttpOnly Cookie |
| `/api/logout` | POST | 清除浏览器管理会话 Cookie |
| `/api/admin/data` | GET/PUT | 需 Bearer 会话，读取/更新完整管理数据 |
| `/api/admin/upload` | POST | 需 Bearer 会话，上传图片到 Blob |

## 初始化与后台会话

`init.html` 检查 `/api/setup/status`：未初始化时显示设置密码表单，已初始化时进入登录页。初始化接口只写独立的 `likegirl_admin_auth` 键，保留已有站点内容。

密码采用 PBKDF2-SHA256（210,000 次迭代、独立随机盐）存储哈希。会话签名密钥由密码学随机数生成，存入同一认证记录；每次登录和验签从持久化存储读取，多实例和冷启动使用同一密钥。认证记录不会出现在公开数据或后台内容数据中。

登录设置 8 小时 HttpOnly、SameSite=Strict Cookie，刷新页面可恢复会话；Bearer Token 继续供导入脚本使用。退出登录清除浏览器 Cookie 和页面 Token。后台修改密码需要当前密码和有效会话，并生成新签名密钥，使全部旧会话失效。

- 401：会话缺失、签名无效或已过期，需要重新登录。
- 409 / `NOT_INITIALIZED`：先完成初始化。
- 409 / `ALREADY_INITIALIZED`：已初始化，不能通过初始化接口覆盖密码。
- 503 / `STORAGE_UNAVAILABLE`：存储读取、写入或数据校验失败。失败不会被当成未初始化，也不会覆盖已有认证记录。

原有环境变量认证已取消。升级旧部署后需要在初始化页面设置一次密码，原有内容保持不变。忘记密码时，可在平台存储控制台删除 `likegirl_admin_auth` 认证键后重新初始化；不要删除 `likegirl_site_data` 内容键。

## 分层与即时更新

- `node-functions/[[default]].js`：API 路由和业务操作，保持现有地址兼容。
- `_lib/auth.js`：密码哈希、HMAC 会话签发和校验，与站点配置分离。
- `_lib/repository.js`：Pages Blob 强一致读写；仅空存储使用默认内容，故障返回 503。
- `_lib/defaults.js`、`_lib/schema.js`：原项目数据模型、输入校验和公开数据脱敏。
- `_lib/http.js`：JSON 响应和禁缓存头。

现有 `likegirl_ce` Store 与 `likegirl_site_data` 键保持不变，无需迁移数据。设置表单只提交修改字段，服务端合并最新记录；保存成功后刷新前台即可生效。接口不依赖实例内的配置缓存，冷启动也从同一存储读取。

这套 Blob JSON 模型仍不提供跨实例的事务或条件写入；多个客户端同时修改时应避免并发保存。本文的字段合并改善旧页面覆盖问题，不等同于数据库事务。

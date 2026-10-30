# LikeGirl CE 的 EdgeOne Makers 版本

本仓库保留了原 PHP + MySQL 实现（`.php` 文件、`admin/`、`Style/`、`Botui/`、`DB/`），并新增了可直接部署到
EdgeOne Makers/Pages 的适配版：沿用原 PHP 页面的视觉与内容管理，将 PHP + MySQL + PHP Session 替换为
EdgeOne Node 云函数 + Pages Blob 持久化；服务器级访问控制和整站访问日志不在本项目中实现。

## 架构

- **前台（多页静态壳 + 客户端渲染）**
  - `index.html` 首页（实时计时 + 五张导航卡片）
  - `little.html` 点点滴滴文章列表
  - `page.html` 文章详情（`?id=`，内容经 HTML 白名单清洗）
  - `leaving.html` 留言板（QQ 昵称/头像、限流、违禁词）
  - `loveImg.html` 恋爱相册（单图/多图缩略格/`+n`/模态预览，复用 `Style/js/loveImg.js`）
  - `list.html` 恋爱清单（完成态样式 + 点击展开图片）
  - `about.html` 关于（BotUI 完整对话流程）
  - `app/common.js` 公共脚本：拉取 `/api/data`、注入原版页头/页脚 DOM、计时器、留言时间、HTML 白名单清洗、懒加载/悬浮按钮
  - 复用 `Style/`（全部原版 CSS/JS/字体/图标）与 `Botui/`，不重新设计。
- **后台** `admin.html` + `app/admin.js`：沿用原项目栏目、表单和基础样式的 SPA，导航布局与交互由适配层自行管理，
  含仪表盘、基本/情侣/卡片/版权设置、DIY 代码、文章、相册、清单、留言、About 对话配置的完整增删改查。
- **API** `node-functions/[[default]].js`：Node 云函数 catch-all，
  `@edgeone/pages-blob` 强一致存储站点设置、文章、相册、清单、留言和图片链接。
- `edgeone.json`：构建、缓存头与函数超时配置（Node 22.21.1）。

## 部署

### 选择平台

- **EdgeOne 国内版**：从 [腾讯云控制台](https://console.cloud.tencent.com/edgeone) 进入 Pages / Makers，导入 Fork 后的 Git 仓库。主要面向国内访客时优先考虑具备中国大陆节点的配置。自定义域名在加速区域包含中国大陆时必须完成备案；账号、套餐与区域支持以控制台为准。
- **EdgeOne 国际版**：从 [edgeone.ai](https://edgeone.ai/) 进入 Pages / Makers，使用仓库 README 的部署按钮或手动导入 Git 仓库。区域、域名、Blob 与部署项目在所用站点分别配置；不要混用其他项目的凭据。
- **Cloudflare**：可作为迁移目标，但当前仓库没有直接可用的 Workers / Pages 后端。需要改造函数入口与存储，不能把静态部署成功当成完整站点可用。不建议面向国内访客部署，国内访问通常较慢且存在波动；这是一项部署建议，不是本项目已完成的测速结论。

### EdgeOne 国内版与国际版共用步骤

1. 在对应控制台创建项目，选择 Git 导入，授权仓库并选择部署分支。
2. 框架选择其他 / 自定义，根目录为仓库根目录；安装命令 `npm install`，构建命令 `npm run build`，静态输出目录 `dist`。Node.js 构建版本使用 `edgeone.json` 中的 `22.21.1`，函数实际运行时由平台提供。
3. 保留仓库根目录的 `node-functions/[[default]].js`、`node-functions/_lib/`、`package.json` 与 `edgeone.json`，让平台同时构建 API 与静态资源。不要只上传 `dist`，它不包含 API。无需把函数改放到 Edge Runtime 目录。
4. 检查当前项目的 Blob 功能是否可用。SDK `@edgeone/pages-blob` 在 EdgeOne 函数环境中读取部署凭据，使用 `likegirl_ce` Store；若控制台要求启用服务或确认协议，先按提示完成。无需自行创建同名 KV 绑定或配置管理员密码环境变量。
5. 访问 `/api/health/live` 确认函数可达，访问 `/api/health` 确认 `ok`、`storage` 为 `true`。若返回 503，应先检查 Blob 和函数日志，不能反复初始化覆盖数据。
6. 访问 `/admin.html`，首次跳转 `/init.html` 设置并确认至少 8 个字符的密码。初始化后 `/api/health/ready` 应返回 200。
7. 修改站点标题、新增文章、相册图片直链、清单和访客留言；刷新前台，重新登录并再次读取，确认内容与会话正常。图片使用第三方 HTTPS 直链，不测试已停用的上传接口。
8. 添加自定义域名，按控制台要求配置 DNS 与 HTTPS。切换域名后复测后台登录、留言、图片和健康接口；旧域名 Cookie 不会自动成为新域名会话。

国内版与国际版使用同一份源码不代表共享数据。迁移平台或项目时，应先导出内容，保留原存储并按新项目初始化流程验收。Git 自动部署与公开站点验收是两个步骤：构建成功不代表 Blob、管理会话和业务保存已验证。

### Cloudflare 迁移条件

此部分说明可行路径，不是当前版本的一键部署教程；仓库尚无 Cloudflare 入口、Wrangler 配置或存储适配器。

1. 前端继续运行 `npm run build`，静态产物为 `dist/`；后端需要另写 Workers `fetch` 入口，或 Pages `functions/` 路由。Cloudflare 不识别 EdgeOne 的 `node-functions/` 与 `edgeone.json`。
2. 配置兼容日期和 `nodejs_compat`，验证 `node:crypto`、`node:buffer` 与 Web Crypto 的实际支持和资源限制，尤其是 PBKDF2 密码派生。
3. 替换 EdgeOne Blob SDK，适配持久化 `get`、`setJSON`、`set`、`delete` 及旧图片流式读取。可评估 D1 或 R2；若使用 KV，必须处理最终一致性，不能直接沿用当前强一致读取假设。
4. 把存储绑定放入 Cloudflare 项目配置，保持认证记录与站点内容分开。仅启用 Node 兼容标志无法替代这一步。
5. 迁移数据、图片与客户端 IP 获取方式，完成登录、改密、跨实例读取、留言限流、数据保存及故障处理验收后再绑定正式域名。

面向国内访客优先选择合适区域的 EdgeOne；只有在了解国内线路表现并愿意维护适配代码时，才考虑 Cloudflare。不要将 Cloudflare 静态页面能打开描述为本项目全部功能已部署。

### 官方参考

- [EdgeOne 国内版 Blob](https://cloud.tencent.com/document/product/1552/131425)
- [EdgeOne 国内版自定义域名与备案要求](https://cloud.tencent.com/document/product/1552/127404)
- [EdgeOne 国际版 Node Functions 与静态路由优先级](https://pages.edgeone.ai/document/node-functions)
- [EdgeOne 国际版 Blob](https://edgeone.ai/document/210063146417373184)
- [EdgeOne 国际版域名与加速区域](https://pages.edgeone.ai/document/domain-overview)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Pages 运行配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Cloudflare 存储绑定](https://developers.cloudflare.com/pages/functions/bindings/)

## 数据与兼容说明

- 首次请求使用内置默认数据（与 `DB/LikeGirl-CE_DB.sql` 默认数据对齐）；第一次后台保存或访客留言后，
  结构化数据写入名为 `likegirl_ce` 的 Blob Store（键 `likegirl_site_data`）。
- 旧版简化数据会在读取时**深度合并**到新模型（`deepMerge`），不会因缺字段报错。
- 背景图、相册和清单图片仅使用第三方图床直链，后台不提供本地上传。
- Pages Blob 仅写入文字、配置、图片链接和管理员凭据；图片上传接口返回 410。旧的 `/api/media/*` 图片地址保留读取兼容。
- 删除相册记录、替换背景或清单图片时，不再被引用的站内 Blob 图片会自动删除；外部 URL 不处理。
- EdgeOne 版本不读取 `admin/Config_DB.php`，也不需要 MySQL。
- 公开 `/api/data` 不返回留言 QQ/IP、封禁列表、访问记录与违禁词；留言以派生 `avatar` 展示头像。
- 文章保留 HTML，但渲染前经可审计的标签/属性白名单清洗（`app/common.js` 的 `sanitizeHTML`），防存储型 XSS。

## 平台能力边界

当前项目的 HTML、CSS 和图片由静态资源服务直接响应，Node 云函数只处理 API。静态资源路由优先于函数路由，因此原 PHP 的整站 IP 拉黑和整站非法访问记录无法由当前 API 函数覆盖；相关后台栏目和业务逻辑已移除。需要整站访问控制或访问日志时，请使用部署平台提供的站点规则与日志能力（可用性取决于平台配置及套餐）。[官方路由说明](https://pages.edgeone.ai/document/node-functions)。

旧存储中的 `blockedIps`、`accessWarnings` 仅保留历史数据，不再执行、不展示，也不自动删除；管理 API 提交这两个字段会返回 400 / `UNSUPPORTED_FEATURE`。导入历史 JSON 前需移除这两个字段。默认 About 文案也不再宣称记录所有访客 IP；已有自定义文案保持原样。留言仍可记录请求 IP 并按 IP 限流，这与整站访问控制是不同能力。

保留文章、相册链接、清单、留言与违禁词管理、站点设置、BotUI 对话、管理员认证及健康监测。PHP/MySQL、本机文件上传与磁盘管理只属于历史代码，不会部署到 EdgeOne 静态产物。无刷新导航、动画等浏览器功能不受上述访问控制边界限制。

## EdgeOne 函数的限制与本项目取舍

本项目运行在 **Node 云函数**，不是纯 Edge Runtime。Edge Runtime 的 CPU 时间片和 Node 云函数的执行时长属于不同限制，不能据此判断文章管理、认证或存储不可实现。[运行时说明](https://pages.edgeone.ai/document/pages-functions-overview)。

| 限制或代价 | 对本项目的影响 | 处理方式 |
| --- | --- | --- |
| 静态资源优先匹配，不经过当前 API 处理器 | 原 PHP 在每次页面访问前执行的黑名单检查和访问记录无法覆盖静态页面 | 删除整站 IP 拉黑、非法访问记录的界面、路由和编辑逻辑；需要时使用平台访问规则与日志 |
| 函数按请求执行，存在冷启动和网络 I/O 延迟 | 首次加载、登录和 Blob 读取可能较慢；不能假定实例内变量长期存在 | 内容、认证和限流记录保存在共享存储；健康探针为读取设置 3 秒响应超时，监控端另留冷启动余量 |
| 执行时长有限 | 不适合在请求内运行长时间后台任务或常驻服务 | 本项目 `cloudFunctions.maxDuration` 配置为 30 秒；官方当前允许的配置范围是 10–120 秒，不应把本项目配置值当成平台永久上限 |
| Blob 强一致读取需要访问主存储，耗时高于缓存读取 | 保存后能读到新内容，但每次公开数据请求、认证和健康检查都有存储开销 | 保留强一致以避免配置和会话读取陈旧；监控建议每 60 秒一次，避免高频探测 |
| 当前代码以整份 JSON 做读取、修改、写回，没有使用条件写入或数据库事务 | 并发留言、多个后台页面同时保存或并发首次初始化存在竞争；强一致读取本身不能避免覆盖 | 适合低流量个人站，避免并发后台保存；高并发前应改造为条件写入或事务数据库。这是当前实现的边界，不是 EdgeOne 无法支持这些业务 |
| 当前留言限流采用先读后写，没有原子计数和自动过期清理 | 60 秒限制用于普通访客节流，不能保证抵御并发请求；不同 IP 的限流键会累积 | 保留普通留言限流，不宣称为防攻击措施；攻击防护使用平台能力，需要严格限流时再引入原子方案与过期策略 |
| 存储容量、函数调用和请求大小受账号配额约束 | 不能无限存储图片、记录或超大文章；默认内容上限也不是存储套餐保障 | 已关闭图片上传，使用第三方 HTTPS 直链；文字记录按现有条数上限保存，定期关注平台用量 |
| SDK、凭据注入和路由存在平台差异 | EdgeOne 代码不能原样作为 Cloudflare 后端运行 | Cloudflare 仅列为需适配的迁移目标，不提供错误的一键部署承诺 |

当前没有常驻进程、磁盘文件管理、PHP/MySQL 执行或定时备份的可用入口；历史 PHP 源文件仅作上游参考，构建脚本不会将它们发布到 `dist/`。图片上传接口保留 410 错误响应，用于阻止旧前端继续上传，后台不再提供上传按钮。保留的旧图片读取兼容并不代表继续开放图片存储。

上述限制不妨碍普通内容管理、管理员认证和只读健康检查。健康接口只能证明函数和存储读取状态，不验证写入能力、第三方图床或每个业务流程；部署验收仍需实际保存内容、登录和提交留言。

参考：[函数配额与限制](https://pages.edgeone.ai/document/limits-and-quotas)、[执行时长配置](https://pages.edgeone.ai/document/edgeone-json)、[Blob 一致性和存储说明](https://cloud.tencent.com/document/product/1552/131425)。不同账号、国内版与国际版的实际可用额度以各自控制台为准。

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
| `/api/health` | GET / HEAD | 存储健康检查与初始化状态；正常 200，故障或超时 503 |
| `/api/health/live` | GET / HEAD | 云函数存活检查，不访问存储 |
| `/api/health/ready` | GET / HEAD | 就绪检查，存储正常且已初始化才返回 200，否则 503 |
| `/api/setup/status` | GET | 查询是否已初始化 |
| `/api/setup` | POST | 首次设置管理员密码 |
| `/api/admin/password` | POST | 校验当前密码并修改密码，需管理会话 |
| `/api/data` | GET | 公开站点数据（脱敏） |
| `/api/media/:key` | GET | 读取 Blob 中的图片 |
| `/api/messages` | POST | 提交留言（同 IP 60 秒限制、违禁词） |
| `/api/login` | POST | 获取 8 小时管理会话，同时设置 HttpOnly Cookie |
| `/api/logout` | POST | 清除浏览器管理会话 Cookie |
| `/api/admin/data` | GET/PUT | 需 Bearer 会话，读取/更新完整管理数据 |
| `/api/admin/upload` | POST | 已停用，返回 410；使用第三方图床直链 |

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

## 第三方图床备用方式

背景图、关于页面背景、相册和恋爱清单图片都可以保存第三方图片直链。

1. 将图片上传到你使用的第三方图床，复制可直接显示图片的 HTTPS 地址。
2. 在后台对应的图片链接输入框中粘贴地址；相册支持每行一个，也支持分号分隔。
3. 后台只保存图片链接，不会向 EdgeOne 上传图片。
4. 保存后刷新前台查看图片。

这是一种替代图片托管方式，不会自动复制或备份图片。不要粘贴分享页面、Markdown 或 HTML 代码。优先使用长期有效且允许外链的地址；第三方链接失效时需要手动替换。删除本站记录不会删除第三方图床中的图片。站点文字与图片链接仍由 Pages Blob 保存，因此该方式不能替代站点数据存储。

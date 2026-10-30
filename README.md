<!-- fanxing-style:start -->
<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://fanxing724.github.io/new-make/fanxing724/projects/LikeGirl-edgeone/cover.light.svg">
  <img alt="LikeGirl · 一起的小日子" src="https://fanxing724.github.io/new-make/fanxing724/projects/LikeGirl-edgeone/cover.svg" width="100%">
</picture>

**把两个人的片刻，安放在自己的小站。**

照片、纪念日和想说的话，可以有一个属于两个人的地方。这个仓库把情侣记录小站适配到 EdgeOne，保留原项目来源与许可，也记录适配过程。

<sub>番星 / 星轨手记 · <a href="https://fanxing724.github.io/new-make/fanxing724/projects/style.html">风格样板</a> · <a href="https://fanxing724.github.io/">个人小站</a></sub>
<!-- fanxing-style:end -->

# LikeGirl EdgeOne

一个可部署到 EdgeOne Makers/Pages 的轻量情侣纪念小站。项目由 LikeGirl-CE 适配而来，使用静态前端、Node.js 云函数和 EdgeOne Pages Blob，不需要 PHP 服务器或 MySQL。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Deploy to EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=likegirl-edgeone&repository-url=https://github.com/fanxing724/LikeGirl-edgeone&install-command=npm%20install&build-command=npm%20run%20build&output-directory=dist)

## 功能

- 实时显示情侣相恋天数和时间。
- 记录文章、恋爱相册和共同愿望清单。
- 访客祝福留言，包含同 IP 60 秒频率限制。
- 管理后台可维护站点信息、文章、相册、清单和留言。
- 背景、相册和清单使用第三方 HTTPS 图片直链。
- 文字、配置和管理员凭据持久化到 EdgeOne Pages Blob。
- 后台保存内容后，前台刷新即可读取新内容，无需重新构建或部署。
- 兼容读取旧的站内 Blob 图片；上传接口已停用。
- 后台使用 HMAC 签名会话，用户文本统一转义输出。

## 平台适配范围

后台已移除整站 IP 拉黑和非法访问记录：当前静态页面不经过 API 云函数，无法沿用原 PHP 的整站拦截与记录方式。整站访问控制与日志请在部署平台配置。历史封禁与访问记录保留在存储中，但不再执行或提供编辑；留言的 IP 限流和违禁词过滤继续保留。详情见 [平台能力边界](EDGEONE.md#平台能力边界)及[函数限制与取舍](EDGEONE.md#edgeone-函数的限制与本项目取舍)。

## 架构

```text
浏览器
  ├─ 静态页面 ────────────→ EdgeOne Pages CDN
  ├─ 站点数据/留言/后台 ──→ Node.js Cloud Function
  └─ 旧版图片读取 ──────→ EdgeOne Pages Blob
```

| 部分 | 实现 |
| --- | --- |
| 前端 | 原生 HTML/CSS/JavaScript |
| API | EdgeOne Node 云函数，运行时由平台提供 |
| 存储 | `@edgeone/pages-blob`，强一致读取 |
| 路由 | `node-functions/[[default]].js` catch-all |
| 构建 | Node.js 脚本生成 `dist/` 静态产物 |

## 图片存储

图片仅使用第三方图床直链，本站不再上传图片到 EdgeOne Pages Blob。背景、相册和清单保存图片链接；旧的站内图片地址保留读取兼容。Pages Blob 继续保存文字、配置和管理员凭据。

## 内容即时更新

后台通过管理 API 仅提交当前表单的字段。服务端读取 Blob 中的最新数据，校验并合并字段，写入成功后才返回成功。前台通过 `/api/data` 读取当前内容，接口和浏览器请求均禁用缓存；刷新前台即可看到修改。

存储首次为空时使用默认内容。读取失败、数据损坏或写入失败会明确返回错误，避免以默认数据覆盖已有站点。密码哈希和会话签名密钥独立持久化，与站点内容分离，修改文案、背景或文章不会使登录失效。

## 部署

优先使用 EdgeOne，按你的账号所在站点选择国内版或国际版。国内版与国际版分别创建项目、存储与域名配置，不要把一侧的初始化状态视为另一侧已完成。

| 方案 | 当前代码支持情况 | 说明 |
| --- | --- | --- |
| EdgeOne 国内版 | 使用现有 Node 函数与 Pages Blob | 国内访客优先考虑；选择包含中国大陆的加速区域时，自定义域名须完成备案 |
| EdgeOne 国际版 | 使用现有 Node 函数与 Pages Blob | 顶部部署按钮进入国际站；按账号可用区域配置域名 |
| Cloudflare Workers / Pages | 需要适配函数入口和存储，不能直接导入本仓库获得完整功能 | 不推荐面向国内访客部署，国内访问通常较慢且波动较大；主要面向海外时再考虑 |

### EdgeOne 国内版部署

1. Fork 本仓库，登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)，进入 Pages / Makers 创建项目。
2. 选择 Git 仓库部署，授权并导入你的仓库，选择部署分支；框架选择其他或自定义，项目根目录保持仓库根目录。
3. 填写下面的共用构建配置，部署时保留根目录的 `node-functions/` 与 `edgeone.json`，不要只上传 `dist/` 静态文件。
4. 部署后检查 Blob 可用性，完成初始化和下方验收，再绑定自定义域名。包含中国大陆的加速区域需要已备案域名，具体以控制台提示为准。

### EdgeOne 国际版部署

1. 登录 [EdgeOne 国际站](https://edgeone.ai/)，进入 Pages / Makers，点击仓库顶部 **Deploy to EdgeOne**，或手动导入你 Fork 后的仓库。
2. 选择部署分支与仓库根目录，使用下面的共用构建配置。
3. 构建完成后检查函数与 Blob，访问 `/admin.html` 初始化后台，再配置域名与 HTTPS。加速区域以当前账号控制台可选项为准；不能仅凭“国际版”判断是否覆盖中国大陆节点。

### EdgeOne 共用构建配置

[`edgeone.json`](edgeone.json) 已预置：

```text
框架：其他 / 自定义
项目根目录：仓库根目录
安装命令：npm install
构建命令：npm run build
输出目录：dist
Node.js：22.21.1
```

函数入口为 `node-functions/[[default]].js`。Node.js 版本是项目构建配置，不代表函数运行时版本也能任意指定。优先使用 Git 导入，让平台同时构建静态资源和函数。

无需配置管理员密码或会话密钥环境变量，也无需 MySQL。Pages Blob 由 EdgeOne 运行环境提供部署凭据，使用 `likegirl_ce` Store；认证记录位于 `likegirl_admin_auth`，内容位于 `likegirl_site_data`。首次访问 `/admin.html` 自动进入 `/init.html` 设置密码。不要把生产凭据写入仓库，也不要在升级或重新部署时清空存储。

### Cloudflare 部署说明（不推荐用于国内访问）

Cloudflare 平台可承载同类网站，但本仓库当前是 EdgeOne 适配版，**尚未提供可直接部署的 Cloudflare 后端**。只把 `dist/` 上传到 Cloudflare Pages 会缺少 `/api/*`，后台、留言和数据加载无法正常工作；开启 `nodejs_compat` 也不会自动把 EdgeOne Blob 转换成 Cloudflare 存储。

如需迁移，前端仍可执行 `npm run build` 并发布 `dist/`，后端则需另行完成：

1. 将 API 包装为 Workers 的 `fetch` 入口，或 Pages 的 `functions/` 路由，并启用所需 Node.js 兼容配置。
2. 用 D1、R2 或其他持久化存储替换 `@edgeone/pages-blob`，保留内容、管理员凭据与限流数据的读写约定；不能直接复用 EdgeOne 的运行时存储绑定。
3. 迁移已有数据与旧图片，使用可信客户端 IP，验证 PBKDF2 密码派生、会话、留言限流和保存后读取行为，并检查所用套餐的 CPU/存储限制。
4. API 与静态页面部署到同一站点路径，完成下方全部验收后再切换域名。

本项目不建议以国内访客为主的站点选择 Cloudflare：国内访问通常较慢且受地区、运营商和线路影响。该建议不是本仓库的网络测速结果，部署前应自行实测。

完整说明与官方资料见 [部署指南](EDGEONE.md#部署)。

### 部署后验收

1. 访问 `/api/health`，确认 `ok`、`storage` 为 `true`；完成初始化后 `initialized` 也为 `true`。
2. 从页脚进入“管理后台”，首次设置密码后登录。
3. 保存第三方图床的图片直链，确认前台图片可显示。
4. 新增文章或留言，刷新页面确认数据已持久化。

### 健康监测

监控服务可定期请求 `GET /api/health/ready`，以 HTTP 200 判定站点就绪；存储读取失败、数据损坏、尚未初始化或检查超过 3 秒时返回 503。建议每 60 秒检查一次，监控端超时设置为 10 秒，以容纳云函数冷启动。

`/api/health` 保留原有 `ok`、`storage`、`initialized` 字段，存储可读但尚未初始化时仍返回 200；新增 `checks.data`、`checks.auth`、`timestamp` 和 `durationMs` 字段。超时时不返回分项检查，初始化状态未知时为 `null`。`/api/health/live` 只确认云函数能响应，不读取存储。三个接口均支持 HEAD、禁用缓存且不写入数据，不返回内容、密码或底层错误。检查仅验证读取能力，不保证存储写入或第三方图片可用；耗时是本次函数内检查时间，不包含网络和冷启动时间。

详细存储、API 和排错说明见 [EDGEONE.md](EDGEONE.md)。

## 本地检查

```bash
npm install
npm run check
npm test
npm run build
```

测试使用可注入的内存存储，覆盖登录、热修改、跨实例读取和存储故障。真实 Pages Blob 凭据由 EdgeOne 运行环境注入，线上存储仍需按部署验收步骤检查。

## 目录

```text
index.html                         EdgeOne 版前端入口
app/                              前台页面脚本与后台界面
admin.html                        管理后台入口
init.html                         首次初始化页面
node-functions/[[default]].js      Node 云函数路由与业务操作
node-functions/_lib/               鉴权、存储、数据模型与响应
tests/                            会话、设置保存和持久化回归测试
scripts/build-edgeone.mjs          静态产物构建脚本
edgeone.json                       EdgeOne 项目配置
EDGEONE.md                         详细部署文档
```

仓库仍保留上游 PHP + MySQL 代码，用于保留项目历史、署名和兼容参考。EdgeOne 部署不会执行这些 PHP 文件。

## 安全

- 不要在代码或 Issue 中提交真实密码。
- 管理密码通过初始化页面设置，至少 8 个字符；密码哈希和会话密钥持久化存储。
- 后台“基本设置”中可修改管理密码，修改后所有旧会话失效。
- 上传接口已停用，不再占用 Pages Blob 存储新图片。
- 文章 HTML 使用标签和属性白名单清洗；后台自定义头部、页脚与 CSS 属于管理员可信配置。

## 上游与致谢

- 原项目：[Ki./likegirl-stable](https://gitee.com/kiCode111/likegirl-stable)
- 社区版：[ShiFengShuA/LikeGirl-CE](https://gitee.com/shifengshua/LikeGirl-CE)
- EdgeOne 适配作者与维护者：[番星（fanxing724）](https://github.com/fanxing724)
- EdgeOne 适配仓库：[fanxing724/LikeGirl-edgeone](https://github.com/fanxing724/LikeGirl-edgeone)

番星负责本仓库的静态前端适配、EdgeOne Node.js 云函数、Pages Blob 存储与旧版图片兼容、构建配置，以及后续维护和问题修复。

请保留上游作者署名与源文件中的版权声明。详细来源和权利说明见 [NOTICE](NOTICE)。

## 开源许可

本仓库以 [GNU Affero General Public License v3.0 only](LICENSE) 提供。如果修改后通过网络向用户提供服务，AGPL-3.0 要求向这些用户提供对应版本的源代码。

上游代码、第三方库、字体、图片和其他资源可能有独立声明；对应文件的原声明优先适用。

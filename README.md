# LikeGirl EdgeOne

一个可部署到 EdgeOne Makers/Pages 的轻量情侣纪念小站。项目由 LikeGirl-CE 适配而来，使用静态前端、Node.js 云函数和 EdgeOne Pages Blob，不需要 PHP 服务器或 MySQL。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Deploy to EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=likegirl-edgeone&repository-url=https://github.com/fanxing724/LikeGirl-edgeone&install-command=npm%20install&build-command=npm%20run%20build&output-directory=dist&env=ADMIN_PASSWORD,SESSION_SECRET)

## 功能

- 实时显示情侣相恋天数和时间。
- 记录文章、恋爱相册和共同愿望清单。
- 访客祝福留言，包含同 IP 60 秒频率限制。
- 管理后台可维护站点信息、文章、相册、清单和留言。
- 可上传背景图、相册多图和清单图片。
- 支持 JPG、PNG、WebP 和 GIF，单张最大 4 MB。
- 数据和图片均持久化到 EdgeOne Pages Blob。
- 图片替换或记录删除后，自动清理不再被引用的站内 Blob。
- 后台使用 HMAC 签名会话，用户文本统一转义输出。

## 架构

```text
浏览器
  ├─ 静态页面 ────────────→ EdgeOne Pages CDN
  ├─ 站点数据/留言/后台 ──→ Node.js Cloud Function
  └─ 图片上传与读取 ─────→ EdgeOne Pages Blob
```

| 部分 | 实现 |
| --- | --- |
| 前端 | 原生 HTML/CSS/JavaScript |
| API | EdgeOne Node Functions，Node.js 22 |
| 存储 | `@edgeone/pages-blob`，强一致读取 |
| 路由 | `node-functions/[[default]].js` catch-all |
| 构建 | Node.js 脚本生成 `dist/` 静态产物 |

## 部署

点击项目顶部的 **Deploy to EdgeOne** 按钮，或在 EdgeOne Makers 中导入本仓库。[`edgeone.json`](edgeone.json) 已预置：

```text
安装命令：npm install
构建命令：npm run build
输出目录：dist
Node.js：22.21.1
```

部署前必须配置：

| 环境变量 | 说明 |
| --- | --- |
| `ADMIN_PASSWORD` | 管理后台强密码 |
| `SESSION_SECRET` | 至少 32 字符的会话签名密钥 |

```bash
openssl rand -hex 32
```

### 部署后验收

1. 访问 `/api/health`，应返回 `{"ok":true,"storage":true}`。
2. 从页脚进入“管理后台”。
3. 上传一张测试图片，确认 `/api/media/image_...` 地址可访问。
4. 新增文章或留言，刷新页面确认数据已持久化。

详细存储、API 和排错说明见 [EDGEONE.md](EDGEONE.md)。

## 本地检查

```bash
npm install
npm run check
npm run build
```

Pages Blob 凭据由 EdgeOne 运行环境注入，因此完整存储测试需在部署后进行。

## 目录

```text
index.html                         EdgeOne 版前端入口
edgeone-app.js                     页面与后台逻辑
edgeone-app.css                    页面样式
node-functions/[[default]].js      Node 云函数 API
scripts/build-edgeone.mjs          静态产物构建脚本
edgeone.json                       EdgeOne 项目配置
EDGEONE.md                         详细部署文档
```

仓库仍保留上游 PHP + MySQL 代码，用于保留项目历史、署名和兼容参考。EdgeOne 部署不会执行这些 PHP 文件。

## 安全

- 不要在代码、`.env.example` 或 Issue 中提交真实密码。
- `SESSION_SECRET` 不足 32 字符时，后台会拒绝登录。
- 上传接口校验管理会话、文件大小、MIME 类型和文件签名。
- 项目不渲染后台输入的任意 HTML，以减少存储型 XSS 风险。

## 上游与致谢

- 原项目：[Ki./likegirl-stable](https://gitee.com/kiCode111/likegirl-stable)
- 社区版：[ShiFengShuA/LikeGirl-CE](https://gitee.com/shifengshua/LikeGirl-CE)
- EdgeOne 适配作者与维护者：[番星（fanxing724）](https://github.com/fanxing724)
- EdgeOne 适配仓库：[fanxing724/LikeGirl-edgeone](https://github.com/fanxing724/LikeGirl-edgeone)

番星负责本仓库的静态前端适配、EdgeOne Node.js 云函数、Pages Blob 存储与图片上传、构建配置，以及后续维护和问题修复。

请保留上游作者署名与源文件中的版权声明。详细来源和权利说明见 [NOTICE](NOTICE)。

## 开源许可

本仓库以 [GNU Affero General Public License v3.0 only](LICENSE) 提供。如果修改后通过网络向用户提供服务，AGPL-3.0 要求向这些用户提供对应版本的源代码。

上游代码、第三方库、字体、图片和其他资源可能有独立声明；对应文件的原声明优先适用。

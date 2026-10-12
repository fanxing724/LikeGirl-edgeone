# LikeGirl CE 的 EdgeOne Makers 版本

本仓库保留了原 PHP + MySQL 实现，并新增了可直接部署到 EdgeOne Makers/Pages 的版本：

- `index.html` + `edgeone-app.js` + `edgeone-app.css`：静态单页前端。
- `node-functions/[[default]].js`：EdgeOne Node.js 20 云函数 API。
- `@edgeone/pages-blob`：强一致存储站点设置、文章、相册、清单、留言和上传的图片。
- `edgeone.json`：构建、SPA 回退、缓存头与函数超时配置。

## 部署

1. 将仓库推送到 GitHub/Gitee，在 EdgeOne Makers 中导入。
2. 平台会按 `edgeone.json` 执行 `npm install` 和 `npm run build`，静态产物位于 `dist`。
3. 在项目环境变量中配置：
   - `ADMIN_PASSWORD`：管理后台密码。
   - `SESSION_SECRET`：不少于 32 字符的随机字符串。
4. 重新部署，先访问 `/api/health`，期望返回 `{"ok":true,"storage":true}`。
5. 访问站点后，点击页脚的“管理后台”进行配置。
6. 在后台上传一张测试图片，确认返回的 `/api/media/image_...` 地址可正常访问。

可以用以下命令生成会话密钥：

```bash
openssl rand -hex 32
```

## 数据与兼容说明

- 首次请求会使用内置默认数据；第一次后台保存或访客留言后，结构化数据写入名为 `likegirl_ce` 的 Blob Store。
- 后台可直接上传背景图、相册多图和清单图片。支持 JPG/PNG/WebP/GIF，单张上限 4 MB。
- 图片与 JSON 数据使用同一 Blob Store；图片由 `/api/media/*` 流式输出，不依赖 PHP 上传目录或本地磁盘。
- 当后台删除相册记录、替换背景或清单图片时，不再被数据引用的站内 Blob 图片会自动删除。外部 URL 不会被处理。
- EdgeOne 版本不读取 `admin/Config_DB.php`，也不需要 MySQL。
- 原有 PHP 文件和 SQL 保持不变，仍可用于传统 Nginx/Apache + PHP 部署。
- 当前 EdgeOne 版本不执行原项目允许的任意 HTML 文章和自定义 HTML/CSS，文本统一转义，以避免存储型 XSS。

## API

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| `/api/health` | GET | Blob 存储健康检查 |
| `/api/data` | GET | 读取公开站点数据 |
| `/api/media/:key` | GET | 读取 Blob 中的图片 |
| `/api/messages` | POST | 提交留言，同 IP 60 秒限制 |
| `/api/login` | POST | 获取 8 小时管理会话 |
| `/api/admin/data` | GET/PUT | 需 Bearer 会话，读取/更新完整管理数据 |
| `/api/admin/upload` | POST | 需 Bearer 会话，上传图片到 Blob |

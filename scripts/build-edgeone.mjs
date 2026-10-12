/**
 * LikeGirl CE EdgeOne 静态产物构建
 * 把前台多页、app 脚本、Style/Botui 资源与后台主题资源输出到 dist/。
 */
import { cp, mkdir, rm, copyFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = dirname(fileURLToPath(import.meta.url))
const out = join(root, "..", "dist")
const src = (rel) => join(root, "..", rel)

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// 前台页面
const pages = ["index.html", "little.html", "page.html", "leaving.html", "loveImg.html", "list.html", "about.html", "admin.html"]
for (const p of pages) await copyFile(src(p), join(out, p))

// app 脚本
await cp(src("app"), join(out, "app"), { recursive: true })

// 静态资源
await copyFile(src("favicon.ico"), join(out, "favicon.ico"))
await cp(src("Style"), join(out, "Style"), { recursive: true })
await cp(src("Botui"), join(out, "Botui"), { recursive: true })

// 后台主题资源（仅保留实际使用的文件，保持产物精简）
const assetDirs = ["admin/assets/css", "admin/assets/fonts"]
for (const d of assetDirs) await cp(src(d), join(out, d), { recursive: true })
await mkdir(join(out, "admin/assets/images"), { recursive: true })
await mkdir(join(out, "admin/assets/js"), { recursive: true })
await copyFile(src("admin/assets/images/help-icon.svg"), join(out, "admin/assets/images/help-icon.svg"))
await copyFile(src("admin/assets/js/app.min.js"), join(out, "admin/assets/js/app.min.js"))

console.log("LikeGirl CE EdgeOne 静态产物已生成到 dist/")
console.log("  前台页面:", pages.join(", "))
console.log("  资源目录: app/, Style/, Botui/, admin/assets/")

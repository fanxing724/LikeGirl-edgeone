/**
 * 把一份结构化 JSON（结构同 node-functions 的 defaults）导入到线上 EdgeOne 部署。
 * 用法：BASE=https://域名 TOKEN=<后台token> node scripts/import-json.mjs data.json
 * 对 /api/admin/data 发起带 Bearer 会话的 PUT，服务端做权威校验后整体保存。
 */
import { readFile } from "node:fs/promises"

const base = (process.env.BASE || "").replace(/\/$/, "")
const token = process.env.TOKEN || ""
const file = process.argv[2]

if (!base || !token || !file) {
  console.error("用法: BASE=https://域名 TOKEN=<后台token> node scripts/import-json.mjs data.json")
  process.exit(1)
}

const raw = await readFile(file, "utf8")
const data = JSON.parse(raw)

const res = await fetch(base + "/api/admin/data", {
  method: "PUT",
  headers: { "content-type": "application/json", authorization: "Bearer " + token },
  body: JSON.stringify(data),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error("导入失败:", res.status, body.error || JSON.stringify(body))
  process.exit(1)
}
console.log("导入成功。sections:", Object.keys(body).join(", "))

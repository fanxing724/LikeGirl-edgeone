/**
 * LikeGirl CE — EdgeOne Pages Node Cloud Function (catch-all API)
 *
 * 忠实迁移自原 PHP + MySQL 实现，存储改为 @edgeone/pages-blob 强一致 JSON + 图片 Blob。
 * 对外仅暴露一个 [[default]].js 入口；内部按职责分区，便于审计。
 */

import { json } from "./_lib/http.js"
import { store, readData, writeData, readAuth, writeAuth, initializeAuth, StorageError } from "./_lib/repository.js"
import { cleanText, newId, sanitizeData, publicData } from "./_lib/schema.js"
import { sign, verify, inspectSession, hash, passwordMatches, createAuthRecord, validPassword, SESSION_TTL } from "./_lib/auth.js"

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */
const decoder = new TextDecoder()
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB（Node Functions 请求体约 6 MB）
const RATE_WINDOW = 60 * 1000 // 同 IP 60 秒留言限制
const RATE_KEY_PREFIX = "likegirl_rate_"

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */
/** 把站内图片 Blob key 解析出来（仅 /api/media/image_xxx.ext 形式）。 */
function imageKeyFromUrl(value) {
  const match = String(value || "").match(/^\/api\/media\/(image_[a-f0-9-]+\.(?:jpg|png|webp|gif))$/)
  return match?.[1] || ""
}

function referencedImages(data) {
  const urls = [
    data?.site?.background,
    data?.about?.background,
    ...(data?.photos || []).flatMap((x) => x.urls || []),
    ...(data?.wishes || []).map((x) => x.image),
  ]
  return new Set(urls.map(imageKeyFromUrl).filter(Boolean))
}

function validImageSignature(bytes, type) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
  if (type === "image/gif")
    return decoder.decode(bytes.slice(0, 6)) === "GIF87a" || decoder.decode(bytes.slice(0, 6)) === "GIF89a"
  if (type === "image/webp")
    return decoder.decode(bytes.slice(0, 4)) === "RIFF" && decoder.decode(bytes.slice(8, 12)) === "WEBP"
  return false
}

/* ------------------------------------------------------------------ *
 * IP / 限流 / 归属地
 * ------------------------------------------------------------------ */
function clientIp(request, context) {
  // 优先 EdgeOne 平台注入的真实客户端 IP，X-Forwarded-For 仅作降级参考
  return (
    request.headers.get("eo-client-ip") ||
    context?.clientIp ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}
/** 尽力查询 IP 归属地，超时或失败降级为“未知”，不阻塞主流程。 */
async function ipCity(ip) {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return "本地"
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal })
    if (!r.ok) return "未知"
    const j = await r.json()
    return cleanText(j.region || j.city || j.country_name, 60) || "未知"
  } catch {
    return "未知"
  } finally {
    clearTimeout(timer)
  }
}

/** 违禁词/违禁符号命中检测。 */
function blockedHit(text, settings) {
  if (!settings) return null
  const words = String(settings.blockedWords || "")
  if (words) {
    for (const w of words.split(/[\s,，]+/).filter(Boolean)) {
      if (w && text.includes(w)) return { type: "word", value: w }
    }
  }
  const chars = String(settings.blockedCharacters || "")
  if (chars) {
    for (const c of text) {
      if (chars.includes(c)) return { type: "char", value: c }
    }
  }
  return null
}

/* ------------------------------------------------------------------ *
 * 请求体解析
 * ------------------------------------------------------------------ */
async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * 路由分发
 * ------------------------------------------------------------------ */
function sessionError(code) {
  const messages = {
    SESSION_MISSING: "未收到登录凭据，请重新登录",
    SESSION_INVALID: "登录凭据校验失败，请重新登录",
    SESSION_EXPIRED: "登录已过期，请重新登录",
    AUTH_UNAVAILABLE: "登录服务暂时不可用，请稍后重试",
  }
  return json({ error: messages[code], code }, code === "AUTH_UNAVAILABLE" ? 503 : 401)
}

export function createHandler(repository = { store, readData, writeData, readAuth, writeAuth, initializeAuth }) {
  const { store, readData, writeData, readAuth, writeAuth, initializeAuth } = repository
  return async function onRequest(context) {
    const { request } = context
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "")
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 })
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: { allow: "GET, POST, PUT, OPTIONS" } })

    try {
      /* ---- 健康检查 ---- */
      if (path === "health" && request.method === "GET") {
        await readData()
        return json({ ok: true, storage: true, initialized: Boolean(await readAuth()) })
      }

      /* ---- 媒体读取 ---- */
      if (path.startsWith("media/") && request.method === "GET") {
        const imageKey = path.slice(6)
        if (!/^image_[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(imageKey)) return json({ error: "图片不存在" }, 404)
        const value = await store().get(imageKey, { type: "stream", consistency: "strong" })
        if (!value) return json({ error: "图片不存在" }, 404)
        const ext = imageKey.split(".").pop()
        const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext]
        return new Response(value, {
          headers: {
            "content-type": type,
            "cache-control": "public,max-age=31536000,immutable",
            "x-content-type-options": "nosniff",
          },
        })
      }

      /* ---- 公开数据 ---- */
      if (path === "data" && request.method === "GET") {
        const data = await readData()
        return json(publicData(data))
      }

      /* ---- 留言提交 ---- */
      if (path === "messages" && request.method === "POST") {
        const input = await readJson(request)
        const name = cleanText(input?.name, 30)
        const text = cleanText(input?.text, 500)
        const qq = cleanText(input?.qq, 15)
        if (!name) return json({ error: "请填写昵称" }, 400)
        if (!text || text.length < 2) return json({ error: "留言内容至少两个字符" }, 400)
        if (qq && !/^[1-9][0-9]{4,14}$/.test(qq)) return json({ error: "QQ 号格式不正确" }, 400)

        const ip = clientIp(request, context)
        const db = store()

        // 限流（同 IP 60 秒）
        const rateKey = RATE_KEY_PREFIX + (await hash(ip))
        const last = Number((await db.get(rateKey)) || 0)
        if (Date.now() - last < RATE_WINDOW) return json({ error: "留言太快，请稍后再试（60 秒限制）" }, 429)

        const data = await readData()

        // IP 封禁
        const banned = (data.blockedIps || []).some((x) => x.ip && x.ip === ip)
        if (banned) return json({ error: "你的 IP 已被封禁，禁止留言" }, 403)

        // 违禁词/违禁符号
        const hit = blockedHit(text, data.messageSettings)
        if (hit) return json({ error: hit.type === "word" ? "留言包含违禁词，请注意言辞" : "留言包含非法字符" }, 400)
        if (/^[0-9]+$/.test(text)) return json({ error: "留言不能为纯数字" }, 400)

        // 归属地（尽力而为）
        const city = await ipCity(ip)

        data.messages.unshift({
          id: newId(),
          name,
          qq,
          text,
          ip,
          city,
          createdAt: new Date().toISOString(),
        })
        data.messages = data.messages.slice(0, 500)
        await writeData(data)
        await db.set(rateKey, String(Date.now()))
        return json({ ok: true }, 201)
      }

      /* ---- 首次初始化：凭据独立存储，任何读取错误都禁止重新初始化 ---- */
      if (path === "setup/status" && request.method === "GET") {
        await readData()
        return json({ initialized: Boolean(await readAuth()) })
      }
      if (path === "setup" && request.method === "POST") {
        await readData()
        if (await readAuth()) return json({ error: "后台已经初始化，请登录", code: "ALREADY_INITIALIZED" }, 409)
        const input = await readJson(request)
        if (!validPassword(input?.password)) return json({ error: "密码长度须为 8 至 256 个字符" }, 400)
        if (input.password !== input.confirmPassword) return json({ error: "两次输入的密码不一致" }, 400)
        const created = await initializeAuth(await createAuthRecord(input.password))
        if (!created) return json({ error: "后台已经初始化，请登录", code: "ALREADY_INITIALIZED" }, 409)
        return json({ ok: true }, 201)
      }

      /* ---- 后台登录 ---- */
      if (path === "login" && request.method === "POST") {
        const auth = await readAuth()
        if (!auth) return json({ error: "请先初始化后台", code: "NOT_INITIALIZED" }, 409)
        const input = await readJson(request)
        if (!input || !(await passwordMatches(input.password, auth))) return json({ error: "密码错误" }, 403)
        const expiresAt = Date.now() + SESSION_TTL
        const token = await sign({ role: "admin", exp: expiresAt }, auth.secret)
        const check = new Request(request.url, { headers: { authorization: "Bearer " + token } })
        if (!(await verify(check, auth.secret))) return json({ error: "登录会话创建失败，请稍后重试", code: "SESSION_SIGNING_FAILED" }, 503)
        return json({ token, expiresAt }, 200, {
          "set-cookie": `lg_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${url.protocol === "https:" ? "; Secure" : ""}`,
        })
      }

      if (path === "admin/password" && request.method === "POST") {
        const auth = await readAuth()
        if (!auth) return json({ error: "请先初始化后台", code: "NOT_INITIALIZED" }, 409)
        const session = await inspectSession(request, auth.secret)
        if (!session.ok) return sessionError(session.code)
        const input = await readJson(request)
        if (!(await passwordMatches(input?.currentPassword, auth))) return json({ error: "当前密码错误" }, 403)
        if (!validPassword(input?.password) || input.password !== input.confirmPassword) return json({ error: "新密码须为 8 至 256 个字符，且两次输入一致" }, 400)
        await writeAuth(await createAuthRecord(input.password))
        return json({ ok: true }, 200, { "set-cookie": `lg_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}` })
      }

      if (path === "logout" && request.method === "POST") {
        return json({ ok: true }, 200, { "set-cookie": `lg_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}` })
      }

      /* ---- 后台数据（需鉴权） ---- */
      if (path === "admin/data" && (request.method === "GET" || request.method === "PUT")) {
        const auth = await readAuth()
        if (!auth) return json({ error: "请先初始化后台", code: "NOT_INITIALIZED" }, 409)
        const session = await inspectSession(request, auth.secret)
        if (!session.ok) return sessionError(session.code)
        const current = await readData()
        if (request.method === "GET") return json(current)
        const patch = await readJson(request)
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ error: "无效数据" }, 400)
        const before = referencedImages(current)
        const data = sanitizeData(patch, current)
        await writeData(data)
        const after = referencedImages(data)
        for (const key of before) {
          if (!after.has(key)) await store().delete(key).catch((e) => console.warn("[LikeGirl] orphan cleanup failed", key, e))
        }
        return json(data)
      }

      /* ---- 图片上传（需鉴权） ---- */
      if (path === "admin/upload" && request.method === "POST") {
        const auth = await readAuth()
        if (!auth) return json({ error: "请先初始化后台", code: "NOT_INITIALIZED" }, 409)
        const session = await inspectSession(request, auth.secret)
        if (!session.ok) return sessionError(session.code)
        const length = Number(request.headers.get("content-length") || 0)
        if (length > MAX_IMAGE_BYTES + 256000) return json({ error: "图片不能超过 4 MB" }, 413)
        const form = await request.formData()
        const file = form.get("file")
        if (!(file instanceof Blob) || !file.size) return json({ error: "请选择图片" }, 400)
        if (file.size > MAX_IMAGE_BYTES) return json({ error: "图片不能超过 4 MB" }, 413)
        const ext = IMAGE_TYPES[file.type]
        if (!ext) return json({ error: "仅支持 JPG、PNG、WebP 和 GIF" }, 415)
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
        if (!validImageSignature(head, file.type)) return json({ error: "图片文件签名不正确" }, 415)
        const imageKey = `image_${newId()}.${ext}`
        await store().set(imageKey, file, { cacheControl: "public,max-age=31536000,immutable" })
        return json({ url: `/api/media/${imageKey}`, size: file.size, type: file.type }, 201)
      }

      return json({ error: "接口不存在" }, 404)
    } catch (error) {
      console.error("[LikeGirl]", error)
      if (error instanceof StorageError) return json({ error: error.message, code: "STORAGE_UNAVAILABLE" }, 503)
      return json({ error: "服务暂时不可用" }, 500)
    }
  }
}

export const onRequest = createHandler()
export default onRequest

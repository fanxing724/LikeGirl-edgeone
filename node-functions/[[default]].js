/**
 * LikeGirl CE — EdgeOne Pages Node Cloud Function (catch-all API)
 *
 * 忠实迁移自原 PHP + MySQL 实现，存储改为 @edgeone/pages-blob 强一致 JSON + 图片 Blob。
 * 对外仅暴露一个 [[default]].js 入口；内部按职责分区，便于审计。
 */

import { getStore } from "@edgeone/pages-blob"

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */
const DATA_KEY = "likegirl_site_data"
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB（Node Functions 请求体约 6 MB）
const SESSION_TTL = 8 * 3600 * 1000 // 8 小时
const RATE_WINDOW = 60 * 1000 // 同 IP 60 秒留言限制
const RATE_KEY_PREFIX = "likegirl_rate_"
const HEALTH_KEY = "likegirl_health"

/* ------------------------------------------------------------------ *
 * 默认数据（与原版 SQL 默认数据对齐，保证开箱即用的完整原版观感）
 * ------------------------------------------------------------------ */
const defaults = {
  site: {
    title: "Like Girl v5.2.1 CE",
    logo: "情侣小站社区维护版",
    writing: "站点设置请到后台修改",
    boy: "测试男主",
    girl: "测试女主",
    boyQQ: "3593853319",
    girlQQ: "3593853319",
    startTime: "2023-11-21T16:30",
    background: "/Style/img/bgCover.png",
    icp: "",
    copyright: "",
    animation: true,
    blur: true,
    pjax: true,
    card1: "点点滴滴",
    card2: "留言板",
    card3: "关于本站",
    deci1: "有人愿意听你碎碎念念也很浪漫",
    deci2: "在这里写下我们的留言祝福",
    deci3: "与About对话",
    userQQ: "",
    userName: "番星",
    headHtml: "",
    footerHtml: "",
    customCss: "",
  },
  about: {
    title: "About",
    background: "https://ice.frostsky.com/2024/11/06/570374efdc2bb75a8b722c969118afb5.webp",
    info1: "Hi, 欢迎你的来访",
    info2: "愿得一人心 白首不相离",
    info3: "记录日常生活 留住感动",
    btn1: "听我介绍",
    btn2: "结束介绍",
    infox1: "情侣小站Like Girl是 Ki 的原创项目",
    infox2: "在2022年暑假的假期最后几天里发布了1.0版本",
    infox3: "最新版本为 v5.2.0 亦是最终版本 目前已开源到码云",
    infox4: "而您目前所使用的是由 ShiFengShuA 维护的社区版",
    infox5: "除了维护项目外 有时也会更新一些新功能 亦或是二创",
    infox6: "在测试过程中也是常常出现奇奇怪怪的BUG 属实难崩",
    btnx2: "点我继续对话",
    infof1: "注意 反馈BUG请到社区版开源处反馈 不要向官方版反馈",
    infof2: "对话内容请到后台“关于页面”修改“对话3-2文本”",
    infof3: "对话内容请到后台“关于页面”修改“对话3-3文本”",
    infof4: "对话内容请到后台“关于页面”修改“对话3-4文本”",
    btnf3: "本站前端所有页面",
    infod1: "首页 index",
    infod2: "点点滴滴 little",
    infod3: "留言板 leaving",
    infod4: "关于 about",
    infod5: "欢迎您的来访 IP已记录 请尽情浏览本站～",
  },
  messageSettings: {
    displayLimit: 100,
    blockedCharacters: "`~!@#$^&*()=|{}':;',\\[].<>/?~！@#￥……&*（）——|{}【】‘；：”“'。，、？",
    blockedWords: "",
  },
  blockedIps: [],
  accessWarnings: [],
  stories: [
    {
      id: "welcome",
      title: "默认文章语法",
      author: "测试男主",
      date: "2025-09-18",
      content:
        "<quote>引用内容样式</quote>\n\n<hr>\n\n<h1>H1文字大小演示</h1>\n\n<hr>\n\n<h2>H2文字大小演示</h2>\n\n<hr>\n\n<h3>H3文字大小演示</h3>\n\n<hr>\n\n<h4>H4文字大小演示</h4>\n\n<hr>\n\n<h5>H5文字大小演示</h5>\n\n<hr>\n\n<h6>H6文字大小演示</h6>\n\n<hr>\n\n<b>加粗字体</b>\n<s>删除线字体</s>\n<i>斜体</i>\n<code>强调内容</code>\n\n<center>文本居中</center>\n\n<hr>\n<quote>插入图片</quote>\n<img alt=\"\" src=\"https://lovey.kikiw.cn/Style/img/Cover.webp\">\n<hr>\n<quote>插入视频</quote>\n<video src=\"https://classpic.kikiw.cn/video/fengjing.mp4\" controls></video>\n<hr>",
    },
  ],
  photos: [
    { id: "p1", date: "2025-09-18", text: "情侣小站社区维护版上线了！", urls: ["/Style/img/Love-album/1758202273000.png"] },
    { id: "p2", date: "2025-09-18", text: "测试2张图片时卡片样式", urls: ["/Style/img/bgCover.png", "/Style/img/bgCover.png"] },
    { id: "p3", date: "2025-09-18", text: "测试多张照片时卡片样式", urls: Array.from({ length: 12 }, () => "/Style/img/bgCover.png") },
  ],
  wishes: [
    { id: "w1", text: "一起去电影院看一场电影🎬", image: "", done: false },
    { id: "w2", text: "一起穿情侣装逛街🧡", image: "", done: false },
    { id: "w3", text: "一起去一趟迪士尼游乐园🍉", image: "", done: false },
    { id: "w4", text: "一起过生日🍑", image: "", done: false },
    { id: "w5", text: "一起看日出看日落🍕", image: "", done: false },
    { id: "w6", text: "一起看雪，堆雪人🍥", image: "", done: false },
    { id: "w7", text: "一起露营，住一次帐篷🍘", image: "", done: false },
    { id: "w8", text: "一起去挑选一束花🧁", image: "", done: false },
    { id: "w9", text: "一起庆祝恋爱纪念日🧈", image: "", done: false },
    { id: "w10", text: "情侣小站社区维护版上线了！", image: "http://sfsa.mrgzs.top/repository/LikeGirl-CE/img/1758202273000.png", done: true },
  ],
  messages: [],
}

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */
function env(context, name) {
  const v = context?.env?.[name] ?? globalThis?.[name]
  return typeof v === "string" ? v.trim() : ""
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  })
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  })
}

function store() {
  return getStore({ name: "likegirl_ce", consistency: "strong" })
}

/** 深度合并：以 defaults 为骨架，把已存储数据叠上去，保证结构完整（旧简化数据迁移）。 */
function deepMerge(base, override) {
  if (override === null || override === undefined) return structuredClone(base)
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map((x) => x) : structuredClone(base)
  }
  if (typeof base === "object") {
    const out = {}
    for (const k of Object.keys(base)) out[k] = deepMerge(base[k], override?.[k])
    // 保留存储里多出来的合法键（兼容历史数据）
    if (override && typeof override === "object") {
      for (const k of Object.keys(override)) if (!(k in out)) out[k] = override[k]
    }
    return out
  }
  return override === undefined ? structuredClone(base) : override
}

async function readData() {
  try {
    const value = await store().get(DATA_KEY, { type: "json" })
    if (value && typeof value === "object") return deepMerge(defaults, value)
    return structuredClone(defaults)
  } catch {
    return structuredClone(defaults)
  }
}

async function writeData(data) {
  await store().setJSON(DATA_KEY, data)
  return data
}

function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max)
}

function toBool(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true
  return false
}

function newId() {
  return crypto.randomUUID()
}

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
 * 数据校验 / 清洗（服务端权威校验类型、长度、数量）
 * ------------------------------------------------------------------ */
function sanitizeSite(input, base) {
  const s = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const b = base || defaults.site
  const num = (v, lo, hi, def) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= lo && n <= hi ? Math.trunc(n) : def
  }
  return {
    title: cleanText(s.title ?? b.title, 80),
    logo: cleanText(s.logo ?? b.logo, 40),
    writing: cleanText(s.writing ?? b.writing, 160),
    boy: cleanText(s.boy ?? b.boy, 30),
    girl: cleanText(s.girl ?? b.girl, 30),
    boyQQ: cleanText(s.boyQQ ?? b.boyQQ, 15),
    girlQQ: cleanText(s.girlQQ ?? b.girlQQ, 15),
    startTime: cleanText(s.startTime ?? b.startTime, 40),
    background: cleanText(s.background ?? b.background, 1000),
    icp: cleanText(s.icp ?? b.icp, 60),
    copyright: cleanText(s.copyright ?? b.copyright, 160),
    animation: toBool(s.animation ?? b.animation),
    blur: toBool(s.blur ?? b.blur),
    pjax: toBool(s.pjax ?? b.pjax),
    card1: cleanText(s.card1 ?? b.card1, 100),
    card2: cleanText(s.card2 ?? b.card2, 100),
    card3: cleanText(s.card3 ?? b.card3, 100),
    deci1: cleanText(s.deci1 ?? b.deci1, 100),
    deci2: cleanText(s.deci2 ?? b.deci2, 100),
    deci3: cleanText(s.deci3 ?? b.deci3, 100),
    userQQ: cleanText(s.userQQ ?? b.userQQ, 15),
    userName: cleanText(s.userName ?? b.userName, 30),
    headHtml: cleanText(s.headHtml ?? b.headHtml, 20000),
    footerHtml: cleanText(s.footerHtml ?? b.footerHtml, 20000),
    customCss: cleanText(s.customCss ?? b.customCss, 20000),
  }
}

function sanitizeAbout(input, base) {
  const a = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const b = base || defaults.about
  const f = (k, max) => cleanText(a[k] ?? b[k], max)
  return {
    title: f("title", 30),
    background: f("background", 1000),
    info1: f("info1", 50),
    info2: f("info2", 50),
    info3: f("info3", 50),
    btn1: f("btn1", 30),
    btn2: f("btn2", 30),
    infox1: f("infox1", 60),
    infox2: f("infox2", 60),
    infox3: f("infox3", 60),
    infox4: f("infox4", 60),
    infox5: f("infox5", 60),
    infox6: f("infox6", 60),
    btnx2: f("btnx2", 30),
    infof1: f("infof1", 60),
    infof2: f("infof2", 60),
    infof3: f("infof3", 60),
    infof4: f("infof4", 60),
    btnf3: f("btnf3", 30),
    infod1: f("infod1", 60),
    infod2: f("infod2", 60),
    infod3: f("infod3", 60),
    infod4: f("infod4", 60),
    infod5: f("infod5", 60),
  }
}

function sanitizeMessageSettings(input, base) {
  const m = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const b = base || defaults.messageSettings
  const lim = Number(m.displayLimit ?? b.displayLimit)
  return {
    displayLimit: Number.isFinite(lim) && lim >= 1 && lim <= 500 ? Math.trunc(lim) : Number(b.displayLimit),
    blockedCharacters: cleanText(m.blockedCharacters ?? b.blockedCharacters, 500),
    blockedWords: cleanText(m.blockedWords ?? b.blockedWords, 500),
  }
}

function sanitizeStories(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 500).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      title: cleanText(o.title, 160),
      author: cleanText(o.author, 60),
      date: cleanText(o.date, 30),
      content: cleanText(o.content, 20000),
    }
  })
}

function sanitizePhotos(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 500).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      date: cleanText(o.date, 30),
      text: cleanText(o.text, 300),
      urls: Array.isArray(o.urls)
        ? o.urls.slice(0, 30).map((u) => cleanText(u, 1200)).filter(Boolean)
        : typeof o.imgUrl === "string"
          ? o.imgUrl.split(";").map((u) => cleanText(u, 1200)).filter(Boolean)
          : [],
    }
  })
}

function sanitizeWishes(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 1000).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      text: cleanText(o.text ?? o.eventname, 500),
      image: cleanText(o.image ?? o.imgurl, 1200),
      done: toBool(o.done ?? o.icon),
    }
  })
}

function sanitizeMessages(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 500).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      name: cleanText(o.name, 30),
      qq: cleanText(o.qq, 15),
      text: cleanText(o.text, 500),
      ip: cleanText(o.ip, 60),
      city: cleanText(o.city, 60),
      createdAt: cleanText(o.createdAt ?? o.time, 40),
    }
  })
}

function sanitizeBlockedIps(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 5000).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      ip: cleanText(o.ip ?? o.State, 60),
      note: cleanText(o.note ?? o.text, 200),
      location: cleanText(o.location ?? o.ipAdd, 100),
      createdAt: cleanText(o.createdAt ?? o.Time, 40),
    }
  })
}

function sanitizeAccessWarnings(input, base) {
  if (!Array.isArray(input)) return base || []
  return input.slice(0, 5000).map((x) => {
    const o = x && typeof x === "object" ? x : {}
    return {
      id: cleanText(o.id, 80) || newId(),
      ip: cleanText(o.ip, 60),
      location: cleanText(o.location ?? o.gsd, 100),
      path: cleanText(o.path ?? o.file, 200),
      createdAt: cleanText(o.createdAt ?? o.time, 40),
    }
  })
}

/** 对整份 patch 做权威校验，未提供的 section 保留 current。 */
function sanitizeData(patch, current) {
  const data = structuredClone(current)
  if (patch.site) data.site = sanitizeSite(patch.site, current.site)
  if (patch.about) data.about = sanitizeAbout(patch.about, current.about)
  if (patch.messageSettings) data.messageSettings = sanitizeMessageSettings(patch.messageSettings, current.messageSettings)
  if (Array.isArray(patch.stories)) data.stories = sanitizeStories(patch.stories, current.stories)
  if (Array.isArray(patch.photos)) data.photos = sanitizePhotos(patch.photos, current.photos)
  if (Array.isArray(patch.wishes)) data.wishes = sanitizeWishes(patch.wishes, current.wishes)
  if (Array.isArray(patch.messages)) data.messages = sanitizeMessages(patch.messages, current.messages)
  if (Array.isArray(patch.blockedIps)) data.blockedIps = sanitizeBlockedIps(patch.blockedIps, current.blockedIps)
  if (Array.isArray(patch.accessWarnings)) data.accessWarnings = sanitizeAccessWarnings(patch.accessWarnings, current.accessWarnings)
  return data
}

/* ------------------------------------------------------------------ *
 * 公开数据脱敏（不返回 QQ / IP / 封禁列表 / 访问记录 / 违禁词）
 * ------------------------------------------------------------------ */
function publicData(data) {
  const limit = data.messageSettings?.displayLimit || 100
  const list = (data.messages || []).slice(0, limit).map(({ qq, ip, ...rest }) => ({
    ...rest,
    avatar: qq ? `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(qq)}&s=100` : "",
  }))
  return {
    site: data.site,
    about: data.about,
    messageSettings: { displayLimit: limit },
    stories: data.stories,
    photos: data.photos,
    wishes: data.wishes,
    messages: list,
  }
}

/* ------------------------------------------------------------------ *
 * 鉴权（HMAC 签名 Bearer Token）
 * ------------------------------------------------------------------ */
function b64(bytes) {
  let s = ""
  for (const n of bytes) s += String.fromCharCode(n)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
function unb64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  s += "=".repeat((4 - (s.length % 4)) % 4)
  const raw = atob(s)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
async function hmacKey(secret, uses) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, uses)
}
async function sign(payload, secret) {
  const body = b64(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), encoder.encode(body))
  return `${body}.${b64(new Uint8Array(sig))}`
}
async function verify(request, secret) {
  if (secret.length < 32) return false
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  const [body, sig] = token.split(".")
  if (!body || !sig) return false
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), unb64(sig), encoder.encode(body))
    if (!ok) return false
    const value = JSON.parse(decoder.decode(unb64(body)))
    return value.role === "admin" && value.exp > Date.now()
  } catch {
    return false
  }
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
async function hash(value) {
  const out = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(out)].map((x) => x.toString(16).padStart(2, "0")).join("")
}
async function passwordMatches(input, expected) {
  const [a, b] = await Promise.all([hash(input), hash(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
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
export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "")
  if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 })
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: { allow: "GET, POST, PUT, OPTIONS" } })

  try {
    /* ---- 健康检查 ---- */
    if (path === "health" && request.method === "GET") {
      await store().get(HEALTH_KEY)
      return json({ ok: true, storage: true })
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

    /* ---- 后台登录 ---- */
    if (path === "login" && request.method === "POST") {
      const password = env(context, "ADMIN_PASSWORD")
      const secret = env(context, "SESSION_SECRET")
      if (!password || secret.length < 32) return json({ error: "后台未完成安全配置（ADMIN_PASSWORD / SESSION_SECRET）" }, 503)
      const input = await readJson(request)
      if (!input || !(await passwordMatches(cleanText(input.password, 256), password)))
        return json({ error: "密码错误" }, 403)
      return json({ token: await sign({ role: "admin", exp: Date.now() + SESSION_TTL }, secret) })
    }

    /* ---- 后台数据（需鉴权） ---- */
    if (path === "admin/data" && (request.method === "GET" || request.method === "PUT")) {
      const secret = env(context, "SESSION_SECRET")
      if (!(await verify(request, secret))) return json({ error: "会话无效或已过期，请重新登录" }, 401)
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
      const secret = env(context, "SESSION_SECRET")
      if (!(await verify(request, secret))) return json({ error: "会话无效或已过期" }, 401)
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
    return json({ error: "服务暂时不可用" }, 500)
  }
}

export default onRequest

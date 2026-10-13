import { defaults } from "./defaults.js"

export function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max)
}

function toBool(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true
  return false
}

export function newId() {
  return crypto.randomUUID()
}

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
export function sanitizeData(patch, current) {
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
export function publicData(data) {
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


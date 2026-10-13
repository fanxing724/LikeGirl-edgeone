import { createHmac, timingSafeEqual } from "node:crypto"
import { Buffer } from "node:buffer"

const encoder = new TextEncoder()
export const SESSION_TTL = 8 * 3600 * 1000

// Node cloud functions: avoid platform-provided Web Crypto/base64 globals.
// Keep the existing wire format and stored signing key for deployed sessions.
export async function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

export async function inspectSession(request, secret) {
  if (typeof secret !== "string" || secret.length < 32) return { ok: false, code: "AUTH_UNAVAILABLE" }
  const authorization = request.headers.get("authorization") || ""
  const cookie = (request.headers.get("cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith("lg_session="))
  // EdgeOne can reserve/replace Authorization for its own gateway authentication.
  // Our dedicated header and cookie must take precedence over that platform header.
  const token = request.headers.get("x-lg-session") || (cookie || "").slice("lg_session=".length) ||
    (authorization ? authorization.replace(/^Bearer\s+/i, "") : "")
  if (!token) return { ok: false, code: "SESSION_MISSING" }
  if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return { ok: false, code: "SESSION_INVALID" }
  try {
    const [body, signature] = token.split(".")
    const actual = Buffer.from(signature, "base64url")
    const expected = createHmac("sha256", secret).update(body).digest()
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, code: "SESSION_INVALID" }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    if (payload?.role !== "admin" || !Number.isFinite(payload.exp)) return { ok: false, code: "SESSION_INVALID" }
    if (payload.exp <= Date.now()) return { ok: false, code: "SESSION_EXPIRED" }
    return { ok: true }
  } catch {
    return { ok: false, code: "SESSION_INVALID" }
  }
}

export async function verify(request, secret) {
  return (await inspectSession(request, secret)).ok
}

export async function hash(value) {
  const out = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(out)].map((x) => x.toString(16).padStart(2, "0")).join("")
}
const PASSWORD_ITERATIONS = 210000

async function derivePassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256)
  return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

function randomHex(length) {
  return [...crypto.getRandomValues(new Uint8Array(length))].map((value) => value.toString(16).padStart(2, "0")).join("")
}

export function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 256
}

export function isAuthRecord(value) {
  return value && value.version === 1 && value.iterations === PASSWORD_ITERATIONS &&
    /^[a-f0-9]{32}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.passwordHash) && /^[a-f0-9]{64}$/.test(value.secret)
}

export async function createAuthRecord(password) {
  const salt = randomHex(16)
  return { version: 1, iterations: PASSWORD_ITERATIONS, salt,
    passwordHash: await derivePassword(password, salt), secret: randomHex(32),
    updatedAt: new Date().toISOString() }
}

export async function passwordMatches(input, record) {
  if (typeof input !== "string" || input.length > 256 || !isAuthRecord(record)) return false
  const actual = await derivePassword(input, record.salt)
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ record.passwordHash.charCodeAt(i)
  return diff === 0
}

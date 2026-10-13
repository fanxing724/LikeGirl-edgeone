const encoder = new TextEncoder()
const decoder = new TextDecoder()
export const SESSION_TTL = 8 * 3600 * 1000

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
export async function sign(payload, secret) {
  const body = b64(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), encoder.encode(body))
  return `${body}.${b64(new Uint8Array(sig))}`
}
export async function verify(request, secret) {
  if (secret.length < 32) return false
  const authorization = request.headers.get("authorization") || ""
  const cookie = (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith("lg_session="))
  const token = authorization ? authorization.replace(/^Bearer\s+/i, "") : (cookie || "").slice("lg_session=".length)
  const [body, sig] = token.split(".")
  if (!body || !sig) return false
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), unb64(sig), encoder.encode(body))
    if (!ok) return false
    const value = JSON.parse(decoder.decode(unb64(body)))
    return value.role === "admin" && Number.isFinite(value.exp) && value.exp > Date.now()
  } catch {
    return false
  }
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

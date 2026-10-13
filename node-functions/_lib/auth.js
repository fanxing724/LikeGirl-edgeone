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
export async function passwordMatches(input, expected) {
  const [a, b] = await Promise.all([hash(input), hash(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}


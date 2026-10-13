import { getStore } from "@edgeone/pages-blob"
import { isAuthRecord } from "./auth.js"
import { defaults } from "./defaults.js"

const DATA_KEY = "likegirl_site_data"
const AUTH_KEY = "likegirl_admin_auth"

export class StorageError extends Error {
  constructor(cause) {
    super("站点存储暂时不可用，请稍后重试", { cause })
    this.status = 503
  }
}

/** No process-local configuration cache: every request reads shared storage. */
export function createRepository(getBackend = () => getStore({ name: "likegirl_ce", consistency: "strong" })) {
  function store() { return getBackend() }
  async function readData() {
    try {
      const value = await store().get(DATA_KEY, { type: "json" })
      // Defaults are allowed only for a genuinely empty store, never a failed read.
      if (value == null) return structuredClone(defaults)
      if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid stored site data")
      for (const key of Object.keys(defaults)) {
        if (!(key in value)) continue
        const section = value[key]
        if (Array.isArray(defaults[key]) ? !Array.isArray(section) : !section || typeof section !== "object" || Array.isArray(section)) {
          throw new Error("Invalid stored section: " + key)
        }
      }
      return deepMerge(defaults, value)
    } catch (cause) { throw new StorageError(cause) }
  }
  async function writeData(data) {
    try { await store().setJSON(DATA_KEY, data) }
    catch (cause) { throw new StorageError(cause) }
    return data
  }
  async function readAuth() {
    try {
      const record = await store().get(AUTH_KEY, { type: "json" })
      if (record == null) return null
      if (!isAuthRecord(record)) throw new Error("Invalid stored authentication record")
      return record
    } catch (cause) { throw new StorageError(cause) }
  }
  async function writeAuth(record) {
    try { await store().setJSON(AUTH_KEY, record) }
    catch (cause) { throw new StorageError(cause) }
  }
  let initializing = null
  async function initializeAuth(record) {
    if (initializing) { await initializing; return false }
    initializing = (async () => {
      if (await readAuth()) return false
      // Recheck persisted state before writing, and never touch existing site content.
      await writeAuth(record)
      return true
    })()
    try { return await initializing }
    finally { initializing = null }
  }
  return { store, readData, writeData, readAuth, writeAuth, initializeAuth }
}

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


const repository = createRepository()
export const { store, readData, writeData, readAuth, writeAuth, initializeAuth } = repository

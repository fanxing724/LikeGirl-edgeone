export function env(context, name) {
  const v = context?.env?.[name] ?? globalThis?.[name] ?? (typeof process !== "undefined" ? process.env?.[name] : undefined)
  return typeof v === "string" ? v.trim() : ""
}


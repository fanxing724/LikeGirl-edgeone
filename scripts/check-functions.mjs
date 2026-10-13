import { readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
for (const file of await readdir(new URL("../node-functions/_lib/", import.meta.url))) {
  if (!file.endsWith(".js")) continue
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL("../node-functions/_lib/" + file, import.meta.url))], { stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status || 1)
}

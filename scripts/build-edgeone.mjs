import { cp, mkdir, rm } from "node:fs/promises"

const output = new URL("../dist/", import.meta.url)
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

for (const file of ["index.html", "edgeone-app.js", "edgeone-app.css", "favicon.ico"]) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, output))
}

await cp(new URL("../Style/", import.meta.url), new URL("Style/", output), {
  recursive: true,
})

console.log("LikeGirl CE EdgeOne static bundle generated in dist/")

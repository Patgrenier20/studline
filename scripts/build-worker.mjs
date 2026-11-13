import { readdir, readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

const files = {};
for (const path of await readdir("dist", { recursive: true })) {
  if (!/\.(js|css|html|svg)$/.test(path)) continue;
  files["/" + path] = await readFile("dist/" + path, "utf8");
}
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["server/worker.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/server/index.js",
  define: { STUDLINE_ASSETS: JSON.stringify(files) },
});

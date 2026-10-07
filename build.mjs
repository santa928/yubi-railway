import { build } from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const name of ["index.html", "style.css"])
  await copyFile(`src/${name}`, `dist/${name}`);
await mkdir("dist/audio", { recursive: true });
await copyFile("src/audio/workrail.mp3", "dist/audio/workrail.mp3");
await copyFile("THIRD_PARTY_NOTICES.md", "dist/THIRD_PARTY_NOTICES.md");
await build({
  entryPoints: ["src/main.mjs"],
  bundle: true,
  minify: true,
  target: ["safari16", "chrome110"],
  format: "iife",
  outfile: "dist/app.js",
  legalComments: "eof",
});

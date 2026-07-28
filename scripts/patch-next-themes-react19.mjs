import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const NEXT_THEMES_VERSION = "0.4.6";
const packageDirectory = path.join(process.cwd(), "node_modules", "next-themes");
const packageJsonPath = path.join(packageDirectory, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

if (packageJson.version !== NEXT_THEMES_VERSION) {
  throw new Error(
    `next-themes ${packageJson.version} is not covered by the React 19 compatibility patch; expected ${NEXT_THEMES_VERSION}.`,
  );
}

const originalMarker = "=>{let p=JSON.stringify([";
const patchedMarker = '=>{if(typeof window!="undefined")return null;let p=JSON.stringify([';

for (const fileName of ["index.js", "index.mjs"]) {
  const filePath = path.join(packageDirectory, "dist", fileName);
  const source = await readFile(filePath, "utf8");

  if (source.includes(patchedMarker)) continue;
  if (source.split(originalMarker).length !== 2) {
    throw new Error(`Unable to locate the next-themes ThemeScript marker in ${fileName}.`);
  }

  await writeFile(filePath, source.replace(originalMarker, patchedMarker), "utf8");
}

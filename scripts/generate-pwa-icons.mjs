import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const iconDirectory = path.join(process.cwd(), "public", "icons");
const source = path.join(iconDirectory, "stayboard-icon.svg");

await mkdir(iconDirectory, { recursive: true });

await Promise.all([
  sharp(source).resize(192, 192).png().toFile(path.join(iconDirectory, "icon-192.png")),
  sharp(source).resize(512, 512).png().toFile(path.join(iconDirectory, "icon-512.png")),
  sharp(source).resize(512, 512).png().toFile(path.join(iconDirectory, "maskable-512.png")),
  sharp(source).resize(180, 180).png().toFile(path.join(iconDirectory, "apple-touch-icon.png")),
]);

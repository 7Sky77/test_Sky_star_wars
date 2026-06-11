/**
 * Гибридные спрайты планет: AI-база (tools/planet-sprites/bases/{type}.png)
 * + 10 процедурных вариантов (оттенок, насыщенность, лёгкий поворот).
 *
 * Выход: apps/web/public/assets/planets/{type}/{0-9}.png  (80 файлов)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASES_DIR = path.join(ROOT, "tools", "planet-sprites", "bases");
const OUT_DIR = path.join(ROOT, "apps", "web", "public", "assets", "planets");

const PLANET_TYPES = [
  "gas",
  "water",
  "sand",
  "industrial",
  "dry",
  "ice",
  "jungle",
  "normal",
];

const SIZE = 128;
const VARIANT_COUNT = 10;

/** Параметры вариаций: поворот текстуры, яркость, насыщенность, лёгкий tint. */
const VARIANTS = [
  { rotate: -14, brightness: 1.0, saturation: 1.0, tint: null },
  { rotate: -10, brightness: 1.05, saturation: 0.92, tint: { r: 255, g: 248, b: 240 } },
  { rotate: -6, brightness: 0.95, saturation: 1.08, tint: { r: 240, g: 248, b: 255 } },
  { rotate: -2, brightness: 1.02, saturation: 1.0, tint: null },
  { rotate: 2, brightness: 0.98, saturation: 1.06, tint: { r: 255, g: 252, b: 245 } },
  { rotate: 6, brightness: 1.06, saturation: 0.9, tint: null },
  { rotate: 10, brightness: 0.94, saturation: 1.04, tint: { r: 245, g: 255, b: 250 } },
  { rotate: 14, brightness: 1.0, saturation: 0.86, tint: null },
  { rotate: -18, brightness: 1.08, saturation: 0.96, tint: { r: 255, g: 245, b: 255 } },
  { rotate: 18, brightness: 0.92, saturation: 1.1, tint: { r: 245, g: 250, b: 255 } },
];

function circleMaskSvg(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`
  );
}

async function prepareBase(inputPath) {
  return sharp(inputPath)
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .png();
}

async function renderVariant(preparedPipeline, variant) {
  let img = preparedPipeline.clone().rotate(variant.rotate, {
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  img = img.modulate({
    brightness: variant.brightness,
    saturation: variant.saturation,
  });

  if (variant.tint) {
    img = img.tint(variant.tint);
  }

  const masked = await img
    .composite([{ input: circleMaskSvg(SIZE), blend: "dest-in" }])
    .png()
    .toBuffer();

  return masked;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  const missing = [];

  for (const type of PLANET_TYPES) {
    const basePath = path.join(BASES_DIR, `${type}.png`);
    try {
      await fs.access(basePath);
    } catch {
      missing.push(type);
      continue;
    }

    const typeDir = path.join(OUT_DIR, type);
    await fs.mkdir(typeDir, { recursive: true });

    const prepared = await prepareBase(basePath);

    for (let i = 0; i < VARIANT_COUNT; i++) {
      const buf = await renderVariant(prepared, VARIANTS[i]);
      await fs.writeFile(path.join(typeDir, `${i}.png`), buf);
      total++;
    }
    console.log(`  ${type}: ${VARIANT_COUNT} variants`);
  }

  if (missing.length) {
    console.error(
      `\nMissing bases (${missing.join(", ")}). Place PNG files in:\n  ${BASES_DIR}\n`
    );
    process.exit(1);
  }

  console.log(`\nDone: ${total} planet sprites → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Resize + compress images in attached_assets.
 * Resizes to max 1200px wide (keeps aspect ratio), then compresses.
 * Run: node scripts/compress-jpegs.mjs
 */
import sharp from "sharp";
import { stat, rename, unlink } from "fs/promises";
import { readdir } from "fs/promises";
import path from "path";

const ASSETS = "/home/runner/workspace/attached_assets";
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
const MIN_SAVINGS = 100_000; // skip if less than 100KB savings

const files = (await readdir(ASSETS)).filter(f =>
  /\.(jpe?g|png)$/i.test(f)
);

async function processFile(file) {
  const src = path.join(ASSETS, file);
  const tmp = src + ".opt.tmp";
  const isPng = /\.png$/i.test(file);

  const before = (await stat(src)).size;
  const meta = await sharp(src).metadata();

  // Only resize if wider than MAX_WIDTH
  const needsResize = (meta.width ?? 0) > MAX_WIDTH;
  let pipeline = sharp(src);
  if (needsResize) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  if (isPng) {
    await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toFile(tmp);
  } else {
    await pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true }).toFile(tmp);
  }

  const after = (await stat(tmp)).size;
  const saved = before - after;

  if (saved >= MIN_SAVINGS) {
    await rename(tmp, src);
    return { file, before, after, saved, resized: needsResize, width: meta.width };
  } else {
    await unlink(tmp);
    return { file, before, after: before, saved: 0, resized: false, width: meta.width };
  }
}

// Batch parallel processing
const BATCH = 4;
let totalBefore = 0, totalAfter = 0;
let compressed = 0, skipped = 0;

for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const results = await Promise.allSettled(batch.map(processFile));
  for (const r of results) {
    if (r.status === "rejected") {
      console.error(`  ERROR: ${r.reason?.message ?? r.reason}`);
      continue;
    }
    const { file, before, after, saved, resized, width } = r.value;
    totalBefore += before;
    totalAfter += after;
    if (saved >= MIN_SAVINGS) {
      compressed++;
      const tag = resized ? ` [resized from ${width}px]` : "";
      console.log(`  ✓ ${file}${tag}: ${(before/1e6).toFixed(2)}MB → ${(after/1e6).toFixed(2)}MB (-${Math.round(saved/before*100)}%)`);
    } else {
      skipped++;
      console.log(`  - ${file}: already optimal (${(before/1e6).toFixed(2)}MB, ${width}px)`);
    }
  }
}

const totalSaved = totalBefore - totalAfter;
console.log(`\nDone: ${compressed} compressed, ${skipped} skipped`);
console.log(`Total: ${(totalBefore/1e6).toFixed(1)}MB → ${(totalAfter/1e6).toFixed(1)}MB  (saved ${(totalSaved/1e6).toFixed(1)}MB, ${Math.round(totalSaved/totalBefore*100)}%)`);

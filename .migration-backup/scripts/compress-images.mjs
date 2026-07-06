/**
 * One-shot image compression script.
 * Compresses all JPEG/PNG images in attached_assets in-place using sharp.
 * Run once: node scripts/compress-images.mjs
 */

import sharp from "sharp";
import { readdir, stat, rename, unlink } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ASSETS_DIR = join(__dirname, "..", "attached_assets");

const JPEG_QUALITY = 75;
const PNG_QUALITY = 80;
const MIN_SAVINGS_BYTES = 50_000; // only replace if we save at least 50KB

async function compressFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const isJpeg = ext === ".jpg" || ext === ".jpeg";
  const isPng = ext === ".png";

  if (!isJpeg && !isPng) return null;

  const before = (await stat(filePath)).size;
  const tmpPath = filePath + ".tmp";

  try {
    const instance = sharp(filePath);

    if (isJpeg) {
      await instance.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(tmpPath);
    } else {
      await instance.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toFile(tmpPath);
    }

    const after = (await stat(tmpPath)).size;
    const saved = before - after;

    if (saved >= MIN_SAVINGS_BYTES) {
      await rename(tmpPath, filePath);
      return { saved, before, after };
    } else {
      await unlink(tmpPath);
      return { saved: 0, before, after: before };
    }
  } catch (err) {
    try { await unlink(tmpPath); } catch {}
    throw err;
  }
}

function fmt(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

const files = await readdir(ASSETS_DIR);
let totalBefore = 0;
let totalAfter = 0;
let processed = 0;
let skipped = 0;

for (const file of files) {
  const filePath = join(ASSETS_DIR, file);
  const ext = extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;

  process.stdout.write(`  ${basename(file)} ... `);
  try {
    const result = await compressFile(filePath);
    if (!result) { process.stdout.write("skipped\n"); skipped++; continue; }

    totalBefore += result.before;
    totalAfter += result.after;

    if (result.saved >= MIN_SAVINGS_BYTES) {
      process.stdout.write(`${fmt(result.before)} → ${fmt(result.after)} (saved ${fmt(result.saved)})\n`);
      processed++;
    } else {
      process.stdout.write(`no significant gain (${fmt(result.before)})\n`);
      skipped++;
    }
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
  }
}

console.log(`\nDone. Compressed ${processed} files, skipped ${skipped}.`);
if (totalBefore > 0) {
  console.log(`Total: ${fmt(totalBefore)} → ${fmt(totalAfter)} (saved ${fmt(totalBefore - totalAfter)}, ${Math.round((1 - totalAfter / totalBefore) * 100)}% reduction)`);
}

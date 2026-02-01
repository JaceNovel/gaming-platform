import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT = "public/images/Capture_d_écran_2026-01-27_001718-removebg-preview.png";

const root = process.cwd();
const inputPath = path.join(root, INPUT);
const publicDir = path.join(root, "public");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function squarePng(size) {
  return sharp(inputPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function write(fileName, buf) {
  const outPath = path.join(publicDir, fileName);
  await fs.writeFile(outPath, buf);
  return outPath;
}

async function main() {
  if (!(await exists(inputPath))) {
    throw new Error(`Input logo not found: ${inputPath}`);
  }

  const outputs = [];

  // Versioned logo used in UI
  const logo512 = await squarePng(512);
  outputs.push(await write("logo-v2.png", logo512));

  // Public SEO logo URL used in JSON-LD
  outputs.push(await write("logo-512.png", logo512));

  // Browser icons
  const favicon16 = await squarePng(16);
  const favicon32 = await squarePng(32);
  const favicon48 = await squarePng(48);

  outputs.push(await write("favicon-16x16.png", favicon16));
  outputs.push(await write("favicon-32x32.png", favicon32));

  // We intentionally do NOT generate favicon.ico here anymore.
  // The previous implementation used the `to-ico` package, which pulled in
  // legacy dependencies with known vulnerabilities. Keep favicon.ico as a
  // committed asset in `public/`.
  const existingIco = path.join(publicDir, "favicon.ico");
  if (!(await exists(existingIco))) {
    // eslint-disable-next-line no-console
    console.warn(
      "favicon.ico is missing; please add a committed favicon.ico (PNG favicons were generated)."
    );
  }

  // Apple touch + Android Chrome
  outputs.push(await write("apple-touch-icon.png", await squarePng(180)));
  outputs.push(await write("android-chrome-192x192.png", await squarePng(192)));
  outputs.push(await write("android-chrome-512x512.png", logo512));

  // Log for CI/debug
  // eslint-disable-next-line no-console
  console.log(`Generated ${outputs.length} brand assets:`);
  for (const out of outputs) {
    // eslint-disable-next-line no-console
    console.log(`- ${path.relative(root, out)}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

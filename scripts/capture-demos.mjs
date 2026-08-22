/**
 * Records a self-playing WebM capture of the playable for the portfolio page.
 * The run drives itself via the ?autoplay hook — no human input, no flaky
 * synthetic swipes — and recording stops on the real end of the run.
 *
 * Requires Playwright: npx playwright install chromium
 *
 * Usage: npm run build:portfolio && npm run capture
 *   MISS_WALL=6 npm run capture   # fumble wall 7 so the take shows the shield shatter
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portfolioDir = path.join(root, 'portfolio');
const playableHtml = path.join(portfolioDir, 'playable.html');
const outPath = path.join(portfolioDir, 'demo.webm');
const mp4Path = path.join(portfolioDir, 'demo.mp4');
const videoDir = path.join(portfolioDir, '.capture-tmp');

const VIEWPORT = { width: 720, height: 1280 };
/** Ceiling only — the capture normally ends on the run-complete flag. */
const MAX_CAPTURE_MS = 45_000;
/** How long the CTA stays on screen after the run resolves. */
const CTA_HOLD_MS = 2_500;
/** Wall index to deliberately miss, showing the shield shatter. -1 plays clean. */
const MISS_WALL = Number(process.env.MISS_WALL ?? -1);

if (!fs.existsSync(playableHtml)) {
  console.error('Missing portfolio/playable.html — run `npm run build:portfolio` first.');
  process.exit(1);
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  fs.mkdirSync(videoDir, { recursive: true });

  const query = MISS_WALL >= 0 ? `?autoplay=1&miss=${MISS_WALL}` : '?autoplay=1';
  console.log(`Recording autoplay run${MISS_WALL >= 0 ? ` (missing wall ${MISS_WALL + 1})` : ''} -> demo.webm`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.goto(`${pathToFileUrl(playableHtml)}${query}`, { waitUntil: 'load' });

  try {
    await page.waitForFunction(() => document.documentElement.dataset.runComplete === '1', null, {
      timeout: MAX_CAPTURE_MS,
    });
    await page.waitForTimeout(CTA_HOLD_MS);
  } catch {
    console.warn(`Run never reached the CTA within ${MAX_CAPTURE_MS / 1000}s — keeping the partial take.`);
  }

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    console.error('No video recorded.');
    process.exit(1);
  }

  fs.rmSync(outPath, { force: true });
  fs.renameSync(await video.path(), outPath);
  fs.rmSync(videoDir, { recursive: true, force: true });

  console.log(`  ${outPath}`);
  toMp4();
  console.log('\nCapture ready. Refresh portfolio/index.html to preview.');
}

/** portfolio/index.html sources demo.mp4, so transcode when ffmpeg is around. */
function toMp4() {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    console.log('  ffmpeg not found — convert manually for portfolio/index.html:');
    console.log(`    ffmpeg -i "${outPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`);
    return;
  }
  execFileSync('ffmpeg', ['-y', '-i', outPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path], {
    stdio: 'ignore',
  });
  console.log(`  ${mp4Path}`);
}

function pathToFileUrl(filePath) {
  const resolved = path.resolve(filePath).replace(/\\/g, '/');
  return `file:///${encodeURI(resolved).replace(/^\/+/, '')}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

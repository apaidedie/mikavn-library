const fs = require('fs');
const path = require('path');

function resolvePlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE;
  if (explicit) return explicit;
  const npxRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  const candidates = [];
  if (fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modulePath = path.join(npxRoot, entry.name, 'node_modules', 'playwright');
      const packageJson = path.join(modulePath, 'package.json');
      if (fs.existsSync(packageJson)) candidates.push({ modulePath, mtimeMs: fs.statSync(packageJson).mtimeMs });
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.modulePath || 'playwright';
}

function parseArgs(argv) {
  const args = { concurrency: 2, maxImages: 3, timeoutMs: 45000 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--items-json') args.itemsJson = argv[++index];
    else if (arg === '--provider') args.provider = argv[++index];
    else if (arg === '--id') args.id = argv[++index];
    else if (arg === '--max-images') args.maxImages = Number(argv[++index]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++index]);
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++index]);
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readItems(args) {
  if (args.itemsJson) {
    const text = args.itemsJson === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args.itemsJson, 'utf8');
    return JSON.parse(text);
  }
  if (args.provider && args.id) return [{ provider: args.provider, id: args.id }];
  throw new Error('Provide --items-json or --provider plus --id.');
}

function candidateUrls(provider, id) {
  if (provider === 'dlsite') {
    const maniax = `https://www.dlsite.com/maniax/work/=/product_id/${id}.html`;
    const pro = `https://www.dlsite.com/pro/work/=/product_id/${id}.html`;
    const aix = `https://www.dlsite.com/aix/work/=/product_id/${id}.html`;
    return id.toUpperCase().startsWith('VJ') ? [pro, maniax, aix] : [maniax, aix, pro];
  }
  if (provider === 'fanza') {
    return [`https://dlsoft.dmm.co.jp/detail/${id}/`];
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function cookieFor(provider) {
  if (provider === 'dlsite') return 'adult_checked=1; locale=ja_JP';
  if (provider === 'fanza') return 'age_check_done=1';
  return '';
}

async function fetchItem(page, item, timeoutMs, maxImages) {
  const provider = String(item.provider || '').toLowerCase();
  const id = String(item.id || '').trim();
  const errors = [];

  for (const url of candidateUrls(provider, id)) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const status = response ? response.status() : 0;
      await page.waitForTimeout(350);
      if (status >= 400) {
        errors.push(`${url} status ${status}`);
        continue;
      }
      const payload = await page.evaluate(({ provider: pageProvider, id: pageId, maxImages: pageMaxImages }) => {
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const normalizeSrc = (img) => {
          const raw = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || '';
          if (!raw) return '';
          return raw.startsWith('//') ? `https:${raw}` : raw;
        };
        const add = (result, seen, image, sourceKind, heading) => {
          const src = normalizeSrc(image);
          if (!src || seen.has(src)) return;
          const idNeedle = pageId.toLowerCase();
          if (!src.toLowerCase().includes(idNeedle)) return;
          seen.add(src);
          result.push({
            src,
            alt: clean(image.getAttribute('alt') || image.getAttribute('title') || heading || '简介图片'),
            heading: clean(heading),
            sourceKind,
          naturalWidth: image.naturalWidth || 0,
          naturalHeight: image.naturalHeight || 0,
          });
        };

        const seen = new Set();
        const inline = [];
        const sample = [];
        const blocks = Array.from(document.querySelectorAll('[itemprop="description"] .work_parts, .work_parts, .work_parts_area, section.summary, .summary, .tx-works-comment, #mu'));
        for (const block of blocks) {
          const heading = clean(block.querySelector('.work_parts_heading, h2, h3, h4, .heading, .ttl')?.textContent || '');
          for (const img of Array.from(block.querySelectorAll('img'))) {
            const src = normalizeSrc(img);
            const lower = src.toLowerCase();
            if (pageProvider === 'dlsite' && lower.includes(`/parts/`) && lower.includes(`/${pageId.toLowerCase()}/`)) {
              add(inline, seen, img, 'description-part', heading);
            } else if (pageProvider === 'fanza') {
              add(inline, seen, img, 'description-part', heading);
            }
          }
        }

        if (inline.length === 0) {
          for (const img of Array.from(document.images)) {
            const src = normalizeSrc(img);
            const lower = src.toLowerCase();
            if (pageProvider === 'dlsite' && lower.includes(`${pageId.toLowerCase()}_img_smp`)) {
              add(sample, seen, img, 'sample', '样品图');
            } else if (pageProvider === 'fanza' && lower.includes(pageId.toLowerCase())) {
              add(sample, seen, img, 'sample', '样品图');
            }
          }
        }

        return {
          title: document.title,
          url: location.href,
          images: [...inline, ...sample].slice(0, pageMaxImages),
        };
      }, { provider, id, maxImages });
      return { provider, id, ok: true, ...payload };
    } catch (error) {
      errors.push(`${url} ${error.message}`);
    }
  }

  return { provider, id, ok: false, error: errors.join(' | ') || 'No candidate URL succeeded.' };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node extract-description-images.cjs --items-json items.json [--max-images 3]');
    return;
  }
  const items = await readItems(args);
  const { chromium } = require(resolvePlaywright());
  const browser = await chromium.launch({ headless: true });
  try {
    let nextIndex = 0;
    const concurrency = Math.max(1, Math.min(Number(args.concurrency) || 1, items.length || 1));
    const worker = async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        const provider = String(item.provider || '').toLowerCase();
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          extraHTTPHeaders: { Cookie: cookieFor(provider) },
          viewport: { width: 1440, height: 1200 },
        });
        const page = await context.newPage();
        try {
          const result = await fetchItem(page, item, args.timeoutMs, args.maxImages);
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } catch (error) {
          process.stdout.write(`${JSON.stringify({ provider, id: item.id, ok: false, error: error.message })}\n`);
        } finally {
          await context.close();
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

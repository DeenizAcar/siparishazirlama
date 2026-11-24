// Uygulama ikonlarını (web + Android) assets/icon-art.svg çiziminden üretir.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BG = '#1f4e79';
const art = readFileSync(new URL('../assets/icon-art.svg', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

// scale: çizimin kapladığı oran, shape: 'square' | 'round' | 'rounded' | 'none' (şeffaf)
function svg({ scale = 1, shape = 'square' }) {
  const off = (1024 - 1024 * scale) / 2;
  let bg = '';
  if (shape === 'square') bg = `<rect width="1024" height="1024" fill="${BG}"/>`;
  if (shape === 'rounded') bg = `<rect width="1024" height="1024" rx="200" fill="${BG}"/>`;
  if (shape === 'round') bg = `<circle cx="512" cy="512" r="512" fill="${BG}"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg}<g transform="translate(${off} ${off}) scale(${scale})">${art}</g></svg>`);
}
const png = (opts, size, out) => sharp(svg(opts)).resize(size, size).png().toFile(fileURLToPath(out));

const web = new URL('../www/img/', import.meta.url);
mkdirSync(web, { recursive: true });
await png({ scale: 0.92, shape: 'rounded' }, 192, new URL('icon-192.png', web));
await png({ scale: 0.92, shape: 'rounded' }, 512, new URL('icon-512.png', web));
await png({ scale: 0.72, shape: 'square' }, 512, new URL('icon-maskable-512.png', web));
mkdirSync(new URL('../site/apk/', import.meta.url), { recursive: true });
await png({ scale: 0.92, shape: 'rounded' }, 192, new URL('../site/apk/icon.png', import.meta.url));

const res = new URL('../android/app/src/main/res/', import.meta.url);
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    const dir = new URL(`mipmap-${d}/`, res);
    mkdirSync(dir, { recursive: true });
    await png({ scale: 0.9, shape: 'rounded' }, Math.round(48 * m), new URL('ic_launcher.png', dir));
    await png({ scale: 0.86, shape: 'round' }, Math.round(48 * m), new URL('ic_launcher_round.png', dir));
    // Uyarlanabilir ikon ön planı: 108dp, içerik ortadaki güvenli alanda
    await png({ scale: 0.62, shape: 'none' }, Math.round(108 * m), new URL('ic_launcher_foreground.png', dir));
  }
  writeFileSync(new URL('values/ic_launcher_background.xml', res),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  // Açılış (splash) görselleri: mavi zemin ortasında ikon
  const splash = { 'drawable': [480, 320], 'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480],
    'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
    'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920] };
  for (const [dir, [w, h]] of Object.entries(splash)) {
    const s = Math.round(Math.min(w, h) * 0.42);
    const logo = await sharp(svg({ scale: 0.9, shape: 'none' })).resize(s, s).png().toBuffer();
    mkdirSync(new URL(dir + '/', res), { recursive: true });
    await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
      .composite([{ input: logo, gravity: 'center' }]).png().toFile(fileURLToPath(new URL(dir + '/splash.png', res)));
  }
  console.log('Android ikonları üretildi');
}
console.log('Web ikonları üretildi');

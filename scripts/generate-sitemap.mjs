import { readFile, writeFile } from 'node:fs/promises';

const SITE = 'https://cbassuarez.github.io/microrimba';

const instruments = JSON.parse(await readFile(new URL('../data/instruments.json', import.meta.url), 'utf8'));
const scales = JSON.parse(await readFile(new URL('../data/scales.json', import.meta.url), 'utf8'));

const urls = [
  '/',
  '/about',
  ...instruments.map((item) => `/instrument/${item.instrumentId}`),
  ...scales.map((scale) => `/scale/${scale.scaleId}`),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((path) => `  <url><loc>${SITE}${path}</loc></url>`)
  .join('\n')}\n</urlset>\n`;

await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml, 'utf8');
console.log(`Wrote ${urls.length} URLs to public/sitemap.xml`);

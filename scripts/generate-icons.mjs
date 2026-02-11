import { access } from 'node:fs/promises';

const required = [
  'public/favicon.svg',
  'public/safari-pinned-tab.svg',
  'public/og.svg',
];

await Promise.all(required.map((file) => access(file)));

console.log('Vector icon assets are present.');
console.log('PNG/ICO generation is intentionally not automated in-repo to avoid binary artifacts in source control.');
console.log('If needed for release packaging, generate favicon-16.png, favicon-32.png, apple-touch-icon.png, favicon.ico, and og.png from public/favicon.svg + public/og.svg in CI.');

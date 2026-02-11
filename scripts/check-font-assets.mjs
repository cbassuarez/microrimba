import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFonts = [
  'public/fonts/bravura/Bravura.woff2',
  'public/fonts/heji/HEJI.woff2',
];

const optionalMetadata = [
  'public/smufl/glyphnames.json',
  'public/smufl/bravura/bravura_metadata.json',
  'public/smufl/heji/heji_metadata.json',
];

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const missingFonts = [];
for (const path of requiredFonts) {
  if (!(await fileExists(path))) {
    missingFonts.push(path);
  }
}

if (missingFonts.length > 0) {
  console.error('❌ Required notation fonts are missing. Add these files before building:');
  for (const path of missingFonts) {
    console.error(`   - ${path}`);
  }
  console.error('Build halted because Bravura and HEJI WOFF2 assets must be shipped in public/fonts/.');
  process.exit(1);
}

const missingMetadata = [];
for (const path of optionalMetadata) {
  if (!(await fileExists(path))) {
    missingMetadata.push(path);
  }
}

if (missingMetadata.length > 0) {
  console.warn('⚠️  SMuFL metadata is missing (build continues for now):');
  for (const path of missingMetadata) {
    console.warn(`   - ${path}`);
  }
  console.warn('Add metadata JSON files under public/smufl/ to enable richer notation mapping later.');
}

console.log('✅ Font asset check passed: required WOFF2 files are present.');

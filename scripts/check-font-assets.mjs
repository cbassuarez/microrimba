import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFonts = [
  'public/fonts/heji/HEJI2.otf',
  'public/fonts/heji/HEJI2Text.otf',
];

const optionalMetadata = [
  'public/smufl/glyphnames.json',
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

const missingRequiredFonts = [];
for (const path of requiredFonts) {
  if (!(await fileExists(path))) {
    missingRequiredFonts.push(path);
  }
}

if (missingRequiredFonts.length > 0) {
  console.error('❌ Required HEJI font assets are missing. Add these files before building:');
  for (const path of missingRequiredFonts) {
    console.error(`   - ${path}`);
  }
  console.error('Build halted because HEJI2.otf and HEJI2Text.otf must be shipped in public/fonts/heji/.');
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

console.log('✅ Font asset check passed: required HEJI OTF files are present.');

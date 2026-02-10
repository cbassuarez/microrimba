import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function ensureCopied(srcRel, dstRel) {
  const src = path.join(root, srcRel);
  const dst = path.join(root, dstRel);

  if (!fs.existsSync(src)) {
    console.error(`[copy-public-assets] missing: ${src}`);
    process.exit(1);
  }

  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  copyDir(src, dst);
  console.log(`[copy-public-assets] copied ${srcRel} -> ${dstRel}`);
}

ensureCopied("audio", path.join("public", "audio"));

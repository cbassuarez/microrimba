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

if (fs.existsSync(path.join(root, "data"))) {
  const dst = path.join("public", "data");
  fs.rmSync(path.join(root, dst), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, dst), { recursive: true });

  const srcData = path.join(root, "data");
  const dstData = path.join(root, dst);

  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, ent.name);
      const b = path.join(to, ent.name);
      if (ent.isDirectory()) walk(a, b);
      else if (ent.isFile() && ent.name.endsWith(".json")) fs.copyFileSync(a, b);
    }
  };

  walk(srcData, dstData);
  console.log(`[copy-public-assets] copied data/**/*.json -> public/data/**`);
}

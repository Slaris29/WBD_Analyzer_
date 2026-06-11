// WBD Analyzer server CSV manifest generator
// 사용법: node scripts/generate-manifest.js
// data 폴더 아래의 .csv/.txt 파일을 자동으로 훑어서 data/manifest.json 생성

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'manifest.json');
const ACCEPT_EXT = new Set(['.csv', '.txt']);

const GROUP_NAMES = {
  season3: '시즌3 리그전',
  league: '리그전',
  scrim: '일반 스크림',
  independent: '독립팀',
  event: '이벤트리그',
  etc: '기타',
  misc: '기타',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ACCEPT_EXT.has(ext) && entry.name !== 'manifest.json') out.push(full);
    }
  }
  return out;
}

function fileToItem(full) {
  const rel = toPosix(path.relative(ROOT, full));
  const st = fs.statSync(full);
  const base = path.basename(full).replace(/\.(csv|txt)$/i, '');
  return {
    name: base,
    path: rel,
    size: st.size,
    updatedAt: st.mtime.toISOString(),
  };
}

function main() {
  ensureDir(DATA_DIR);
  const files = walk(DATA_DIR).sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'ko'));
  const grouped = new Map();

  for (const full of files) {
    const relFromData = toPosix(path.relative(DATA_DIR, full));
    const parts = relFromData.split('/');
    const groupId = parts.length > 1 ? parts[0] : 'misc';
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(fileToItem(full));
  }

  const groups = [...grouped.entries()].map(([id, files]) => ({
    id,
    name: GROUP_NAMES[id] || id,
    default: true,
    files,
  }));

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    groups,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✅ manifest generated: ${groups.length} groups / ${files.length} files -> ${toPosix(path.relative(ROOT, OUT_FILE))}`);
}

main();

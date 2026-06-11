// WBD Analyzer server CSV manifest generator
// 사용법: node scripts/generate-manifest.js
//
// data 폴더 아래의 .csv/.txt 파일을 자동으로 훑어서 data/manifest.json 생성
// 권장 구조:
//   data/league/FW_Season/game.csv     -> 화면 그룹명: FW_Season (분류: 리그전)
//   data/league/Season3/game.csv       -> 화면 그룹명: Season3 (분류: 리그전)
//   data/scrim/KR_JP/game.csv          -> 화면 그룹명: KR_JP (분류: 일반 스크림)
//   data/independent/game.csv          -> 화면 그룹명: 독립팀
//
// 1차 폴더는 고정 분류: league, scrim, independent, event, etc
// 2차 폴더가 있으면 그 2차 폴더명을 분석기 화면의 그룹명으로 사용함.
// default:true = 분석기 첫 실행 시 서버 전체를 자동 로드함. 내부 대시보드에서 활성/비활성을 전환함.

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'manifest.json');
const ACCEPT_EXT = new Set(['.csv', '.txt']);

const CATEGORY_NAMES = {
  league: '리그전',
  scrim: '일반 스크림',
  independent: '독립팀',
  event: '이벤트리그',
  etc: '기타',
};

const CATEGORY_ORDER = ['league', 'scrim', 'independent', 'event', 'etc'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isAcceptedFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return ACCEPT_EXT.has(ext) && fileName !== 'manifest.json';
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && isAcceptedFile(entry.name)) out.push(full);
  }
  return out;
}

function niceNameFromPathPart(part) {
  return String(part || '')
    .replace(/\.(csv|txt)$/i, '')
    .replace(/_/g, ' ')
    .trim();
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

function groupKeyFromFile(full) {
  const relFromData = toPosix(path.relative(DATA_DIR, full));
  const parts = relFromData.split('/');

  // data 바로 아래 파일이면 기타로 처리
  const category = CATEGORY_NAMES[parts[0]] ? parts[0] : 'etc';

  // data/league/FW_Season/game.csv 처럼 2차 폴더가 있으면 그 폴더를 독립 그룹으로 표시
  // data/league/FW_Season/round1/game.csv 처럼 더 깊으면 FW_Season / round1 로 표시
  const hasSubFolder = CATEGORY_NAMES[parts[0]] && parts.length >= 3;
  const subgroupParts = hasSubFolder ? parts.slice(1, -1) : [];
  const subgroup = subgroupParts.join('/');

  if (subgroup) {
    return {
      id: `${category}/${subgroup}`,
      name: subgroupParts.map(niceNameFromPathPart).join(' / '),
      category,
      categoryName: CATEGORY_NAMES[category],
      description: CATEGORY_NAMES[category],
    };
  }

  return {
    id: category,
    name: CATEGORY_NAMES[category],
    category,
    categoryName: CATEGORY_NAMES[category],
    description: '',
  };
}

function sortGroups(a, b) {
  const ac = CATEGORY_ORDER.indexOf(a.category);
  const bc = CATEGORY_ORDER.indexOf(b.category);
  const ao = ac === -1 ? 999 : ac;
  const bo = bc === -1 ? 999 : bc;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, 'ko');
}

function main() {
  ensureDir(DATA_DIR);
  for (const c of CATEGORY_ORDER) ensureDir(path.join(DATA_DIR, c));

  const files = walk(DATA_DIR).sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'ko'));
  const grouped = new Map();

  for (const full of files) {
    const meta = groupKeyFromFile(full);
    if (!grouped.has(meta.id)) grouped.set(meta.id, { ...meta, files: [] });
    grouped.get(meta.id).files.push(fileToItem(full));
  }

  const groups = [...grouped.values()]
    .sort(sortGroups)
    .map(g => ({
      id: g.id,
      name: g.name,
      category: g.category,
      categoryName: g.categoryName,
      description: g.description,
      default: true,
      files: g.files.sort((a, b) => a.path.localeCompare(b.path, 'ko')),
    }));

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    categoryOrder: CATEGORY_ORDER,
    categories: CATEGORY_NAMES,
    groups,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✅ manifest generated: ${groups.length} groups / ${files.length} files -> ${toPosix(path.relative(ROOT, OUT_FILE))}`);
}

main();

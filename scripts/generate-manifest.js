// WBD Analyzer server CSV manifest + bundle generator
// 사용법: node scripts/generate-manifest.js
//
// data 폴더 아래의 .csv/.txt 파일을 자동으로 훑어서 data/manifest.json 생성
// 추가로 data/_bundles/*.json 묶음 파일을 생성합니다.
//
// 폴더 규칙:
// data/league/FW_Season/*.txt                 -> 리그전 / FW Season / 정규시즌
// data/league/FW_Season/Postseason/*.txt      -> 리그전 / FW Season / Postseason
// data/league/Season3/*.csv                   -> 리그전 / Season3 / 정규시즌
// data/scrim/KR_JP/*.csv                      -> 일반 스크림 / KR JP

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'manifest.json');
const BUNDLE_DIR = path.join(DATA_DIR, '_bundles');
const ACCEPT_EXT = new Set(['.csv', '.txt']);

const CATEGORY_NAMES = {
  league: '리그전',
  scrim: '일반 스크림',
  independent: '독립팀',
  event: '이벤트리그',
  etc: '기타',
};
const CATEGORY_ORDER = ['league', 'scrim', 'independent', 'event', 'etc'];

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function toPosix(p) { return p.split(path.sep).join('/'); }
function isAcceptedFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return ACCEPT_EXT.has(ext) && fileName !== 'manifest.json';
}
function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === '_bundles') continue;
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
    .replace(/\s+/g, ' ')
    .trim();
}
function nicePhaseName(parts) {
  const raw = parts.map(niceNameFromPathPart).join(' / ').trim();
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (!raw || key === 'regular' || key === 'regularseason' || key === 'season' || key === 'reg') return '정규시즌';
  if (key === 'postseason' || key === 'playoff' || key === 'playoffs' || key === 'ps') return '포스트시즌';
  return raw;
}
function groupMetaFromFile(full) {
  const relFromData = toPosix(path.relative(DATA_DIR, full));
  const parts = relFromData.split('/');
  const first = parts[0];
  const category = CATEGORY_NAMES[first] ? first : 'etc';
  const categoryName = CATEGORY_NAMES[category];
  const afterCat = CATEGORY_NAMES[first] ? parts.slice(1) : parts;
  const fileName = afterCat[afterCat.length - 1] || path.basename(full);
  const folders = afterCat.slice(0, -1);

  // 1차 하위 폴더는 시즌/대회 그룹으로 고정합니다.
  // 그 아래 폴더는 정규시즌/포스트시즌/라운드 같은 하위 구분으로 사용합니다.
  const seasonPart = folders[0] || '';
  const phaseParts = folders.slice(1);

  let groupId, groupName, seasonId, seasonName, phaseId, phaseName, phasePath, phaseKey;
  if (seasonPart) {
    groupId = `${category}/${seasonPart}`;
    groupName = niceNameFromPathPart(seasonPart);
    seasonId = groupId;
    seasonName = groupName;
    if (phaseParts.length) {
      phasePath = phaseParts.join('/');
      phaseId = `${groupId}/${phasePath}`;
      phaseName = nicePhaseName(phaseParts);
      phaseKey = phaseParts.join('/');
    } else {
      phasePath = '';
      phaseId = `${groupId}/__regular__`;
      phaseName = '정규시즌';
      phaseKey = '__regular__';
    }
  } else {
    groupId = category;
    groupName = categoryName;
    seasonId = '';
    seasonName = '';
    phasePath = '';
    phaseId = '';
    phaseName = '';
    phaseKey = '';
  }
  return { category, categoryName, groupId, groupName, seasonId, seasonName, phaseId, phaseName, phasePath, phaseKey, fileName };
}
function fileToItem(full) {
  const rel = toPosix(path.relative(ROOT, full));
  const st = fs.statSync(full);
  const base = path.basename(full).replace(/\.(csv|txt)$/i, '');
  const meta = groupMetaFromFile(full);
  return {
    name: base,
    fileName: meta.fileName,
    path: rel,
    size: st.size,
    updatedAt: st.mtime.toISOString(),
    category: meta.category,
    categoryName: meta.categoryName,
    groupId: meta.groupId,
    groupName: meta.groupName,
    seasonId: meta.seasonId,
    seasonName: meta.seasonName,
    phaseId: meta.phaseId,
    phaseName: meta.phaseName,
    phasePath: meta.phasePath,
    phaseKey: meta.phaseKey,
  };
}
function sortGroups(a, b) {
  const ai = CATEGORY_ORDER.indexOf(a.category), bi = CATEGORY_ORDER.indexOf(b.category);
  const ao = ai === -1 ? 999 : ai, bo = bi === -1 ? 999 : bi;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, 'ko');
}
function safeBundleName(id) {
  return String(id).replace(/[^a-zA-Z0-9가-힣_-]+/g, '__').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'bundle';
}
function createBundle(group) {
  ensureDir(BUNDLE_DIR);
  const bundleName = safeBundleName(group.id) + '.bundle.json';
  const bundlePath = path.join(BUNDLE_DIR, bundleName);
  const bundleRel = toPosix(path.relative(ROOT, bundlePath));
  const files = group.files.map(item => {
    const full = path.join(ROOT, item.path);
    return { ...item, text: fs.readFileSync(full, 'utf8') };
  });
  const bundle = {
    version: 2,
    groupId: group.id,
    groupName: group.name,
    category: group.category,
    categoryName: group.categoryName,
    phases: group.phases || [],
    generatedAt: new Date().toISOString(),
    files,
  };
  fs.writeFileSync(bundlePath, JSON.stringify(bundle), 'utf8');
  const st = fs.statSync(bundlePath);
  return { path: bundleRel, size: st.size, fileCount: files.length, updatedAt: st.mtime.toISOString() };
}
function phaseSummary(files) {
  const map = new Map();
  for (const f of files) {
    if (!f.phaseId) continue;
    if (!map.has(f.phaseId)) map.set(f.phaseId, {
      id: f.phaseId,
      name: f.phaseName || f.phasePath || '구분 없음',
      path: f.phasePath || '',
      key: f.phaseKey || '',
      fileCount: 0,
      size: 0,
    });
    const p = map.get(f.phaseId);
    p.fileCount++;
    p.size += Number(f.size) || 0;
  }
  const arr = [...map.values()];
  arr.sort((a,b)=>{
    const ar = a.key === '__regular__' ? -1 : 0;
    const br = b.key === '__regular__' ? -1 : 0;
    if (ar !== br) return ar - br;
    return String(a.name).localeCompare(String(b.name),'ko');
  });
  return arr;
}
function main() {
  ensureDir(DATA_DIR);
  for (const c of CATEGORY_ORDER) ensureDir(path.join(DATA_DIR, c));
  ensureDir(BUNDLE_DIR);
  rmDirContents(BUNDLE_DIR);

  const files = walk(DATA_DIR).sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'ko'));
  const grouped = new Map();
  for (const full of files) {
    const item = fileToItem(full);
    const id = item.groupId || item.category || 'etc';
    if (!grouped.has(id)) grouped.set(id, {
      id,
      name: item.groupName || item.categoryName,
      category: item.category,
      categoryName: item.categoryName,
      seasonId: item.seasonId,
      seasonName: item.seasonName,
      description: item.categoryName,
      files: [],
    });
    grouped.get(id).files.push(item);
  }
  const groups = [...grouped.values()].sort(sortGroups).map(g => {
    const sortedFiles = g.files.sort((a, b) => a.path.localeCompare(b.path, 'ko'));
    const phases = phaseSummary(sortedFiles);
    const group = {
      id: g.id,
      name: g.name,
      category: g.category,
      categoryName: g.categoryName,
      seasonId: g.seasonId,
      seasonName: g.seasonName,
      description: g.description,
      default: true,
      phases,
      files: sortedFiles,
    };
    group.bundle = createBundle(group);
    return group;
  });
  const manifest = {
    version: 4,
    generatedAt: new Date().toISOString(),
    bundleMode: true,
    hierarchyMode: 'category/group/phase',
    categoryOrder: CATEGORY_ORDER,
    categories: CATEGORY_NAMES,
    groups,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✅ manifest generated: ${groups.length} groups / ${files.length} files -> ${toPosix(path.relative(ROOT, OUT_FILE))}`);
  console.log(`✅ bundles generated: ${groups.length} -> ${toPosix(path.relative(ROOT, BUNDLE_DIR))}`);
}
main();

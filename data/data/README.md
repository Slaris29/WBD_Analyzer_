# WBD Analyzer CSV data

CSV/TXT 파일을 아래 폴더 중 하나에 넣으면 `scripts/generate-manifest.js`가 `data/manifest.json`을 자동 생성합니다.

- `season3/` → 시즌3 리그전
- `scrim/` → 일반 스크림
- `independent/` → 독립팀
- `event/` → 이벤트리그
- `etc/` → 기타

권장 파일명 예시:

```txt
2026-06-27_TeamA_vs_TeamB.csv
2026-06-28_Arashi_vs_Alta.csv
```

수동 생성:

```bash
node scripts/generate-manifest.js
```

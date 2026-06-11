# WBD Analyzer CSV data

CSV/TXT 파일을 아래 구조로 넣으면 `scripts/generate-manifest.js`가 `data/manifest.json`을 자동 생성합니다.

## 권장 폴더 구조

```txt
data/
  league/
    FW_Season/
      game1.csv
    Season3/
      game2.csv
  scrim/
    일반스크림_6월/
      game3.csv
  independent/
    game4.csv
  event/
    WAY/
      game5.csv
  etc/
    game6.csv
```

## 화면 표시 방식

- `data/league/FW_Season/game.csv` → 분석기에는 `FW Season` 그룹으로 표시됩니다. 분류는 `리그전`입니다.
- `data/league/Season3/game.csv` → 분석기에는 `Season3` 그룹으로 표시됩니다.
- `data/scrim/KR_JP/game.csv` → 분석기에는 `KR JP` 그룹으로 표시됩니다.
- `data/independent/game.csv`처럼 2차 폴더가 없으면 `독립팀` 그룹으로 표시됩니다.

## 고정 1차 분류

- `league/` → 리그전
- `scrim/` → 일반 스크림
- `independent/` → 독립팀
- `event/` → 이벤트리그
- `etc/` → 기타

## 수동 생성

GitHub Actions가 자동으로 실행되지 않으면 로컬에서 아래 명령을 실행하세요.

```bash
node scripts/generate-manifest.js
```

그 후 생성된 `data/manifest.json`까지 같이 커밋하면 됩니다.

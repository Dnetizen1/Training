#!/usr/bin/env python3
"""Делает src/exdb.js из открытой базы free-exercise-db (public domain, https://github.com/yuhonas/free-exercise-db).
Берём силовые упражнения: название, основные и второстепенные мышцы в индексах MUS из data.js.
«shoulders» в базе не делится на головы дельты — уточняем по словам в названии.
Запуск: python3 tools/import_exdb.py [путь к exercises.json]  (без аргумента — скачивает)."""
import json, sys, urllib.request
from pathlib import Path
URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
data = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else json.load(urllib.request.urlopen(URL))
M = {"chest": 0, "lats": 1, "biceps": 5, "triceps": 6, "quadriceps": 7, "hamstrings": 8, "glutes": 9, "calves": 10,
     "traps": 11, "middle back": 11, "forearms": 12, "lower back": 13, "neck": 14, "abdominals": 15,
     "adductors": 17, "abductors": 18}
def delt(name):
    n = name.lower()
    if any(w in n for w in ("rear", "reverse fly", "face pull", "bent over lateral", "bent-over lateral")): return 4
    if any(w in n for w in ("lateral", "side raise", "upright")): return 3
    return 2
def idx(ms, name):
    out = []
    for m in ms:
        k = delt(name) if m == "shoulders" else M.get(m)
        if k is not None and k not in out: out.append(k)
    return out
rows = []
for e in data:
    if e.get("category") not in ("strength", "powerlifting", "olympic weightlifting", "strongman"): continue
    p = idx(e["primaryMuscles"], e["name"])
    if not p: continue
    s = [k for k in idx(e["secondaryMuscles"], e["name"]) if k not in p]
    rows.append([e["name"], p, s])
out = Path(__file__).resolve().parent.parent / "src" / "exdb.js"
out.write_text("/* Сгенерировано tools/import_exdb.py из free-exercise-db (public domain). [название, основные, второстепенные] */\n"
               "const EXDB=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(out, len(rows), "упражнений,", out.stat().st_size, "байт")

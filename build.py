#!/usr/bin/env python3
"""Собирает tracker.html (страница артефакта) из src/: ios.css, data.js, exdb.js, core.js, ui.js (журнал и вкладки), home.js (сводка), focus.js (фокус)."""
from pathlib import Path
src = Path(__file__).parent / "src"
css = (src / "ios.css").read_text()
js = "\n".join((src / f).read_text() for f in ("data.js", "exdb.js", "core.js", "ui.js", "home.js", "focus.js"))
out = f"""<title>Дневник тренировок</title>
<meta name="theme-color" content="#18181A">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Тренировки">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700;800&display=swap" rel="stylesheet">
<style>
{css}</style>
<div id="root"><div class="splash" role="status" aria-label="Загружаю дневник">Дневник<br>тренировок</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/motion@11.18.2/dist/motion.js"></script>
<script>
{js}</script>
"""
(Path(__file__).parent / "tracker.html").write_text(out)
print("tracker.html:", len(out), "bytes")

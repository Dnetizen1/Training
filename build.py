#!/usr/bin/env python3
"""Собирает tracker.html (страница артефакта) из src/: style.css, data.js, app.js."""
from pathlib import Path
src = Path(__file__).parent / "src"
css = (src / "style.css").read_text()
js = (src / "data.js").read_text() + "\n" + (src / "app.js").read_text()
out = f"""<title>Дневник тренировок</title>
<style>
{css}</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Unbounded:wght@600;700&display=swap">
<div id="root"><div class="top"><div class="brand"><h1>Дневник тренировок</h1><span class="save">Загружаю…</span></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/motion@11.18.2/dist/motion.js"></script>
<script>
{js}</script>
"""
(Path(__file__).parent / "tracker.html").write_text(out)
print("tracker.html:", len(out), "bytes")

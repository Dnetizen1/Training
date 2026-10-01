#!/usr/bin/env python3
"""Собирает tracker.html (страница артефакта) из src/: style.css, data.js, core.js, ui.js."""
from pathlib import Path
src = Path(__file__).parent / "src"
css = (src / "style.css").read_text()
js = "\n".join((src / f).read_text() for f in ("data.js", "core.js", "ui.js"))
out = f"""<title>Дневник тренировок</title>
<style>
{css}</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Unbounded:wght@600;700&display=swap">
<div id="root"><div class="empty">Загружаю дневник…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/motion@11.18.2/dist/motion.js"></script>
<script>
{js}</script>
"""
(Path(__file__).parent / "tracker.html").write_text(out)
print("tracker.html:", len(out), "bytes")

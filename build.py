#!/usr/bin/env python3
"""Собирает tracker.html (страница артефакта) из src/: ios.css, data.js, exdb.js, core.js, ui.js (журнал и вкладки), home.js (сводка), focus.js (фокус)."""
from pathlib import Path
src = Path(__file__).parent / "src"
css = (src / "ios.css").read_text()
js = "\n".join((src / f).read_text() for f in ("data.js", "exdb.js", "core.js", "ui.js", "home.js", "focus.js"))
out = f"""<title>Дневник тренировок</title>
<style>
{css}</style>
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

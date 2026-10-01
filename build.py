#!/usr/bin/env python3
"""Собирает tracker.html (страница артефакта) из src/: ios.css, data.js, exdb.js, core.js, ui.js (журнал и вкладки), home.js (сводка), focus.js (фокус)."""
from pathlib import Path
src = Path(__file__).parent / "src"
css = (src / "ios.css").read_text()
js = "\n".join((src / f).read_text() for f in ("data.js", "exdb.js", "core.js", "ui.js", "home.js", "focus.js"))
out = f"""<title>Дневник тренировок</title>
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Тренировки">
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

# --- версия для GitHub Pages (docs/): полноценная страница + манифест, данные в localStorage ---
docs = Path(__file__).parent / "docs"
docs.mkdir(exist_ok=True)
body = out.split("\n", 3)[3]            # без <title> и тегов иконки артефакта
page = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Дневник тренировок</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Тренировки">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#D2480B">
<style>:root{{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}html{{scroll-padding-top:env(safe-area-inset-top,0px)}}body{{margin:0}}[hidden]{{display:none!important}}</style>
</head><body>
{body}</body></html>
"""
(docs / "index.html").write_text(page)
(docs / "manifest.webmanifest").write_text('{"name":"Дневник тренировок","short_name":"Тренировки","start_url":".","display":"standalone","background_color":"#F2F2F7","theme_color":"#D2480B","icons":[{"src":"apple-touch-icon.png","sizes":"180x180","type":"image/png"}]}')
import shutil; shutil.copy(Path(__file__).parent / "apple-touch-icon.png", docs / "apple-touch-icon.png")
print("docs/index.html:", len(page), "bytes")

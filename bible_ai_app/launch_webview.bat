@echo off
title Bible AI - Logos Edition (PyWebView)
cd /d "%~dp0"
call .\venv\Scripts\activate.bat
python webview_app.py
pause

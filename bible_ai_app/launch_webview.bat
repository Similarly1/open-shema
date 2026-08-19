@echo off
title Open Shema (PyWebView)
cd /d "%~dp0"
call .\venv\Scripts\activate.bat
python webview_app.py
pause

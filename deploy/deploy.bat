@echo off
REM Windows: двойной клик по этому файлу заливает сайт.
cd /d "%~dp0.."
python deploy\deploy.py
if errorlevel 1 pause

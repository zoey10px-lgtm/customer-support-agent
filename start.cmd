@echo off
cd /d "%~dp0"
title SEMILON Electronics - Carely
set PORT=8770
echo SEMILON Electronics - http://127.0.0.1:8770
echo Project: %CD%
python server.py
pause

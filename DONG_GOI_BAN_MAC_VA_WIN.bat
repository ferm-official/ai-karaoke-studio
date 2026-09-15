@echo off
setlocal
cd /d "%~dp0"
title AI Karaoke Studio Pro - Tu Dong Dong Goi Windows & Mac
color 0E

echo =======================================================================
echo    AI KARAOKE STUDIO PRO - TU DONG DONG GOI CHO WINDOWS VA MAC M
echo =======================================================================
echo.

set PY_EXEC=
if exist "venv\Scripts\python.exe" (
    set PY_EXEC=venv\Scripts\python.exe
) else (
    set PY_EXEC=python
)

%PY_EXEC% tao_goi_cai_dat.py

echo.
echo =======================================================================
echo Nhan phim bat ky de mo thu muc chua cac file ZIP da dong goi...
echo =======================================================================
pause
explorer dist_packages

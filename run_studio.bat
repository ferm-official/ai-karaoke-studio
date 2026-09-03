@echo off
title AI Karaoke Studio Pro - 100%% Local Engine
color 0B

echo =======================================================
echo     AI KARAOKE STUDIO PRO - 100%% LOCAL GPU POWERED
echo =======================================================
echo.
echo [*] Dang khoi dong Local AI Karaoke Server...
echo [*] GPU ho tro: NVIDIA GeForce RTX 3060 (CUDA)
echo [*] Dia chi truy cap: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
python server.py

pause

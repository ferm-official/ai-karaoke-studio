@echo off
setlocal
title AI Karaoke Studio Pro - Cai Dat Moi Truong (1-Click Installer)
color 0A

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - CAI DAT MOI TRUONG TU DONG
echo =======================================================================
echo.

set PY_EXEC=
where python >nul 2>&1
if %errorlevel% equ 0 (
    set PY_EXEC=python
) else (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set PY_EXEC=py
    )
)

if "%PY_EXEC%"=="" (
    echo =======================================================================
    echo [LOI] KHONG TIM THAY PYTHON TREN MAY TINH CUA BAN!
    echo =======================================================================
    echo.
    echo Vui long cai dat Python 3.10, 3.11 hoac 3.12 tai:
    echo     https://www.python.org/downloads/
    echo.
    echo LUU Y QUAN TRONG KHI CAI DAT:
    echo    Hay TICH CHON vao o: [Add Python to PATH]
    echo    o ngay man hinh dau tien cua bo cai dat Python.
    echo.
    echo Sau khi cai dat xong, vui long chay lai file nay!
    echo =======================================================================
    echo.
    pause
    exit /b 1
)

echo [*] Tim thay Python hop le: %PY_EXEC%
echo [*] Dang khoi chay trinh cai dat tu dong setup_env.py...
echo.

%PY_EXEC% setup_env.py
if %errorlevel% neq 0 (
    echo.
    echo [CANH BAO] Qua trinh cai dat co the gap loi. Vui long kiem tra lai ket noi mang.
)
echo.
pause

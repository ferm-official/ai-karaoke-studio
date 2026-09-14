@echo off
setlocal
title AI Karaoke Studio Pro - Cai Dat Moi Truong (1-Click Installer)
color 0A

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - CAI DAT MOI TRUONG TU DONG
echo =======================================================================
echo.

set PY_EXEC=

:: 1. Kiem tra py -3 (Python launcher mac dinh tren Windows)
py -3 -c "import sys" >nul 2>&1
if %errorlevel% equ 0 (
    set PY_EXEC=py -3
    goto FOUND_PYTHON
)

:: 2. Kiem tra python tren PATH
python -c "import sys" >nul 2>&1
if %errorlevel% equ 0 (
    set PY_EXEC=python
    goto FOUND_PYTHON
)

:: 3. Kiem tra py tong quat
py -c "import sys" >nul 2>&1
if %errorlevel% equ 0 (
    set PY_EXEC=py
    goto FOUND_PYTHON
)

:: 4. Quet cac thu muc cai dat mac dinh tren Windows neu quen tich PATH
if exist "%LocalAppData%\Programs\Python\Python311\python.exe" (
    set PY_EXEC="%LocalAppData%\Programs\Python\Python311\python.exe"
    goto FOUND_PYTHON
)
if exist "%LocalAppData%\Programs\Python\Python310\python.exe" (
    set PY_EXEC="%LocalAppData%\Programs\Python\Python310\python.exe"
    goto FOUND_PYTHON
)
if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set PY_EXEC="%LocalAppData%\Programs\Python\Python312\python.exe"
    goto FOUND_PYTHON
)
if exist "C:\Python311\python.exe" (
    set PY_EXEC="C:\Python311\python.exe"
    goto FOUND_PYTHON
)
if exist "C:\Python310\python.exe" (
    set PY_EXEC="C:\Python310\python.exe"
    goto FOUND_PYTHON
)

:NOT_FOUND
echo =======================================================================
echo [LOI] KHONG TIM THAY PYTHON TREN MAY TINH CUA BAN!
echo =======================================================================
echo.
echo De chay duoc tool, may tinh cua ban can cai dat Python.
echo.
echo Buoc 1: Tai Python ban 3.10 hoac 3.11 tai trang chu:
echo         https://www.python.org/downloads/
echo.
echo Buoc 2 (RAT QUAN TRONG):
echo         Khi mo file cai dat Python, hay TICH CHON vao o:
echo         [x] Add Python to PATH (hoac Add python.exe to PATH)
echo         o ngay duoi cung man hinh dau tien.
echo.
echo Buoc 3: Sau khi cai dat xong Python, hay chay lai file nay!
echo =======================================================================
echo.
pause
exit /b 1

:FOUND_PYTHON
echo [*] Tim thay trinh thong dich Python: %PY_EXEC%
echo [*] Dang khoi chay qua trinh thiet lap moi truong...
echo.

%PY_EXEC% setup_env.py
if %errorlevel% neq 0 (
    echo.
    echo [CANH BAO] Qua trinh cai dat co the gap loi. Vui long kiem tra lai mang Internet.
)
echo.
pause
